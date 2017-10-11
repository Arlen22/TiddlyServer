import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
import {
    StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag, DirectoryEntry,
    Directory, sortBySelector, serveStatic, obs_stat, obs_readdir, FolderEntryType, ErrorLogger
} from "./server-types";

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as zlib from 'zlib';

import { createHash } from 'crypto';
import { Mime } from '../lib/mime';

import { STATUS_CODES } from 'http';
import { EventEmitter } from "events";

import { datafolder, init as initTiddlyWiki } from "./datafolder";
import { format } from "util";
import { Stream, Writable } from "stream";

const mime: Mime = require('../lib/mime');

const error = ErrorLogger("SER-API");
__dirname = path.dirname(module.filename || process.execPath);

export function parsePath(path: string, jsonFile: string) {
    var regCheck = /${([^}])}/gi;
    path.replace(regCheck, (str, pathVar) => {
        switch (pathVar) {
            case "execPath": return __dirname;
            case "currDir": return process.cwd();
            case "jsonDir": return jsonFile;
            default: return "";
        }
    })
    return path;
}

var settings: ServerConfig = {} as any;
const typeLookup: { [k: string]: string } = {};
export function init(eventer: EventEmitter) {
    eventer.on('settings', function (set: ServerConfig) {
        settings = set;
        Object.keys(settings.types).forEach(type => {
            settings.types[type].forEach(ext => {
                if (!typeLookup[ext]) {
                    typeLookup[ext] = type;
                } else {
                    throw format('Multiple types for extension %s: %s', ext, typeLookup[ext], type);
                }
            })
        })
    })
    initTiddlyWiki(eventer);
}

type apiListRouteState = [[string, string], string | any, StateObject]

function getTreeItem(reqpath: string[]) {
    var item: any = settings.tree;
    let i;
    for (i = 0; i < reqpath.length; i++) {
        if (typeof item !== 'string' && typeof item[reqpath[i]] !== 'undefined') {
            item = item[reqpath[i]];
        } else {
            break;
        }
    }
    return [item, i];
}

//somewhere I have to recursively examine all the folders down filepath to make sure
//none of them are data folders. I think perhaps I split list and access off too early.
//Maybe I should combine them completely, or maybe I should just differentiate between 
//the two based on whether there is a trailing slash or not. That could work, but I would
//have to check whether that is standard or not. I could just ignore the trailing slash 
//entirely. I don't need to differentiate between two since each item lists its children.

export function doAPIAccessRoute(obs: Observable<StateObject>) {
    return obs.mergeMap((state: StateObject) => {
        var reqpath = decodeURI(state.path.slice().filter(a => a).join('/')).split('/').filter(a => a);
        var [item, end] = getTreeItem(reqpath);

        //if the reqpath is longer than end, but item is not a string, then the complete 
        //path is not in the tree and we send a 404.
        if (reqpath.length > end && typeof item !== 'string') {
            return state.throw(404) as any;
        }

        //get the remainder of the path
        let filepath = reqpath.slice(end).map(a => a.trim());
        //check for invalid items (such as ..)
        if (!filepath.every(a => a !== ".." && a !== "."))
            return state.throw(403);
        //if reqpath is longer than the tree list...we need to list files
        return Observable.of([typeof item === 'string' ? item : '', filepath, {
            treepath: reqpath.slice(0, end).join('/'),
            filepath: filepath.join('/'), item, state
        }]);
    }).lift({
        call: examineAccessPath
    }).routeCase<AccessPathResult<AccessPathTag>, StateObject>((res) => {
        //the item is an object (a category) and examineAccessPath was skipped entirely
        if (!res.type) return 'folder';
        //a level in the path turned out to be a datafolder or file, or could not be found
        else if (!res.isFullpath)
            //this is either a datafolder or a file
            if (typeof res.type === 'string') return res.type as 'datafolder' | 'file';
            //A folder in the path was not found. res.type is a Node stat error object
            else return '';
        else return res.type as 'datafolder' | 'file' | 'folder';
    }, { folder, datafolder, file }, function error404(obs) {
        return obs.mergeMap((res) => {
            return res.tag.state.throw(404);
        })
    })
}

