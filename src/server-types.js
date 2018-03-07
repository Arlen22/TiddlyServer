"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const rx_1 = require("../lib/rx");
//import { StateObject } from "./index";
const bundled_lib_1 = require("../lib/bundled-lib");
let DEBUGLEVEL = -1;
exports.typeLookup = {};
function init(eventer) {
    eventer.on('settings', function (set) {
        DEBUGLEVEL = typeof set.debugLevel === "number" ? set.debugLevel : -1;
        Object.keys(set.types).forEach(type => {
            set.types[type].forEach(ext => {
                if (!exports.typeLookup[ext]) {
                    exports.typeLookup[ext] = type;
                }
                else {
                    throw util_1.format('Multiple types for extension %s: %s', ext, exports.typeLookup[ext], type);
                }
            });
        });
    });
}
exports.init = init;
function getHumanSize(size) {
    const TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let power = 0;
    while (size >= 1024) {
        size /= 1024;
        power++;
    }
    return size.toFixed(1) + TAGS[power];
}
exports.getHumanSize = getHumanSize;
function tryParseJSON(str, errObj = {}) {
    function findJSONError(message, json) {
        const res = [];
        const match = /position (\d+)/gi.exec(message);
        if (!match)
            return "";
        const position = +match[1];
        const lines = json.split('\n');
        let current = 1;
        let i = 0;
        for (; i < lines.length; i++) {
            current += lines[i].length + 1; //add one for the new line
            res.push(lines[i]);
            if (current > position)
                break;
        }
        const linePos = lines[i].length - (current - position) - 1; //take the new line off again
        //not sure why I need the +4 but it seems to hold out.
        res.push(new Array(linePos + 4).join('-') + '^  ' + message);
        for (i++; i < lines.length; i++) {
            res.push(lines[i]);
        }
        return res.join('\n');
    }
    str = str.replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
    try {
        return JSON.parse(str);
    }
    catch (e) {
        let err = new JsonError(findJSONError(e.message, str), e);
        if (errObj === true) {
        }
        else
            errObj.error = err;
    }
}
exports.tryParseJSON = tryParseJSON;
class JsonError {
    constructor(errorPosition, originalError) {
        this.errorPosition = errorPosition;
        this.originalError = originalError;
        this.filePath = "";
    }
}
exports.JsonError = JsonError;
function keys(o) {
    return Object.keys(o);
}
exports.keys = keys;
function padLeft(str, pad, padStr) {
    var item = str.toString();
    if (typeof padStr === 'undefined')
        padStr = ' ';
    if (typeof pad === 'number') {
        pad = new Array(pad + 1).join(padStr);
    }
    //pad: 000000 val: 6543210 => 654321
    return pad.substr(0, Math.max(pad.length - item.length, 0)) + item;
}
exports.padLeft = padLeft;
function sortBySelector(key) {
    return function (a, b) {
        var va = key(a);
        var vb = key(b);
        if (va > vb)
            return 1;
        else if (va < vb)
            return -1;
        else
            return 0;
    };
}
exports.sortBySelector = sortBySelector;
function sortByKey(key) {
    return sortBySelector(e => e[key]);
}
exports.sortByKey = sortByKey;
var colors;
(function (colors) {
    colors.Reset = "\x1b[0m";
    colors.Bright = "\x1b[1m";
    colors.Dim = "\x1b[2m";
    colors.Underscore = "\x1b[4m";
    colors.Blink = "\x1b[5m";
    colors.Reverse = "\x1b[7m";
    colors.Hidden = "\x1b[8m";
    colors.FgBlack = "\x1b[30m";
    colors.FgRed = "\x1b[31m";
    colors.FgGreen = "\x1b[32m";
    colors.FgYellow = "\x1b[33m";
    colors.FgBlue = "\x1b[34m";
    colors.FgMagenta = "\x1b[35m";
    colors.FgCyan = "\x1b[36m";
    colors.FgWhite = "\x1b[37m";
    colors.BgBlack = "\x1b[40m";
    colors.BgRed = "\x1b[41m";
    colors.BgGreen = "\x1b[42m";
    colors.BgYellow = "\x1b[43m";
    colors.BgBlue = "\x1b[44m";
    colors.BgMagenta = "\x1b[45m";
    colors.BgCyan = "\x1b[46m";
    colors.BgWhite = "\x1b[47m";
})(colors = exports.colors || (exports.colors = {}));
// declare function DebugLog(str: string, ...args: any[]);
function isError(obj) {
    return obj.constructor === Error;
    // return [obj.message, obj.name].every(e => typeof e !== "undefined");
}
exports.isError = isError;
function isErrnoException(obj) {
    return isError(obj);
}
exports.isErrnoException = isErrnoException;
function DebugLogger(prefix) {
    //if(prefix.startsWith("V:")) return function(){};
    return function (msgLevel, ...args) {
        if (DEBUGLEVEL > msgLevel)
            return;
        if (isError(args[0])) {
            let err = args[0];
            args = [];
            if (err.stack)
                args.push(err.stack);
            else
                args.push("Error %s: %s", err.name, err.message);
        }
        let t = new Date();
        let date = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.log([' ', (msgLevel >= 3 ? (colors.BgRed + colors.FgWhite) : colors.FgRed) + prefix,
            colors.FgCyan, date, colors.Reset, util_1.format.apply(null, args)].join(' ').split('\n').map((e, i) => {
            if (i > 0) {
                return new Array(28 + prefix.length).join(' ') + e;
            }
            else {
                return e;
            }
        }).join('\n'));
    };
}
exports.DebugLogger = DebugLogger;
function sanitizeJSON(key, value) {
    // returning undefined omits the key from being serialized
    if (!key) {
        return value;
    } //This is the entire value to be serialized
    else if (key.substring(0, 1) === "$")
        return; //Remove angular tags
    else if (key.substring(0, 1) === "_")
        return; //Remove NoSQL tags
    else
        return value;
}
exports.sanitizeJSON = sanitizeJSON;
// export const serveStatic: (path: string, state: StateObject, stat: fs.Stats) => Observable<[
//     boolean, ServeStaticResult
// ]> = (function () {
//     interface Server {
//         serveFile(pathname: string, status: number, headers: {}, req: http.IncomingMessage, res: http.ServerResponse): EventEmitter
//         respond(...args: any[]): any;
//         finish(...args: any[]): any;
//     }
//     const staticServer = require('../lib/node-static');
//     const serve = new staticServer.Server({
//         mount: '/'
//         // gzipTransfer: true, 
//         // gzip:/^(text\/html|application\/javascript|text\/css|application\/json)$/gi 
//     }) as Server;
//     const promise = new EventEmitter();
//     return function (path: string, state: StateObject, stat: fs.Stats) {
//         const { req, res } = state;
//         return Observable.create((subs: Subscriber<[boolean, ServeStaticResult]>) => {
//             serve.respond(null, 200, {
//                 'x-api-access-type': 'file'
//             }, [path], stat, req, res, function (status: number, headers: any) {
//                 serve.finish(status, headers, req, res, promise, (err: ServeStaticResult, res: ServeStaticResult) => {
//                     if (err) {
//                         subs.next([true, err]);
//                     } else {
//                         subs.next([false, res]);
//                     }
//                     subs.complete();
//                 });
//             });
//         })
//     }
// })();
function serveFile(obs, file, root) {
    return obs.mergeMap(state => {
        return exports.obs_stat(state)(path.join(root, file)).mergeMap(([err, stat]) => {
            if (err)
                return state.throw(404);
            bundled_lib_1.send(state.req, file, { root })
                .on('error', err => {
                state.log(2, '%s %s', err.status, err.message).error().throw(500);
            }).pipe(state.res);
            return rx_1.Observable.empty();
        });
    }).ignoreElements();
}
exports.serveFile = serveFile;
function serveFolder(obs, mount, root, serveIndex) {
    return obs.do(state => {
        const pathname = state.url.pathname;
        if (state.url.pathname.slice(0, mount.length) !== mount) {
            state.log(2, 'URL is different than the mount point %s', mount).throw(500);
        }
        else {
            bundled_lib_1.send(state.req, pathname.slice(mount.length), { root })
                .on('error', (err) => {
                state.log(-1, '%s %s', err.status, err.message).error().throw(404);
            })
                .on('directory', (res, fp) => {
                if (serveIndex) {
                    serveIndex(state, res, fp);
                }
                else {
                    state.throw(403);
                }
            })
                .pipe(state.res);
        }
    }).ignoreElements();
}
exports.serveFolder = serveFolder;
function serveFolderIndex(options) {
    function readFolder(folder) {
        return exports.obs_readdir()(folder).mergeMap(([err, files]) => {
            return rx_1.Observable.from(files);
        }).mergeMap(file => {
            return exports.obs_stat(file)(path.join(folder, file));
        }).map(([err, stat, key]) => {
            let itemtype = stat.isDirectory() ? 'directory' : (stat.isFile() ? 'file' : 'other');
            return { key, itemtype };
        }).reduce((n, e) => {
            n[e.itemtype].push(e.key);
            return n;
        }, { "directory": [], "file": [] });
    }
    if (options.type === "json") {
        return function (state, res, folder) {
            readFolder(folder).subscribe(item => {
                res.writeHead(200);
                res.write(JSON.stringify(item));
                res.end();
            });
        };
    }
}
exports.serveFolderIndex = serveFolderIndex;
/**
 * Returns the keys and paths from the PathResolverResult directory. If there
 * is an error it will be sent directly to the client and nothing will be emitted.
 *
 * @param {PathResolverResult} result
 * @returns
 */
