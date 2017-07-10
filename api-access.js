"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("./lib/rx");
const server_types_1 = require("./server-types");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto_1 = require("crypto");
const datafolder_1 = require("./datafolder");
const util_1 = require("util");
const mime = require('./lib/mime');
const error = server_types_1.ErrorLogger("SER-API");
function parsePath(path, jsonFile) {
    var regCheck = /${([^}])}/gi;
    path.replace(regCheck, (str, pathVar) => {
        switch (pathVar) {
            case "execPath": return __dirname;
            case "currDir": return process.cwd();
            case "jsonDir": return jsonFile;
            default: return "";
        }
    });
    return path;
}
exports.parsePath = parsePath;
var settings = {};
const typeLookup = {};
function init(eventer) {
    eventer.on('settings', function (set) {
        settings = set;
        Object.keys(settings.types).forEach(type => {
            settings.types[type].forEach(ext => {
                if (!typeLookup[ext]) {
                    typeLookup[ext] = type;
                }
                else {
                    throw util_1.format('Multiple types for extension %s: %s', ext, typeLookup[ext], type);
                }
            });
        });
    });
    datafolder_1.init(eventer);
}
exports.init = init;
function getTreeItem(reqpath) {
    var item = settings.tree;
    let i;
    for (i = 0; i < reqpath.length; i++) {
        if (typeof item !== 'string' && typeof item[reqpath[i]] !== 'undefined') {
            item = item[reqpath[i]];
        }
        else {
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
function doAPIAccessRoute(obs) {
    return obs.mergeMap((state) => {
        var reqpath = decodeURI(state.path.slice().filter(a => a).join('/')).split('/').filter(a => a);
        var [item, end] = getTreeItem(reqpath);
        //if the reqpath is longer than end, but item is not a string, then the complete 
        //path is not in the tree and we send a 404.
        if (reqpath.length > end && typeof item !== 'string') {
            return state.throw(404);
        }
        //get the remainder of the path
        let filepath = reqpath.slice(end).map(a => a.trim());
        //check for invalid items (such as ..)
        if (!filepath.every(a => a !== ".." && a !== "."))
            return state.throw(403);
        //if reqpath is longer than the tree list...we need to list files
        return rx_1.Observable.of([typeof item === 'string' ? item : '', filepath, {
                treepath: reqpath.slice(0, end).join('/'),
                filepath: filepath.join('/'), item, state
            }]);
    }).lift({
        call: examineAccessPath
    }).routeCase((res) => {
        //the item is an object (a category) and examineAccessPath was skipped entirely
        if (!res.type)
            return 'folder';
        else if (!res.isFullpath)
            //this is either a datafolder or a file
            if (typeof res.type === 'string')
                return res.type;
            else
                return '';
        else
            return res.type;
    }, { folder, datafolder: datafolder_1.datafolder, file }, function error404(obs) {
        return obs.mergeMap((res) => {
            return res.tag.state.throw(404);
        });
    });
}
exports.doAPIAccessRoute = doAPIAccessRoute;
/**
 * recursively examines each level in the filepath and determines the
 * state of the path. If the first argument is a zero-length string,
 * it will skip checking and return only the third argument.
 * @param subscriber
 * @param input
 */
function examineAccessPath(subscriber, input) {
    let loop = new rx_1.Subject();
    let skip = new rx_1.Subject();
    return input.map(([root, item, tag]) => {
        return [root, Array.isArray(item) ? item : item.split('/'), tag];
    }).mergeMap(([root, item, tag]) => {
        if (root === '') {
            skip.next({ tag });
            return rx_1.Observable.empty();
        }
        let end = 0;
        let folder = path.join.apply(path, [root].concat(item.slice(0, end)));
        return server_types_1.obs_stat({ root, item, end, folder, tag })(folder);
    }).merge(loop.mergeMap(({ root, item, end, folder, tag }) => {
        end++;
        folder = path.join.apply(path, [root].concat(item.slice(0, end)));
        return server_types_1.obs_stat({ root, item, end, folder, tag })(folder);
    })).mergeMap(([err, statItem, { root, item, end, folder, tag }]) => {
        //if the directory does not exist or it is not a directory...
        if (err || !statItem.isDirectory())
            //isFullpath if it is the full path and actually exists
            return [{ isFullpath: !err && (end === item.length), type: err || 'file', end, tag, statItem }];
        else
            return server_types_1.obs_stat({ root, item, end, folder, tag, statItem })(path.join(folder, "tiddlywiki.info"));
    }).mergeMap((res) => {
        if (!Array.isArray(res))
            return [res];
        let [err, statTW, { root, item, end, folder, tag, statItem }] = res;
        if (end === item.length || !err) {
            return [{ isFullpath: end === item.length, type: err ? 'folder' : 'datafolder', tag, end, statItem, statTW }];
        }
        else {
            loop.next({ root, item, end, folder, tag });
            return rx_1.Observable.empty();
        }
    }).merge(skip).subscribe(subscriber);
}
/// directory handler section =============================================
//I have this in a JS file so I can edit it without recompiling
const { generateDirectoryListing } = require('./generateDirectoryListing');
function folder(obs) {
    return obs.mergeMap((res) => {
        if (!res.tag.state.url.pathname.endsWith("/")) {
            res.tag.state.res.writeHead(302, {
                'Location': res.tag.state.url.pathname + "/"
            });
            res.tag.state.res.end();
            return rx_1.Observable.empty();
        }
        if (!res.type) {
            const { state, item, treepath, filepath } = res.tag;
            if (["GET", "HEAD"].indexOf(state.req.method) < -1) {
                return state.throw(405);
            }
            //Otherwise we will return the keys in the tree and continue
            const folders = server_types_1.keys(item).map(a => {
                return [
                    {
                        name: a,
                        type: typeof item[a] === 'string' ? 'folder' : 'category',
                        path: "/" + treepath + "/" + a,
                    },
                    typeof item[a] === 'string' ? item[a] : false
                ];
            });
            return rx_1.Observable.of([folders, res]);
        }
        else {
            const { end, isFullpath, statItem, statTW, type, tag } = res;
            const item = tag.item;
            //filepath is relative to item
            const { state, filepath, treepath } = tag;
            if (["GET", "HEAD"].indexOf(state.req.method) === -1) {
                return state.throw(405);
            }
            const folder = path.join(item, filepath);
            return server_types_1.obs_readdir({ folder, res })(folder).mergeMap(([err, files, { folder, res }]) => {
                if (err) {
                    return rx_1.Observable.of({ error: err });
                }
                const entries = files.map(a => {
                    return [{
                            name: a,
                            type: 'folder',
                            path: "/" + [treepath, filepath.split('/').slice(0, end).join('/')].filter(a => !!a).join('/')
                        }, path.join(folder, a)];
                });
                return rx_1.Observable.of([entries, res]);
            });
        }
    }).mergeMap(statEntries).map(res2 => {
        //unpack the data
        let { entries, folder, res } = res2;
        let { tag } = res;
        let end = typeof res.end === 'number' ? res.end : '';
        let { item, state, filepath, treepath } = tag;
        //set the path for each item
        let prefix = [treepath, end && filepath.split('/').slice(0, end).join('/')].filter(a => !!a).join('/');
        entries.forEach(e => {
            e.path = "/" + [prefix, e.name].filter(a => a).join('/');
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
            };
            state.res.write(generateDirectoryListing(directory));
        }
        state.res.end();
        return state;
    });
}
function statEntries([entries, res]) {
    return rx_1.Observable.from(entries).mergeMap(([entry, itemPath]) => {
        if (itemPath === false)
            return rx_1.Observable.of([true, null, [entry, itemPath]]);
        else
            return server_types_1.obs_stat([entry, itemPath])(itemPath);
    }).map(res2 => {
        let [err, stat, [entry, itemPath]] = res2;
        //set the size to a blank string by default
        entry.size = "";
        if (err === true) {
            //category
            return [entry, itemPath];
        }
        else if (err) {
            //stat error on the item
            entry.type = "error";
        }
        else if (stat.isDirectory()) {
            //folder or datafolder
            entry.type = 'folder';
        }
        else if (stat.isFile()) {
            //a specified type or other
            entry.type = typeLookup[entry.name.split('.').pop()] || 'other';
            entry.size = stat.size + "B";
        }
        return [entry, itemPath];
    }).mergeMap((res) => {
        let [entry, itemPath] = res;
        if (entry.type === 'folder')
            return server_types_1.obs_stat(entry)(path.join(itemPath, 'tiddlywiki.info'));
        else
            return rx_1.Observable.of([true, null, entry]);
    }).map((res) => {
        let [err, files, entry] = res;
        if (!err) {
            entry.type = 'datafolder';
            entry.icon = "application_xp_terminal.png";
        }
        return ([true, entry]);
    }).reduce((n, [dud, entry]) => {
        n.push(entry);
        return n;
    }, []).map(entries => {
        return { entries, res };
    });
}
/// file handler section =============================================
function file(obs) {
    return obs.mergeMap(res => {
        //unpack the result from examineAccessPath
        const { statItem, tag, isFullpath, end, type } = res;
        const { state, item, treepath: catpath, filepath: itempath } = tag;
        //here we could balk if the file is found in the middle of the path
        if (!isFullpath)
            return state.throw(404);
        //generate the file path and etag
        const filepath = itempath.split('/').slice(0, end);
        const fullpath = path.join(item, filepath.join('/'));
        const hash = crypto_1.createHash('sha256').update(fullpath).digest('base64');
        //const etag = [hash, statItem.mtime.toISOString()].join('/');
        const mtime = Date.parse(statItem.mtime);
        const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
        //handle GET,HEAD,PUT,OPTIONS
        if (["GET", "HEAD"].indexOf(state.req.method) > -1) {
            return server_types_1.serveStatic(fullpath, state, statItem).map((res) => {
                const [isError, result] = res;
                //if (isError) state.req['skipLog'] = false;
                if (isError)
                    state.throw(result.status, result.message, result.headers);
            }).ignoreElements();
        }
        else if (state.req.method === "PUT") {
            if (state.req.headers['if-match'] && (state.req.headers['if-match'] !== etag)) {
                return state.throw(412);
            }
            return new rx_1.Observable((subscriber) => {
                if (settings.backupDirectory) {
                    const backupFile = state.url.path.replace(/[\s\\\/<>*:?"|]/gi, "_");
                    const ext = path.extname(backupFile);
                    console.log(backupFile, state.url.path);
                    const backupWrite = fs.createWriteStream(path.join(settings.backupDirectory, backupFile + "-" + mtime + ext + ".gz"));
                    const fileRead = fs.createReadStream(fullpath);
                    const gzip = zlib.createGzip();
                    fileRead.on('error', (err) => {
                        gzip.end();
                        error('Error saving backup file for %s: %s', state.url.path, err.message);
                    });
                    fileRead.pipe(gzip).pipe(backupWrite).on('error', (err) => {
                        error('Error saving backup file for %s: %s', state.url.path, err.message);
                    }).on('close', () => {
                        subscriber.next();
                        subscriber.complete();
                    });
                }
                else {
                    subscriber.next();
                    subscriber.complete();
                }
            }).switchMap(() => {
                const stream = fs.createWriteStream(fullpath);
                const write = state.req.pipe(stream);
                const finish = rx_1.Observable.fromEvent(write, 'finish').take(1);
                return rx_1.Observable.merge(finish, rx_1.Observable.fromEvent(write, 'error').takeUntil(finish)).switchMap((err) => {
                    if (err) {
                        return state.throw(500, "Error while writing the file to disk", [err.name, err.message, err.stack].join(': '));
                    }
                    else {
                        return server_types_1.obs_stat(false)(fullpath);
                    }
                }).map(([err, statNew]) => {
                    const mtimeNew = Date.parse(statNew.mtime);
                    const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join('-'));
                    state.res.writeHead(200, {
                        'x-api-access-type': 'file',
                        'etag': etagNew
                    });
                    state.res.end();
                });
            }).mapTo(state);
        }
        else if (state.req.method === "OPTIONS") {
            state.res.writeHead(200, {
                'x-api-access-type': 'file',
                'dav': 'tw5/put'
            });
            state.res.write("GET,HEAD,PUT,OPTIONS");
            state.res.end();
            return rx_1.Observable.of(state);
        }
        else {
            return state.throw(405);
        }
    });
}