/**
 * recursively examines each level in the filepath and determines the 
 * state of the path. If the first argument is a zero-length string, 
 * it will skip checking and return only the third argument.
 * @param subscriber 
 * @param input 
 */
function examineAccessPath(
    subscriber: Subscriber<AccessPathResult<any>>,
    input: Observable<[string, string[], any]>
) {
    let loop = new Subject();
    let skip = new Subject();
    return input.map(([root, item, tag]: [any, string | string[], any]) => {
        return [root, Array.isArray(item) ? item : item.split('/'), tag];
    }).mergeMap(([root, item, tag]) => {
        if (root === '') {
            skip.next({ tag });
            return Observable.empty() as any;
        }
        let end = 0;
        let folder = path.join.apply(path, [root].concat(item.slice(0, end)));
        return obs_stat({ root, item, end, folder, tag })(folder);
    }).merge(loop.mergeMap(({ root, item, end, folder, tag }) => {
        end++;
        folder = path.join.apply(path, [root].concat(item.slice(0, end)));
        return obs_stat({ root, item, end, folder, tag })(folder);
    })).mergeMap(([err, statItem, { root, item, end, folder, tag }]: [any, fs.Stats, any]) => {
        //if the directory does not exist or it is not a directory...
        if (err || !statItem.isDirectory())
            //isFullpath if it is the full path and actually exists
            return [{ isFullpath: !err && (end === item.length), type: err || 'file', end, tag, statItem }] as any;
        //if we have a directory, then stat for a tiddlywiki.info file
        else return obs_stat({ root, item, end, folder, tag, statItem })(path.join(folder, "tiddlywiki.info"));
    }).mergeMap((res) => {
        if (!Array.isArray(res)) return [res];
        let [err, statTW, { root, item, end, folder, tag, statItem }] = res;
        if (end === item.length || !err) {
            return [{ isFullpath: end === item.length, type: err ? 'folder' : 'datafolder', tag, end, statItem, statTW }];
        } else {
            loop.next({ root, item, end, folder, tag });
            return Observable.empty();
        }
    }).merge(skip).subscribe(subscriber as any);
}

/// directory handler section =============================================
//I have this in a JS file so I can edit it without recompiling
const { generateDirectoryListing } = require('./generateDirectoryListing');