function getTreeItemFiles(result) {
    let dirpath = [
        result.treepathPortion.join('/'),
        result.filepathPortion.join('/')
    ].filter(e => e).join('/');
    if (typeof result.item === "object") {
        const keys = Object.keys(result.item);
        const paths = keys.map(k => {
            return typeof result.item[k] === "string" ? result.item[k] : true;
        });
        return rx_1.Observable.of({ keys, paths, dirpath });
    }
    else {
        return exports.obs_readdir()(result.fullfilepath).map(([err, keys]) => {
            if (err) {
                result.state.log(2, 'Error calling readdir on folder "%s": %s', result.fullfilepath, err.message);
                result.state.throw(500);
                return;
            }
            const paths = keys.map(k => path.join(result.fullfilepath, k));
            return { keys, paths, dirpath };
        }).filter(obsTruthy);
    }
}
exports.getTreeItemFiles = getTreeItemFiles;
/// directory handler section =============================================
//I have this in a JS file so I can edit it without recompiling
const { generateDirectoryListing } = require('./generateDirectoryListing');
function sendDirectoryIndex(_r) {
    let { keys, paths, dirpath } = _r;
    let pairs = keys.map((k, i) => [k, paths[i]]);
    return rx_1.Observable.from(pairs).mergeMap(([key, val]) => {
        //if this is a category, just return the key
        if (typeof val === "boolean")
            return rx_1.Observable.of({ key });
        else
            return statPath(val).then(res => { return { stat: res, key }; });
    }).reduce((n, e) => {
        let linkpath = [dirpath, e.key].filter(e => e).join('/');
        n.push({
            name: e.key,
            path: e.key + ((!e.stat || e.stat.itemtype === "folder") ? "/" : ""),
            type: (!e.stat ? "category" : (e.stat.itemtype === "file"
                ? exports.typeLookup[e.key.split('.').pop()] || 'other'
                : e.stat.itemtype)),
            size: (e.stat && e.stat.stat) ? getHumanSize(e.stat.stat.size) : ""
        });
        return n;
    }, []).map(entries => {
        return generateDirectoryListing({ path: dirpath, entries });
    });
}
exports.sendDirectoryIndex = sendDirectoryIndex;
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
exports.statWalkPath = statWalkPath;
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
        exports.obs_stat(fs.stat)(statpath).chainMap(([err, stat]) => {
            if (err || stat.isFile())
                endStat = true;
            if (!err && stat.isDirectory())
                return exports.obs_stat(stat)(path.join(statpath, "tiddlywiki.info"));
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
exports.statPath = statPath;
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
// export function obs<S>(state?: S) {
//     return Observable.bindCallback(fs.stat, (err, stat): NodeCallback<fs.Stats, S> => [err, stat, state] as any);
// }
exports.obs_stat = (state) => rx_1.Observable.bindCallback(fs.stat, (err, stat) => [err, stat, state]);
exports.obs_readdir = (state) => rx_1.Observable.bindCallback(fs.readdir, (err, files) => [err, files, state]);
exports.obs_readFile = (tag = undefined) => (filepath, encoding) => new rx_1.Observable(subs => {
    if (encoding)
        fs.readFile(filepath, encoding, (err, data) => {
            subs.next([err, data, tag, filepath]);
            subs.complete();
        });
    else
        fs.readFile(filepath, (err, data) => {
            subs.next([err, data, tag, filepath]);
            subs.complete();
        });
});
// Observable.bindCallback(fs.readFile,
//     (err, data): NodeCallback<string | Buffer, T> => [err, data, state] as any
// );
exports.obs_writeFile = (state) => rx_1.Observable.bindCallback(fs.writeFile, (err, data) => [err, data, state]);
class StateError extends Error {
    constructor(state, message) {
        super(message);
        this.state = state;
    }
}
exports.StateError = StateError;
// export type LoggerFunc = (str: string, ...args: any[]) => void;
class StateObject {
    constructor(req, res, debugLog, eventer, isLocalHost = false) {
        this.req = req;
        this.res = res;
        this.debugLog = debugLog;
        this.eventer = eventer;
        this.isLocalHost = isLocalHost;
        // debug(str: string, ...args: any[]) {
        //     this.debugLog('[' +
        //         this.req.socket.remoteFamily + '-' + colors.FgMagenta +
        //         this.req.socket.remoteAddress + colors.Reset + '] ' +
        //         format.apply(null, arguments)
        //     );
        // }
        this.loglevel = DEBUGLEVEL;
        this.doneMessage = [];
        this.hasCriticalLogs = false;
        this.startTime = process.hrtime();
        //parse the url and store in state.
        //a server request will definitely have the required fields in the object
        this.url = url.parse(this.req.url, true);
        //parse the path for future use
        this.path = this.url.pathname.split('/');
        let t = new Date();
        this.timestamp = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        this.res.on('finish', () => {
            if (this.hasCriticalLogs)
                this.error();
            if (this.errorThrown)
                this.eventer.emit('stateError', this);
        });
    }
    static errorRoute(status, reason) {
        return (obs) => {
            return obs.mergeMap((state) => {
                return state.throw(status, reason);
            });
        };
    }
    /**
     *  4 - Errors that require the process to exit for restart
     *  3 - Major errors that are handled and do not require a server restart
     *  2 - Warnings or errors that do not alter the program flow but need to be marked (minimum for status 500)
     *  1 - Info - Most startup messages
     *  0 - Normal debug messages and all software and request-side error messages
     * -1 - Detailed debug messages from high level apis
     * -2 - Response status messages and error response data
     * -3 - Request and response data for all messages (verbose)
     * -4 - Protocol details and full data dump (such as encryption steps and keys)
     */
    log(level, ...args) {
        if (level < this.loglevel)
            return this;
        if (level > 1)
            this.hasCriticalLogs = true;
        this.doneMessage.push(util_1.format.apply(null, args));
        return this;
    }
    error() {
        this.errorThrown = new Error(this.doneMessage.join('\n'));
        return this;
    }
    throw(statusCode, reason, headers) {
        if (!this.res.headersSent) {
            this.res.writeHead(statusCode, reason && reason.toString(), headers);
            //don't write 204 reason
            if (statusCode !== 204 && reason)
                this.res.write(reason.toString());
        }
        this.res.end();
        return rx_1.Observable.empty();
    }
    endJSON(data) {
        this.res.write(JSON.stringify(data));
        this.res.end();
    }
    redirect(redirect) {
        this.res.writeHead(302, {
            'Location': redirect
        });
        this.res.end();
    }
    recieveBody() {
        return recieveBody(this);
    }
}
exports.StateObject = StateObject;
/** to be used with concatMap, mergeMap, etc. */
function recieveBody(state) {
    //get the data from the request
    return rx_1.Observable.fromEvent(state.req, 'data')
        .takeUntil(rx_1.Observable.fromEvent(state.req, 'end').take(1))
        .reduce((n, e) => { n.push(e); return n; }, [])
        .map(e => {
        state.body = Buffer.concat(e).toString('utf8');
        //console.log(state.body);
        if (state.body.length === 0)
            return state;
        try {
            state.json = JSON.parse(state.body);
        }
        catch (e) {
            //state.json = buf;
        }
        return state;
    });
}
exports.recieveBody = recieveBody;
;
;
function createHashmapString(keys, values) {
    if (keys.length !== values.length)
        throw 'keys and values must be the same length';
    var obj = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    });
    return obj;
}
exports.createHashmapString = createHashmapString;
function createHashmapNumber(keys, values) {
    if (keys.length !== values.length)
        throw 'keys and values must be the same length';
    var obj = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    });
    return obj;
}
exports.createHashmapNumber = createHashmapNumber;
function obsTruthy(a) {
    return !!a;
}
exports.obsTruthy = obsTruthy;
const ERRORS = {
    'PROGRAMMER_EXCEPTION': 'A programmer exception occurred: %s'
};
function getError(...args) {
    let code = args.shift();
    if (ERRORS[code])
        args.unshift(ERRORS[code]);
    //else args.unshift(code);
    return { code: code, message: util_1.format.apply(null, args) };
}
exports.getError = getError;
