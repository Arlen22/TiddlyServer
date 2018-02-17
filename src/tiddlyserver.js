"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("../lib/rx");
const server_types_1 = require("./server-types");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const datafolder_1 = require("./datafolder");
const util_1 = require("util");
const send = require("../lib/send-lib");
const mime = require('../lib/mime');
const debug = server_types_1.DebugLogger("SER-API");
__dirname = path.dirname(module.filename || process.execPath);
function tuple(a, b, c, d, e, f) {
    return [a, b, c, d, e, f];
}
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
//somewhere I have to recursively examine all the folders down filepath to make sure
//none of them are data folders. I think perhaps I split list and access off too early.
//Maybe I should combine them completely, or maybe I should just differentiate between 
//the two based on whether there is a trailing slash or not. That could work, but I would
//have to check whether that is standard or not. I could just ignore the trailing slash 
//entirely. I don't need to differentiate between two since each item lists its children.
function doTiddlyServerRoute(input) {
    // const resolvePath = (settings.tree);
    return input.mergeMap((state) => {
        var result = resolvePath(state, settings.tree);
        if (!result)
            return state.throw(404);
        else if (typeof result.item === "object") {
            if (!state.url.path.endsWith("/")) {
                state.redirect(state.url.path + "/");
            }
            else
                sendDirectoryIndex(result);
            return rx_1.Observable.empty();
        }
        else {
            return statWalkPath(result).map(stat => {
                state.statPath = stat;
                return result;
            });
        }
    }).map(result => {
        const { state } = result;
        if (state.statPath.itemtype === "folder") {
            if (!state.url.path.endsWith("/")) {
                state.redirect(state.url.path + "/");
            }
            else
                sendDirectoryIndex(result);
        }
        else if (state.statPath.itemtype === "datafolder") {
            datafolder_1.datafolder(result);
        }
        else if (state.statPath.itemtype === "file") {
            if (['HEAD', 'GET'].indexOf(state.req.method) > -1) {
                send(state.req, result.filepathPortion.join('/'), { root: result.item })
                    .on('error', (err) => {
                    state.log(0, '%s %s', err.status, err.message).error().throw(500);
                }).on('headers', (res, filepath) => {
                    const statItem = state.statPath.stat;
                    const mtime = Date.parse(state.statPath.stat.mtime);
                    const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
                    res.setHeader('Etag', etag);
                }).pipe(state.res);
            }
            else if (['PUT'].indexOf(state.req.method) > -1) {
                handlePUTrequest(state);
            }
            else if (['OPTIONS'].indexOf(state.req.method) > -1) {
                state.res.writeHead(200, {
                    'x-api-access-type': 'file',
                    'dav': 'tw5/put'
                });
                state.res.write("GET,HEAD,PUT,OPTIONS");
                state.res.end();
            }
            else
                state.throw(405);
        }
        else if (state.statPath.itemtype === "error") {
            state.throw(404);
        }
        else {
            state.throw(500);
        }
    }).ignoreElements();
}
exports.doTiddlyServerRoute = doTiddlyServerRoute;
/// directory handler section =============================================
//I have this in a JS file so I can edit it without recompiling
const { generateDirectoryListing } = require('./generateDirectoryListing');
function getHumanSize(size) {
    const TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let power = 0;
    while (size >= 1024) {
        size /= 1024;
        power++;
    }
    return size.toFixed(1) + TAGS[power];
}
/// file handler section =============================================
function handlePUTrequest(state) {
    // const hash = createHash('sha256').update(fullpath).digest('base64');
    const fullpath = state.statPath.statpath;
    const statItem = state.statPath.stat;
    const mtime = Date.parse(state.statPath.stat.mtime);
    const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
    if (settings.etag !== "disabled" && (state.req.headers['if-match'] || settings.etag === "required") && (state.req.headers['if-match'] !== etag)) {
        const ifmatch = JSON.parse(state.req.headers['if-match']).split('-');
        const _etag = JSON.parse(etag).split('-');
        console.log('412 ifmatch %s', state.req.headers['if-match']);
        console.log('412 etag %s', etag);
        ifmatch.forEach((e, i) => {
            if (_etag[i] !== e)
                console.log("412 caused by difference in %s", ['inode', 'size', 'modified'][i]);
        });
        let headTime = +ifmatch[2];
        let diskTime = mtime;
        // console.log(settings.etagWindow, diskTime, headTime);
        if (!settings.etagWindow || diskTime - (settings.etagWindow * 1000) > headTime)
            return state.throw(412);
        console.log('412 prevented by etagWindow of %s seconds', settings.etagWindow);
    }
    new rx_1.Observable((subscriber) => {
        if (settings.backupDirectory) {
            const backupFile = state.url.path.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
            const ext = path.extname(backupFile);
            const backupWrite = fs.createWriteStream(path.join(settings.backupDirectory, backupFile + "-" + mtime + ext + ".gz"));
            const fileRead = fs.createReadStream(fullpath);
            const gzip = zlib.createGzip();
            const pipeError = (err) => {
                debug(3, 'Error saving backup file for %s: %s\r\n%s', state.url.path, err.message, "Please make sure the backup directory actually exists or else make the " +
                    "backupDirectory key falsy in your settings file (e.g. set it to a " +
                    "zero length string or false, or remove it completely)");
                state.log(3, "Backup could not be saved, see server output").throw(500);
                fileRead.close();
                gzip.end();
                backupWrite.end();
                subscriber.complete();
            };
            fileRead.on('error', pipeError);
            gzip.on('error', pipeError);
            backupWrite.on('error', pipeError);
            fileRead.pipe(gzip).pipe(backupWrite).on('close', () => {
                subscriber.next();
                subscriber.complete();
            });
        }
        else {
            subscriber.next();
            subscriber.complete();
        }
    }).switchMap(() => {
        let stream = state.req;
        const write = stream.pipe(fs.createWriteStream(fullpath));
        const finish = rx_1.Observable.fromEvent(write, 'finish').take(1);
        return rx_1.Observable.merge(finish, rx_1.Observable.fromEvent(write, 'error').takeUntil(finish)).switchMap((err) => {
            if (err) {
                return state
                    .log(0, "Error writing the updated file to disk")
                    .log(0, [err.name, err.message, err.stack].join(': '))
                    .error().throw(500);
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
    }).subscribe();
}
/**
 * If the path
 */
function statWalkPath(test) {
    // let endStat = false;
    if (typeof test.item === "object")
        throw "property item must be a string";
    let endWalk = false;
    return rx_1.Observable.from([test.item].concat(test.filepathPortion)).scan((n, e) => {
        return { statpath: path.join(n.statpath, e), index: n.index + 1, endStat: false };
    }, { statpath: "", index: -1, endStat: false }).concatMap(s => {
        if (endWalk)
            return rx_1.Observable.empty();
        else
            return rx_1.Observable.fromPromise(statPath(s).then(res => { endWalk = endWalk || res.endStat; return res; }));
    }).takeLast(1);
}
/**
 * returns the info about the specified path. endstat is true if the statpath is not
 * found or if it is a directory and contains a tiddlywiki.info file, or if it is a file.
 *
 * @param {({ statpath: string, index: number, endStat: boolean } | string)} s
 * @returns
 */
function statPath(s) {
    if (typeof s === "string")
        s = { statpath: s, index: 0, endStat: false };
    const { statpath, index } = s;
    let { endStat } = s;
    if (typeof endStat !== "boolean")
        endStat = false;
    return new Promise(resolve => {
        // What I wish I could write (so I did)
        server_types_1.obs_stat(fs.stat)(statpath).chainMap(([err, stat]) => {
            if (err || stat.isFile())
                endStat = true;
            if (!err && stat.isDirectory())
                return server_types_1.obs_stat(stat)(path.join(statpath, "tiddlywiki.info"));
            else
                resolve({ stat, statpath, index, endStat, itemtype: '' });
        }).concatAll().subscribe(([err2, infostat, stat]) => {
            if (!err2 && infostat.isFile()) {
                endStat = true;
                resolve({ stat, statpath, infostat, index, endStat, itemtype: '' });
            }
            else
                resolve({ stat, statpath, index, endStat, itemtype: '' });
        });
    }).then(res => {
        res.itemtype = getItemType(res.stat, res.infostat);
        return res;
    });
}
function getItemType(stat, infostat) {
    let itemtype;
    if (!stat)
        itemtype = "error";
    else if (stat.isDirectory())
        itemtype = !!infostat ? "datafolder" : "folder";
    else if (stat.isFile() || stat.isSymbolicLink())
        itemtype = "file";
    else
        itemtype = "error";
    return itemtype;
}
function resolvePath(state, tree) {
    var reqpath = decodeURI(state.path.slice().filter(a => a).join('/')).split('/').filter(a => a);
    //if we're at root, just return it
    if (reqpath.length === 0)
        return {
            item: tree,
            reqpath,
            treepathPortion: [],
            filepathPortion: [],
            fullfilepath: typeof tree === "string" ? tree : '',
            state
        };
    //check for invalid items (such as ..)
    if (!reqpath.every(a => a !== ".." && a !== "."))
        return;
    var result = (function () {
        var item = tree;
        var folderPathFound = false;
        for (var end = 0; end < reqpath.length; end++) {
            if (typeof item !== 'string' && typeof item[reqpath[end]] !== 'undefined') {
                item = item[reqpath[end]];
            }
            else if (typeof item === "string") {
                folderPathFound = true;
                break;
            }
            else
                break;
        }
        return { item, end, folderPathFound };
    })();
    if (reqpath.length > result.end && !result.folderPathFound)
        return;
    //get the remainder of the path
    let filepathPortion = reqpath.slice(result.end).map(a => a.trim());
    const fullfilepath = (result.folderPathFound)
        ? path.join(result.item, ...filepathPortion)
        : (typeof result.item === "string" ? result.item : '');
    return {
        item: result.item,
        reqpath,
        treepathPortion: reqpath.slice(0, result.end),
        filepathPortion,
        fullfilepath,
        state
    };
}
exports.resolvePath = resolvePath;
function getTreeIndex(tree) {
    return Object.keys(tree);
}
function sendDirectoryIndex(_r) {
    rx_1.Observable.of(_r).mergeMap(result => {
        if (typeof result.item === "object") {
            const keys = Object.keys(result.item);
            const paths = keys.map(k => {
                return typeof result.item[k] === "string" ? result.item[k] : true;
            });
            return rx_1.Observable.of({ keys, paths, result });
        }
        else {
            return server_types_1.obs_readdir()(result.fullfilepath).map(([err, keys]) => {
                if (err) {
                    result.state.log(2, 'Error calling readdir on folder: %s', err.message);
                    result.state.throw(500);
                    return { err, result };
                }
                const paths = keys.map(k => path.join(result.fullfilepath, k));
                return { keys, paths, result };
            });
        }
    }).mergeMap(({ keys, paths, result }) => {
        let pairs = keys.map((k, i) => [k, paths[i]]);
        return rx_1.Observable.from(pairs).mergeMap(([key, val]) => {
            //if this is a category, just return the key
            if (typeof val === "boolean")
                return rx_1.Observable.of({ key });
            else
                return statPath(val).then(res => { return { stat: res, key }; });
        }).reduce((n, e) => {
            let a = result.treepathPortion.join('/'), b = result.filepathPortion.join('/'), linkpath = [a, b, e.key].filter(e => e).join('/');
            n.push({
                name: e.key,
                path: e.key + (!e.stat || e.stat.itemtype === "folder") ? "/" : "",
                type: (!e.stat ? "category" : (e.stat.itemtype === "file"
                    ? typeLookup[e.key.split('.').pop()] || 'other'
                    : e.stat.itemtype)),
                size: (e.stat && e.stat.stat) ? getHumanSize(e.stat.stat.size) : ""
            });
            return n;
        }, []).map(entries => {
            // console.log(result.treepathPortion, result.filepathPortion);
            let path = [
                result.treepathPortion.join('/'),
                result.filepathPortion.join('/')
            ].filter(e => e).join('/');
            result.state.res.writeHead(200);
            result.state.res.write(generateDirectoryListing({ path, entries }));
            result.state.res.end();
        });
    }).subscribe();
}