function folder(obs: Observable<AccessPathResult<AccessPathTag>>) {
    return obs.mergeMap((res) => {
        if (!res.tag.state.url.pathname.endsWith("/")) {
            res.tag.state.res.writeHead(302, {
                'Location': res.tag.state.url.pathname + "/"
            });
            res.tag.state.res.end();
            return Observable.empty();
        }
        if (!res.type) {
            const { state, item, treepath, filepath } = res.tag;
            if (["GET", "HEAD"].indexOf(state.req.method as string) < -1) {
                return state.throw(405);
            }
            //Otherwise we will return the keys in the tree and continue
            const folders = keys(item).map(a => {
                return [
                    {
                        name: a,
                        type: typeof item[a] === 'string' ? 'folder' : 'category',
                        path: "/" + treepath + "/" + a,
                    },
                    typeof item[a] === 'string' ? item[a] : false
                ] as [DirectoryEntry, string | false]
            });
            return Observable.of([folders, res]);
        } else {
            const { end, isFullpath, statItem, statTW, type, tag } = res;
            const item = tag.item as string;
            //filepath is relative to item
            const { state, filepath, treepath } = tag;
            if (["GET", "HEAD"].indexOf(state.req.method as string) === -1) {
                return state.throw(405);
            }
            const folder = path.join(item as string, filepath);
            return obs_readdir({ folder, res })(folder).mergeMap(([err, files, { folder, res }]) => {
                if (err) { return Observable.of({ error: err }) as any; }

                const entries = files.map(a => {
                    return [{
                        name: a,
                        type: 'folder',
                        path: "/" + [treepath, filepath.split('/').slice(0, end).join('/')].filter(a => !!a).join('/')
                    } as DirectoryEntry, path.join(folder, a)]
                })

                return Observable.of([entries, res]);
            });
        }
    }).mergeMap(statEntries).map(res2 => {
        //unpack the data
        let { entries, folder, res } = res2 as { entries: DirectoryEntry[], folder: string, res: AccessPathResult<AccessPathTag> };
        let { tag } = res;
        let end: '' | number = typeof res.end === 'number' ? res.end : '';
        let { item, state, filepath, treepath } = tag;

        //set the path for each item
        let prefix = [treepath, end && filepath.split('/').slice(0, end).join('/')].filter(a => !!a).join('/');
        entries.forEach(e => {
            e.path = "/" + [prefix, e.name].filter(a => a).join('/')
        });

        // Send response
        const type = typeof item === 'string' ? 'folder' : 'category';
        state.res.writeHead(200, {
            'x-api-access-type': type
        });
        if (state.req.method === 'GET') {
            const directory = {
                type,
                entries,
                path: (treepath ? "/" + treepath : "") + (filepath ? "/" + filepath : "") + "/"
            }
            state.res.write(generateDirectoryListing(directory))
        }
        state.res.end();
        return state;
    })
}

function statEntries([entries, res]: any): any {
    type Type1 = [DirectoryEntry, string | false];
    type Type2 = [any, fs.Stats, [DirectoryEntry, string | false]];
    return Observable.from(entries).mergeMap<Type1, Type2>(([entry, itemPath]) => {
        if (itemPath === false) return Observable.of([true, null, [entry, itemPath]]);
        else return obs_stat([entry, itemPath])(itemPath);
    }).map(res2 => {
        let [err, stat, [entry, itemPath]] = res2;

        //set the size to a blank string by default
        entry.size = "";
        if (err === true) {
            //category
            return [entry, itemPath];
        } else if (err) {
            //stat error on the item
            entry.type = "error";
        } else if (stat.isDirectory()) {
            //folder or datafolder
            entry.type = 'folder';
        } else if (stat.isFile()) {
            //a specified type or other
            entry.type = <FolderEntryType>typeLookup[entry.name.split('.').pop() as string] || 'other';
            entry.size = stat.size + "B";
        }

        return [entry, itemPath];
    }).mergeMap<any, any>((res) => {
        let [entry, itemPath] = res as [DirectoryEntry, string];

        if (entry.type === 'folder')
            return obs_stat(entry)(path.join(itemPath, 'tiddlywiki.info'));

        else return Observable.of([true, null, entry]);
    }).map((res) => {
        let [err, files, entry] = res as [any, fs.Stats, DirectoryEntry];

        if (!err) {
            entry.type = 'datafolder';
            entry.icon = "application_xp_terminal.png";
        }

        return ([true, entry]);
    }).reduce<[boolean, DirectoryEntry], DirectoryEntry[]>((n, [dud, entry]) => {
        n.push(entry);
        return n;
    }, []).map(entries => {
        return { entries, res };
    })
}



/// file handler section =============================================

