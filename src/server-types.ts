import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';

import { format } from "util";
import { Observable, Subscriber } from '../lib/rx';
import { EventEmitter } from "events";
//import { StateObject } from "./index";
import { send } from '../lib/bundled-lib';
import { Stats, appendFileSync } from 'fs';
import { gzip } from 'zlib';
import { Writable, Stream } from 'stream';

let DEBUGLEVEL = -1;
let settings: ServerConfig;
const colorsRegex = /\x1b\[[0-9]+m/gi
let debugOutput: Writable = new Writable({
    write: function (chunk, encoding, callback) {
        // if we're given a buffer, convert it to a string
        if (Buffer.isBuffer(chunk)) chunk = chunk.toString('utf8');
        // remove ending linebreaks for consistency
        chunk = chunk.slice(0, chunk.length - (chunk.endsWith("\r\n") ? 2 : +chunk.endsWith("\n")));

        if (settings.logError) {
            appendFileSync(
                settings.logError,
                (settings.logColorsToFile ? chunk : chunk.replace(colorsRegex, "")) + "\r\n",
                { encoding: "utf8" }
            );
        }
        if (!settings.logError || settings.logToConsoleAlso) {
            console.log(chunk);
        }
        callback && callback();
        return true;
    }
});;
export let typeLookup: { [k: string]: string };
export function init(eventer: ServerEventEmitter) {
    eventer.on('settings', function (set: ServerConfig) {
        // DEBUGLEVEL = set.debugLevel;
        settings = set;
        typeLookup = {};
        Object.keys(set.types).forEach(type => {
            set.types[type].forEach(ext => {
                if (!typeLookup[ext]) {
                    typeLookup[ext] = type;
                } else {
                    throw format('Multiple types for extension %s: %s', ext, typeLookup[ext], type);
                }
            })
        });
        // const myWritable = new stream.
    });
}
export function defaultSettings(set: ServerConfig) {
    if (!set.port) set.port = 8080;
    if (!set.host) set.host = "127.0.0.1";
    if (!set.types) set.types = {
        "htmlfile": ["htm", "html"]
    }
    if (!set.etag) set.etag = "";
    if (!set.etagWindow) set.etagWindow = 0;
    if (!set.useTW5path) set.useTW5path = false;
    if (typeof set.debugLevel !== "number") set.debugLevel = -1;

    ["allowNetwork", "allowLocalhost"].forEach((key: string) => {
        if (!set[key]) set[key] = {} as any;
        if (!set[key].mkdir) set[key].mkdir = false;
        if (!set[key].upload) set[key].upload = false;
        if (!set[key].settings) set[key].settings = false;
        if (!set[key].WARNING_all_settings_WARNING)
            set[key].WARNING_all_settings_WARNING = false;
    });

    if (!set.logColorsToFile) set.logColorsToFile = false;
    if (!set.logToConsoleAlso) set.logToConsoleAlso = false;

    if (!set.maxAge) set.maxAge = {} as any;
    if (typeof set.maxAge.tw_plugins !== "number")
        set.maxAge.tw_plugins = 60 * 60 * 24 * 365 * 1000; //1 year of milliseconds


}
export function normalizeSettings(set: ServerConfig, settingsFile) {
    const settingsDir = path.dirname(settingsFile);

    defaultSettings(set);

    if (typeof set.tree === "object")
        (function normalizeTree(item) {
            keys(item).forEach(e => {
                if (typeof item[e] === 'string') item[e] = path.resolve(settingsDir, item[e]);
                else if (typeof item[e] === 'object') normalizeTree(item[e]);
                else throw 'Invalid item: ' + e.toString() + ': ' + item[e];
            })
        })(set.tree);
    else set.tree = path.resolve(settingsDir, set.tree);

    if (set.backupDirectory) set.backupDirectory = path.resolve(settingsDir, set.backupDirectory);
    if (set.logAccess) set.logAccess = path.resolve(settingsDir, set.logAccess);
    if (set.logError) set.logError = path.resolve(settingsDir, set.logError);

    set.__dirname = settingsDir;
    set.__filename = settingsFile;

    if (set.etag === "disabled" && !set.backupDirectory)
        console.log("Etag checking is disabled, but a backup folder is not set. "
            + "Changes made in multiple tabs/windows/browsers/computers can overwrite each "
            + "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED "
            + "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can "
            + "also set the etagWindow setting to allow files to be modified if not newer than "
            + "so many seconds from the copy being saved.");

}

interface ServerEventsListener<THIS> {
    (event: "websocket-connection", listener: (client: WebSocket, request: http.IncomingMessage) => void): THIS;
    (event: "settingsChanged", listener: (keys: (keyof ServerConfig)[]) => void): THIS;
    (event: "settings", listener: (settings: ServerConfig) => void): THIS;
    (event: "stateError", listener: (state: StateObject) => void): THIS;
    (event: "stateDebug", listener: (state: StateObject) => void): THIS;
    (event: "serverClose", listener: (iface: "localhost" | "network") => void): THIS;
}
type ServerEvents = "websocket-connection" | "settingsChanged" | "settings";
export interface ServerEventEmitter extends EventEmitter {
    emit(event: "websocket-connection", client: WebSocket, request: http.IncomingMessage): boolean;
    emit(event: "settingsChanged", keys: (keyof ServerConfig)[]): boolean;
    emit(event: "settings", settings: ServerConfig): boolean;
    emit(event: "stateError", state: StateObject): boolean;
    emit(event: "stateDebug", state: StateObject): boolean;
    emit(event: "serverClose", iface: "localhost" | "network"): boolean;

    addListener: ServerEventsListener<this>;
    on: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
    once: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
    prependListener: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
    prependOnceListener: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
    removeListener: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
    removeAllListeners(event?: ServerEvents): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners(event: ServerEvents): Function[];
    eventNames(): (ServerEvents)[];
    listenerCount(type: ServerEvents): number;
}
export function getHumanSize(size: number) {
    const TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let power = 0;
    while (size >= 1024) {
        size /= 1024;
        power++;
    }
    return size.toFixed(1) + TAGS[power];
}

export type Hashmap<T> = { [K: string]: T };

export type FolderEntryType = 'folder' | 'datafolder' | 'htmlfile' | 'other' | 'error';

export interface DirectoryEntry {
    name: string,
    type: string,
    path: string,
    size: string
}

export interface Directory {
    path: string,
    entries: DirectoryEntry[]
    type: string
}


// export function tryParseJSON(str: string, errObj?: { error?: JsonError }): any;
// export function tryParseJSON(str: string, errObj?: ((e: JsonError) => T | void)): T;
/**
 * Calls the onerror handler if there is a JSON error.  
 */
export function tryParseJSON<T = any>(str: string, onerror?: ((e: JsonError) => never)): T;
export function tryParseJSON<T = any>(str: string, onerror?: ((e: JsonError) => T)): T;
export function tryParseJSON<T = any>(str: string, onerror?: ((e: JsonError) => void)): T | undefined;
export function tryParseJSON<T = any>(str: string, onerror?: ((e: JsonError) => T)): T | undefined {
    function findJSONError(message: string, json: string) {
        const res: string[] = [];
        const match = /position (\d+)/gi.exec(message);
        if (!match) return "";
        const position = +match[1];
        const lines = json.split('\n');
        let current = 1;
        let i = 0;
        for (; i < lines.length; i++) {
            current += lines[i].length + 1; //add one for the new line
            res.push(lines[i]);
            if (current > position) break;
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
    } catch (e) {
        let err = new JsonError(findJSONError(e.message, str), e)
        if (onerror) return onerror(err);
    }
}
export interface JsonErrorContainer {
    error?: JsonError
}
export class JsonError {
    public filePath: string = "";
    constructor(
        public errorPosition: string,
        public originalError: Error
    ) {

    }
}

export function keys<T>(o: T): (keyof T)[] {
    return Object.keys(o) as (keyof T)[];
}
export function padLeft(str: any, pad: number | string, padStr?: string): string {
    var item = str.toString();
    if (typeof padStr === 'undefined')
        padStr = ' ';
    if (typeof pad === 'number') {
        pad = new Array(pad + 1).join(padStr);
    }
    //pad: 000000 val: 6543210 => 654321
    return pad.substr(0, Math.max(pad.length - item.length, 0)) + item;
}
export function sortBySelector<T extends { [k: string]: string }>(key: (e: T) => any) {
    return function (a: T, b: T) {
        var va = key(a);
        var vb = key(b);

        if (va > vb)
            return 1;
        else if (va < vb)
            return -1;
        else
            return 0;
    }

}
export function sortByKey(key: string) {
    return sortBySelector(e => e[key]);
}
export namespace colors {
    export const Reset = "\x1b[0m"
    export const Bright = "\x1b[1m"
    export const Dim = "\x1b[2m"
    export const Underscore = "\x1b[4m"
    export const Blink = "\x1b[5m"
    export const Reverse = "\x1b[7m"
    export const Hidden = "\x1b[8m"

    export const FgBlack = "\x1b[30m"
    export const FgRed = "\x1b[31m"
    export const FgGreen = "\x1b[32m"
    export const FgYellow = "\x1b[33m"
    export const FgBlue = "\x1b[34m"
    export const FgMagenta = "\x1b[35m"
    export const FgCyan = "\x1b[36m"
    export const FgWhite = "\x1b[37m"

    export const BgBlack = "\x1b[40m"
    export const BgRed = "\x1b[41m"
    export const BgGreen = "\x1b[42m"
    export const BgYellow = "\x1b[43m"
    export const BgBlue = "\x1b[44m"
    export const BgMagenta = "\x1b[45m"
    export const BgCyan = "\x1b[46m"
    export const BgWhite = "\x1b[47m"
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
declare function DebugLog(level: number, str: string | NodeJS.ErrnoException, ...args: any[]);
// declare function DebugLog(str: string, ...args: any[]);
export function isError(obj): obj is Error {
    return obj.constructor === Error;
    // return [obj.message, obj.name].every(e => typeof e !== "undefined");
}
export function isErrnoException(obj: NodeJS.ErrnoException): obj is NodeJS.ErrnoException {
    return isError(obj);
}
export function DebugLogger(prefix: string, ignoreLevel?: boolean): typeof DebugLog {
    //if(prefix.startsWith("V:")) return function(){};
    return function (msgLevel: number, ...args: any[]) {
        if (!ignoreLevel && settings.debugLevel > msgLevel) return;
        if (isError(args[0])) {
            let err = args[0];
            args = [];
            if (err.stack) args.push(err.stack);
            else args.push("Error %s: %s", err.name, err.message);
        }
        let t = new Date();
        let date = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        debugOutput.write(' '
            + (msgLevel >= 3 ? (colors.BgRed + colors.FgWhite) : colors.FgRed) + prefix
            + ' ' + colors.FgCyan + date + colors.Reset
            + ' ' + format.apply(null, args).split('\n').map((e, i) => {
                if (i > 0) {
                    return new Array(23 + prefix.length).join(' ') + e;
                } else {
                    return e;
                }
            }).join('\n'), "utf8");
    } as typeof DebugLog;
}



export function sanitizeJSON(key: string, value: any) {
    // returning undefined omits the key from being serialized
    if (!key) { return value; } //This is the entire value to be serialized
    else if (key.substring(0, 1) === "$") return; //Remove angular tags
    else if (key.substring(0, 1) === "_") return; //Remove NoSQL tags
    else return value;
}

export interface ServeStaticResult {
    status: number,
    headers: {},
    message: string
}

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



export function serveFile(state: StateObject, file: string, root: string) {
    obs_stat(state)(path.join(root, file)).mergeMap(([err, stat]): any => {
        if (err) return state.throw<StateObject>(404);
        state.send({
            root,
            filepath: file,
            error: err => {
                state.log(2, '%s %s', err.status, err.message).throw(500);
            }
        });
        return Observable.empty<StateObject>();
    }).subscribe();

}
export function serveFileObs(obs: Observable<StateObject>, file: string, root: string) {
    return obs.do(state => serveFile(state, file, root)).ignoreElements();
}
export function serveFolder(state: StateObject, mount: string, root: string, serveIndex?: Function) {
    const pathname = state.url.pathname;
    if (state.url.pathname.slice(0, mount.length) !== mount) {
        state.log(2, 'URL is different than the mount point %s', mount).throw(500);
    } else {
        state.send({
            root,
            filepath: pathname.slice(mount.length),
            error: err => { state.log(-1, '%s %s', err.status, err.message).throw(404); },
            directory: (filepath) => {
                if (serveIndex) {
                    serveIndex(state, filepath);
                } else {
                    state.throw(403);
                }
            }
        })
    }
}
export function serveFolderObs(obs: Observable<StateObject>, mount: string, root: string, serveIndex?: Function) {
    return obs.do(state => serveFolder(state, mount, root, serveIndex)).ignoreElements();
}
export function serveFolderIndex(options: { type: string }) {
    function readFolder(folder: string) {
        return obs_readdir()(folder).mergeMap(([err, files]) => {
            return Observable.from(files)
        }).mergeMap(file => {
            return obs_stat(file)(path.join(folder, file));
        }).map(([err, stat, key]) => {
            let itemtype = stat.isDirectory() ? 'directory' : (stat.isFile() ? 'file' : 'other');
            return { key, itemtype };
        }).reduce((n, e) => {
            n[e.itemtype].push(e.key);
            return n;
        }, { "directory": [], "file": [] });
    }
    if (options.type === "json") {
        return function (state: StateObject, folder: string) {
            readFolder(folder).subscribe(item => {
                sendResponse(state, JSON.stringify(item), {
                    contentType: "application/json",
                    doGzip: canAcceptGzip(state.req)
                })
            })
        }
    }
}
export function canAcceptGzip(header: string | { headers: http.IncomingHttpHeaders }) {
    if (((a): a is { headers: http.IncomingHttpHeaders } => typeof a === "object")(header)) {
        header = header.headers['accept-encoding'] as string;
    }
    var gzip = header.split(',').map(e => e.split(';')).filter(e => e[0] === "gzip")[0];
    var can = !!gzip && !!gzip[1] && parseFloat(gzip[1].split('=')[1]) > 0;
    return can;
}

export function sendResponse(state: StateObject, body: Buffer | string, options: {
    doGzip?: boolean,
    contentType?: string
} = {}) {
    body = !Buffer.isBuffer(body) ? Buffer.from(body, 'utf8') : body;
    if (options.doGzip) gzip(body, (err, gzBody) => {
        if (err) _send(body, false);
        else _send(gzBody, true)
    }); else _send(body, false);

    function _send(body, isGzip) {
        state.setHeaders({
            'Content-Length': Buffer.isBuffer(body)
                ? body.length.toString()
                : Buffer.byteLength(body, 'utf8').toString(),
            'Content-Type': options.contentType || 'text/plain; charset=utf-8'
        });
        if (isGzip) state.setHeaders({ 'Content-Encoding': 'gzip' });
        state.respond(200).buffer(body);
    }

}
/**
 * Returns the keys and paths from the PathResolverResult directory. If there
 * is an error it will be sent directly to the client and nothing will be emitted. 
 * 
 * @param {PathResolverResult} result 
 * @returns 
 */
export function getTreeItemFiles(result: PathResolverResult, state: StateObject): Observable<DirectoryIndexData> {
    let dirpath = [
        result.treepathPortion.join('/'),
        result.filepathPortion.join('/')
    ].filter(e => e).join('/')
    let type = typeof result.item === "object" ? "category" : "folder";
    if (typeof result.item === "object") {
        const keys = Object.keys(result.item);
        const paths = keys.map(k => {
            return typeof result.item[k] === "string" ? result.item[k] : true;
        });
        return Observable.of({ keys, paths, dirpath, type });
    } else {
        return obs_readdir()(result.fullfilepath).map(([err, keys]) => {
            if (err) {
                state.log(2, 'Error calling readdir on folder "%s": %s', result.fullfilepath, err.message);
                state.throw(500);
                return;
            }
            const paths = keys.map(k => path.join(result.fullfilepath, k));
            return { keys, paths, dirpath, type };
        }).filter(obsTruthy);
    }
}

/// directory handler section =============================================
//I have this in a JS file so I can edit it without recompiling
const generateDirectoryListing: (...args: any[]) => string = require('./generateDirectoryListing').generateDirectoryListing;
export type DirectoryIndexData = { keys: string[], paths: (string | boolean)[], dirpath: string, type: string };
export type DirectoryIndexOptions = { upload: boolean, mkdir: boolean, format: "json" | "html", mixFolders: boolean }
export function sendDirectoryIndex([_r, options]: [DirectoryIndexData, DirectoryIndexOptions]) {
    let { keys, paths, dirpath, type } = _r;
    let pairs = keys.map((k, i) => [k, paths[i]]);
    return Observable.from(pairs).mergeMap(([key, val]: [string, string | boolean]) => {
        //if this is a category, just return the key
        if (typeof val === "boolean") return Observable.of({ key })
        //otherwise return the statPath result
        else return statPath(val).then(res => { return { stat: res, key }; });
    }).reduce((n, e: { key: string, stat?: StatPathResult }) => {
        let linkpath = [dirpath, e.key].filter(e => e).join('/');
        n.push({
            name: e.key,
            path: e.key + ((!e.stat || e.stat.itemtype === "folder") ? "/" : ""),
            type: (!e.stat ? "category" : (e.stat.itemtype === "file"
                ? typeLookup[e.key.split('.').pop() as string] || 'other'
                : e.stat.itemtype as string)),
            size: (e.stat && e.stat.stat) ? getHumanSize(e.stat.stat.size) : ""
        });
        return n;
    }, [] as DirectoryEntry[]).map(entries => {
        if (options.format === "json") {
            return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
        } else {
            return generateDirectoryListing({ path: dirpath, entries, type }, options);
        }
    });
}

/**
 * If the path 
 */
export function statWalkPath(test: PathResolverResult) {
    // let endStat = false;
    if (typeof test.item === "object")
        throw "property item must be a string";
    let endWalk = false;
    return Observable.from([test.item].concat(test.filepathPortion)).scan((n, e) => {
        return { statpath: path.join(n.statpath, e), index: n.index + 1, endStat: false };
    }, { statpath: "", index: -1, endStat: false }).concatMap(s => {
        if (endWalk) return Observable.empty<never>();
        else return Observable.fromPromise(
            statPath(s).then(res => { endWalk = endWalk || res.endStat; return res; })
        );
    }).takeLast(1);
}
/**
 * returns the info about the specified path. endstat is true if the statpath is not
 * found or if it is a directory and contains a tiddlywiki.info file, or if it is a file.
 * 
 * @param {({ statpath: string, index: number, endStat: boolean } | string)} s 
 * @returns 
 */
export function statPath(s: { statpath: string, index: number, endStat: boolean } | string) {
    if (typeof s === "string") s = { statpath: s, index: 0, endStat: false };
    const { statpath, index } = s;
    let { endStat } = s;
    if (typeof endStat !== "boolean") endStat = false;
    return new Promise<StatPathResult>(resolve => {
        // What I wish I could write (so I did)
        obs_stat(fs.stat)(statpath).chainMap(([err, stat]) => {
            if (err || stat.isFile()) endStat = true;
            if (!err && stat.isDirectory())
                return obs_stat(stat)(path.join(statpath, "tiddlywiki.info"));
            else resolve({ stat, statpath, index, endStat, itemtype: '' })
        }).concatAll().subscribe(([err2, infostat, stat]) => {
            if (!err2 && infostat.isFile()) {
                endStat = true;
                resolve({ stat, statpath, infostat, index, endStat, itemtype: '' })
            } else
                resolve({ stat, statpath, index, endStat, itemtype: '' });
        });
    }).then(res => {
        res.itemtype = getItemType(res.stat, res.infostat)
        return res;
    })
}

function getItemType(stat: Stats, infostat: Stats | undefined) {
    let itemtype;

    if (!stat) itemtype = "error";
    else if (stat.isDirectory()) itemtype = !!infostat ? "datafolder" : "folder";
    else if (stat.isFile() || stat.isSymbolicLink()) itemtype = "file"
    else itemtype = "error"

    return itemtype;

}

export function resolvePath(state: StateObject | string[], tree: TreeObject): PathResolverResult | undefined {
    var reqpath;
    if (Array.isArray(state)) {
        reqpath = state;
    } else {
        reqpath = state.path;
    }

    reqpath = decodeURI(reqpath.slice().filter(a => a).join('/')).split('/').filter(a => a);

    //if we're at root, just return it
    if (reqpath.length === 0) return {
        item: tree,
        reqpath,
        treepathPortion: [],
        filepathPortion: [],
        fullfilepath: typeof tree === "string" ? tree : ''
    }
    //check for invalid items (such as ..)
    if (!reqpath.every(a => a !== ".." && a !== ".")) return;

    var result = (function () {
        var item: any = tree;
        var folderPathFound = false;
        for (var end = 0; end < reqpath.length; end++) {
            if (typeof item !== 'string' && typeof item[reqpath[end]] !== 'undefined') {
                item = item[reqpath[end]];
            } else if (typeof item === "string") {
                folderPathFound = true; break;
            } else break;
        }
        return { item, end, folderPathFound } as TreePathResult;
    })();

    if (reqpath.length > result.end && !result.folderPathFound) return;

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
        fullfilepath
    };
}

type NodeCallback<T, S> = [NodeJS.ErrnoException, T, S];


// export function obs<S>(state?: S) {
//     return Observable.bindCallback(fs.stat, (err, stat): NodeCallback<fs.Stats, S> => [err, stat, state] as any);
// }
export type obs_stat_result<T> = [NodeJS.ErrnoException, fs.Stats, T, string]
export const obs_stat = <T = undefined>(tag: T = undefined as any) =>
    (filepath: string) => new Observable<obs_stat_result<T>>(subs => {
        fs.stat(filepath, (err, data) => {
            subs.next([err, data, tag, filepath]);
            subs.complete();
        })
    })

export type obs_readdir_result<T> = [NodeJS.ErrnoException, string[], T, string]
export const obs_readdir = <T>(tag: T = undefined as any) =>
    (filepath: string) => new Observable<obs_readdir_result<T>>(subs => {
        fs.readdir(filepath, (err, data) => {
            subs.next([err, data, tag, filepath]);
            subs.complete();
        })
    })

export type obs_readFile_result<T> = typeof obs_readFile_inner
export const obs_readFile = <T>(tag: T = undefined as any): obs_readFile_result<T> =>
    (filepath: string, encoding?: string) =>
        new Observable(subs => {
            const cb = (err, data) => {
                subs.next([err, data, tag, filepath]);
                subs.complete();
            }
            if (encoding)
                fs.readFile(filepath, encoding, cb);
            else
                fs.readFile(filepath, cb)
        }) as any;

declare function obs_readFile_inner<T>(filepath: string): Observable<[NodeJS.ErrnoException, Buffer, T, string]>;
declare function obs_readFile_inner<T>(filepath: string, encoding: string): Observable<[NodeJS.ErrnoException, string, T, string]>;


// export type obs_writeFile_result<T> = typeof obs_readFile_inner
export const obs_writeFile = <T>(tag: T = undefined as any) =>
    (filepath: string, data: any) => new Observable<[NodeJS.ErrnoException | undefined, T, string]>(subs =>
        fs.writeFile(filepath, data, (err) => {
            subs.next([err, tag, filepath]);
            subs.complete();
        })
    );
export function fs_move(oldPath, newPath, callback) {

    fs.rename(oldPath, newPath, function (err) {
        if (err) {
            if (err.code === 'EXDEV') {
                copy();
            } else {
                callback(err);
            }
            return;
        }
        callback();
    });

    function copy() {
        var readStream = fs.createReadStream(oldPath);
        var writeStream = fs.createWriteStream(newPath);

        readStream.on('error', callback);
        writeStream.on('error', callback);

        readStream.on('close', function () {
            fs.unlink(oldPath, callback);
        });

        readStream.pipe(writeStream);
    }
}


// export const obs_writeFile = <T>(state?: T) => Observable.bindCallback(
//     fs.writeFile, (err, data): NodeCallback<string | Buffer, T> => [err, data, state] as any);


export class StateError extends Error {
    state: StateObject;
    constructor(state: StateObject, message: string) {
        super(message);
        this.state = state;
    }
}
export type StatPathResult = {
    stat: fs.Stats,
    statpath: string,
    infostat?: fs.Stats,
    index: number,
    /**
     * error, folder, datafolder, file
     * 
     * @type {string}
     */
    itemtype: string,
    /**
     * either the path does not exist or it is a data folder
     * 
     * @type {boolean}
     */
    endStat: boolean
}
// export interface 
// export type LoggerFunc = (str: string, ...args: any[]) => void;
export class URLSearchParams {
    constructor(str: string) {

    }
}
export interface StateObjectUrl {
    path: string,
    pathname: string,
    query: Hashmap<string>,
    search: string,
    href: string
}

export class StateObject {
    static parseURL(str: string): StateObjectUrl {
        let item = url.parse(str, true);
        let { path, pathname, query, search, href } = item;
        if (!path) path = "";
        if (!pathname) pathname = "";
        if (!query) query = {};
        if (!search) search = "";
        if (!href) href = "";
        return { path, pathname, query, search, href };
    }
    static errorRoute(status: number, reason?: string) {
        return (obs: Observable<any>): any => {
            return obs.mergeMap((state: StateObject) => {
                if (reason)
                    return state.throwReason(status, reason);
                else
                    return state.throw(status);
            })
        }
    }

    get allow(): ServerConfig_AccessOptions {
        switch (this.trustLevel) {
            case "trusted": return {
                mkdir: true,
                settings: true,
                upload: true,
                WARNING_all_settings_WARNING: true,
                writeErrors: true
            };
            case "localhost": return settings.allowLocalhost;
            case "network": return settings.allowNetwork;
        }
    }

    // req: http.IncomingMessage;
    // res: http.ServerResponse;
    startTime: [number, number];
    timestamp: string;

    body: string;
    json: any | undefined;

    statPath: StatPathResult;

    url: StateObjectUrl;

    path: string[];

    maxid: number;

    where: string;
    query: any;
    errorThrown: Error;

    restrict: any;

    expressNext: ((err?: any) => void) | false;

    // req: {
    //     url: string;
    //     headers: { [K: string]: any; };
    //     method: string;
    //     pipe: Stream["pipe"]
    // }
    // res(
    //     statusCode: number,
    //     body: string | Buffer,
    //     headers: Hashmap<string>,
    //     isBase64Encoded: boolean
    // ) {

    // }

    req: http.IncomingMessage;
    res: http.ServerResponse;

    responseHeaders: http.OutgoingHttpHeaders = {};
    responseSent: boolean = false;

    constructor(
        private _req: http.IncomingMessage,
        private _res: http.ServerResponse,
        private debugLog: typeof DebugLog,
        private eventer: ServerEventEmitter,
        public readonly trustLevel: "trusted" | "localhost" | "network" = "network"
    ) {
        this.startTime = process.hrtime();
        this.req = _req;
        this.res = _res;
        // this.req = {
        //     method: _req.method as string,
        //     url: _req.url as string,
        //     headers: _req.headers,
        //     pipe: _req.pipe.bind(_req)
        // }
        //parse the url and store in state.
        this.url = StateObject.parseURL(this.req.url as string);
        //parse the path for future use
        this.path = (this.url.pathname as string).split('/')

        let t = new Date();
        this.timestamp = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        const interval = setInterval(() => {
            this.log(-2, 'LONG RUNNING RESPONSE');
            this.log(-2, '%s %s ', this.req.method, this.req.url);
        }, 60000);
        _res.on('finish', () => {
            clearInterval(interval);
            if (this.hasCriticalLogs)
                this.eventer.emit('stateError', this);
            else
                this.eventer.emit("stateDebug", this);
        })
    }
    // debug(str: string, ...args: any[]) {
    //     this.debugLog('[' +
    //         this.req.socket.remoteFamily + '-' + colors.FgMagenta +
    //         this.req.socket.remoteAddress + colors.Reset + '] ' +
    //         format.apply(null, arguments)
    //     );
    // }

    loglevel: number = DEBUGLEVEL;
    doneMessage: string[] = [];
    hasCriticalLogs: boolean = false;
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
    log(level: number, ...args: any[]) {
        if (level < this.loglevel) return this;
        if (level > 1) this.hasCriticalLogs = true;
        this.doneMessage.push(format.apply(null, args));
        return this;
    }
    // error() {
    //     this.errorThrown = new Error(this.doneMessage.join('\n'));
    //     this.errorThrown.name = "StateObjectError";
    //     return this;
    // }
    /** 
     * if the client is allowed to recieve error info, sends `message`, otherwise sends `reason`.
     * `reason` is always sent as the status header.
     */
    throwError<T = StateObject>(statusCode: number, error: ER, headers?: Hashmap<string>) {
        return this.throwReason(statusCode, this.allow.writeErrors ? error.message : error.reason, headers);
    }
    throwReason<T = StateObject>(statusCode: number, reason: string, headers?: Hashmap<string>) {
        if (!this.responseSent) {
            var res = this.respond(statusCode, reason, headers)
            //don't write 204 reason
            if (statusCode !== 204 && reason) res.string(reason.toString());
        }
        return Observable.empty<T>();
    }
    throw<T = StateObject>(statusCode: number, headers?: Hashmap<string>) {
        if (!this.responseSent) {
            if (headers) this.setHeaders(headers);
            this.respond(statusCode).empty();
        }
        return Observable.empty<T>();
    }
    setHeader(key: string, val: string) {
        this.responseHeaders[key] = val;
    }
    setHeaders(headers: http.OutgoingHttpHeaders) {
        Object.assign(this.responseHeaders, headers);
    }
    respond(code: number, message?: string, headers?: http.OutgoingHttpHeaders) {
        if (headers) this.setHeaders(headers);
        if (!message) message = http.STATUS_CODES[code];
        if(settings._devmode) setTimeout(() => {
            if (!this.responseSent)
                this.debugLog(3, "Response not sent \n %s", new Error().stack);
        }, 0);
        var subthis = {
            json: (data: any) => {
                subthis.string(JSON.stringify(data));
            },
            string: (data: string) => {
                subthis.buffer(Buffer.from(data, 'utf8'));
            },
            stream: (data: Stream) => {
                this._res.writeHead(code, message, this.responseHeaders);
                data.pipe(this._res);
                this.responseSent = true;
            },
            buffer: (data: Buffer) => {
                this._res.writeHead(code, message, this.responseHeaders);
                this._res.write(data);
                this._res.end();
                this.responseSent = true;
            },
            empty: () => {
                this._res.writeHead(code, message, this.responseHeaders);
                this._res.end();
                this.responseSent = true;
            }
        }
        return subthis;
    }

    redirect(redirect: string) {
        this.respond(302, "", {
            'Location': redirect
        }).empty();
    }
    send(options: {
        root: string;
        filepath: string;
        error?: (err: any) => void;
        directory?: (filepath: string) => void;
        headers?: (filepath: string) => http.OutgoingHttpHeaders;
    }) {
        const { filepath, root, error, directory, headers } = options;
        const sender = send(this._req, filepath, { root });
        if (error)
            sender.on('error', options.error);
        if (directory)
            sender.on('directory', (res: http.ServerResponse, fp) => directory(fp));
        if (headers)
            sender.on('headers', (res: http.ServerResponse, fp) => {
                const hdrs = headers(fp);
                Object.keys(hdrs).forEach(e => {
                    let item = hdrs[e];
                    if (item) res.setHeader(e, item.toString());
                })
            });
        sender.pipe(this._res);
    }
    /**
     * Recieves the body of the request and stores it in body and json. If there is an
     * error parsing body as json, the error callback will be called or if the callback
     * is boolean true it will send an error response with the json error position.
     * 
     * @param {(true | ((e: JsonError) => void))} errorCB sends an error response 
     * showing the incorrect JSON syntax if true, or calls the function
     * @returns {Observable<StateObject>}
     * @memberof StateObject
     */
    recieveBody(errorCB?: true | ((e: JsonError) => void)) {

        return Observable.fromEvent<Buffer>(this._req, 'data')
            //only take one since we only need one. this will dispose the listener
            .takeUntil(Observable.fromEvent(this._req, 'end').take(1))
            //accumulate all the chunks until it completes
            .reduce<Buffer>((n, e) => { n.push(e); return n; }, [])
            //convert to json and return state for next part
            .map(e => {
                this.body = Buffer.concat(e).toString('utf8');
                //console.log(state.body);
                if (this.body.length === 0)
                    return this;

                let catchHandler = errorCB === true ? (e: JsonError) => {
                    this.respond(400, "", {
                        "Content-Type": "text/plain"
                    }).string(e.errorPosition);
                } : errorCB;

                this.json = tryParseJSON<any>(this.body, catchHandler);
                return this;
            });
    }

}

export class ER extends Error {
    constructor(public reason: string, message: string) {
        super(message);
    }
}
/** to be used with concatMap, mergeMap, etc. */
export function recieveBody(state: StateObject, sendError?: true | ((e: JsonError) => void)) {
    //get the data from the request
    return state.recieveBody(sendError);

}
export interface ThrowFunc<T> {
    throw(statusCode: number, reason?: string, str?: string, ...args: any[]): Observable<T>;
}
export interface ServerConfig_AccessOptions {
    writeErrors: boolean
    upload: boolean
    mkdir: boolean
    settings: boolean
    WARNING_all_settings_WARNING: boolean
}
export interface ServerConfig {
    __dirname: string;
    __filename: string;
    __assetsDir: string;
    _disableLocalHost: boolean;
    _devmode: boolean;
    tree: any,
    types: {
        htmlfile: string[];
        [K: string]: string[]
    }
    username?: string,
    password?: string,
    host: string,
    port: number | 8080,
    backupDirectory?: string,
    etag: "required" | "disabled" | "", //otherwise if present
    etagWindow: number,
    useTW5path: boolean,
    debugLevel: number,
    allowNetwork: ServerConfig_AccessOptions,
    allowLocalhost: ServerConfig_AccessOptions,
    logAccess: string | false,
    logError: string,
    logColorsToFile: boolean,
    logToConsoleAlso: boolean;
    /** cache max age in milliseconds for different types of data */
    maxAge: { tw_plugins: number }
    tsa: { alwaysRefreshCache: boolean; },
    mixFolders: boolean;
}

export interface AccessPathResult<T> {
    isFullpath: boolean,
    type: string | NodeJS.ErrnoException,
    tag: T,
    end: number,
    statItem: fs.Stats,
    statTW?: fs.Stats
};
export interface AccessPathTag {
    state: StateObject,
    item: string | {},
    treepath: string,
    filepath: string
};
export interface PathResolverResult {
    //the tree string returned from the path resolver
    item: string | TreeObject;
    // client request url path
    reqpath: string[];
    // tree part of request url
    treepathPortion: string[];
    // file part of request url
    filepathPortion: string[];
    // item + filepath if item is a string
    fullfilepath: string;
    // state: StateObject;
}
export type TreeObject = { [K: string]: string | TreeObject };
export type TreePathResultObject<T, U, V> = { item: T, end: U, folderPathFound: V }
export type TreePathResult =
    TreePathResultObject<TreeObject, number, false>
    | TreePathResultObject<string, number, false>
    | TreePathResultObject<string, number, true>;
export function createHashmapString<T>(keys: string[], values: T[]): { [id: string]: T } {
    if (keys.length !== values.length)
        throw 'keys and values must be the same length';
    var obj: { [id: string]: T } = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    })
    return obj;
}
export function createHashmapNumber<T>(keys: number[], values: T[]): { [id: number]: T } {
    if (keys.length !== values.length)
        throw 'keys and values must be the same length';
    var obj: { [id: number]: T } = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    })
    return obj;
}

export function obsTruthy<T>(a: T | undefined | null | false | "" | 0 | void): a is T {
    return !!a;
}

const ERRORS = {
    'PROGRAMMER_EXCEPTION': 'A programmer exception occurred: %s'
}

export function getError(code: 'PRIMARY_KEYS_REQUIRED'): any;
export function getError(code: 'OLD_REVISION'): any;
export function getError(code: 'KEYS_REQUIRED', keyList: string): any;
export function getError(code: 'ROW_NOT_FOUND', table: string, id: string): any;
export function getError(code: 'PROGRAMMER_EXCEPTION', message: string): any;
export function getError(code: string, ...args: string[]): any;
export function getError(...args: string[]) {
    let code = args.shift() as keyof typeof ERRORS;
    if (ERRORS[code]) args.unshift(ERRORS[code])
    //else args.unshift(code);
    return { code: code, message: format.apply(null, args) };
}