function file(obs: Observable<AccessPathResult<AccessPathTag>>) {

    return obs.mergeMap<AccessPathResult<AccessPathTag>, StateObject>(res => {
        //unpack the result from examineAccessPath
        const { statItem, tag, isFullpath, end, type } = res;
        const { state, item, treepath: catpath, filepath: itempath } = tag;

        //here we could balk if the file is found in the middle of the path
        if (!isFullpath) return state.throw(404);

        //generate the file path and etag
        const filepath = itempath.split('/').slice(0, end);
        const fullpath = path.join(item as string, filepath.join('/'));
        const hash = createHash('sha256').update(fullpath).digest('base64');
        //const etag = [hash, statItem.mtime.toISOString()].join('/');
        const mtime = Date.parse(statItem.mtime as any);
        const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
        //handle GET,HEAD,PUT,OPTIONS
        if (["GET", "HEAD"].indexOf(state.req.method as string) > -1) {
            return serveStatic(fullpath, state, statItem).map((res) => {
                const [isError, result] = res as [boolean, { status: number, message: string, headers: any }];
                //if (isError) state.req['skipLog'] = false;
                if (isError) state.throw(result.status, result.message, result.headers);
            }).ignoreElements()
        } else if (state.req.method === "PUT") {
            if (state.req.headers['if-match'] && (state.req.headers['if-match'] !== etag)) {
                return state.throw(412);
            }
            return new Observable((subscriber) => {
                if (settings.backupDirectory) {
                    const backupFile = state.url.path.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
                    const ext = path.extname(backupFile);
                    //console.log(backupFile, state.url.path);
                    const backupWrite = fs.createWriteStream(path.join(settings.backupDirectory, backupFile + "-" + mtime + ext + ".gz"));
                    const fileRead = fs.createReadStream(fullpath);
                    const gzip = zlib.createGzip();
                    const pipeError = (err) => {
                        error('Error saving backup file for %s: %s\r\n%s', state.url.path, err.message,
                            "Please make sure the backup directory actually exists or else make the " +
                            "backupDirectory key falsy in your settings file (e.g. set it to a " +
                            "zero length string or false, or remove it completely)");

                        state.throw(500, "Server error", "Backup could not be saved, see server output");
                        fileRead.close();
                        gzip.end();
                        backupWrite.end();
                        subscriber.complete();
                    };
                    fileRead.on('error', pipeError);
                    gzip.on('error', pipeError);
                    backupWrite.on('error', pipeError);
                    // fileRead.on('error', (err) => {
                    //     gzip.end();
                    //     error('Error saving backup file for %s: %s', state.url.path, err.message);
                    // })
                    fileRead.pipe(gzip).pipe(backupWrite).on('close', () => {
                        subscriber.next();
                        subscriber.complete();
                    })
                } else {
                    subscriber.next();
                    subscriber.complete();
                }
            }).switchMap(() => {
                let stream: Stream = state.req;
                // if (state.req.headers["content-encoding"]) {
                //     const encoding: (string)[] = state.req.headers["content-encoding"].split(', ');
                //     encoding.forEach(e => {
                //         if (e.trim() === "gzip") {
                //             stream = stream.pipe(zlib.createGunzip());
                //         } else {
                //             state.throw(415, "Only gzip is supported by this server");
                //         }
                //     })
                // }
                const write = stream.pipe(fs.createWriteStream(fullpath));
                const finish = Observable.fromEvent(write, 'finish').take(1);
                return Observable.merge(finish, Observable.fromEvent(write, 'error').takeUntil(finish)).switchMap((err: Error) => {
                    if (err) {
                        return state.throw(500, "Error while writing the file to disk", [err.name, err.message, err.stack].join(': '));
                    } else {
                        return obs_stat(false)(fullpath) as any;
                    }
                }).map(([err, statNew]) => {
                    const mtimeNew = Date.parse(statNew.mtime as any);
                    const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join('-'));
                    state.res.writeHead(200, {
                        'x-api-access-type': 'file',
                        'etag': etagNew
                    })
                    state.res.end();
                })
            }).mapTo(state);
        } else if (state.req.method === "OPTIONS") {
            state.res.writeHead(200, {
                'x-api-access-type': 'file',
                'dav': 'tw5/put'
            });
            state.res.write("GET,HEAD,PUT,OPTIONS");
            state.res.end();
            return Observable.of(state);
        } else {
            return state.throw(405);
        }
    }) as Observable<StateObject>;
}
