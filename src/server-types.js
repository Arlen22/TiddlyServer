"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const rx_1 = require("../lib/rx");
//import { StateObject } from "./index";
const bundled_lib_1 = require("../lib/bundled-lib");
const fs_1 = require("fs");
const zlib_1 = require("zlib");
const stream_1 = require("stream");
const os_1 = require("os");
const ipcalc = require("./ipcalc");
const server_config_1 = require("./server-config");
exports.normalizeSettings = server_config_1.normalizeSettings;
exports.ConvertSettings = server_config_1.ConvertSettings;
exports.Config = server_config_1.Config;
let DEBUGLEVEL = -1;
let settings;
const colorsRegex = /\x1b\[[0-9]+m/gi;
let debugOutput = new stream_1.Writable({
    write: function (chunk, encoding, callback) {
        // if we're given a buffer, convert it to a string
        if (Buffer.isBuffer(chunk))
            chunk = chunk.toString('utf8');
        // remove ending linebreaks for consistency
        chunk = chunk.slice(0, chunk.length - (chunk.endsWith("\r\n") ? 2 : +chunk.endsWith("\n")));
        if (settings.logging.logError) {
            fs_1.appendFileSync(settings.logging.logError, (settings.logging.logColorsToFile ? chunk : chunk.replace(colorsRegex, "")) + "\r\n", { encoding: "utf8" });
        }
        if (!settings.logging.logError || settings.logging.logToConsoleAlso) {
            console.log(chunk);
        }
        callback && callback();
        return true;
    }
});
;
function init(eventer) {
    eventer.on('settings', function (set) {
        // DEBUGLEVEL = set.debugLevel;
        settings = set;
        exports.typeLookup = {};
        Object.keys(set.directoryIndex.icons).forEach(type => {
            set.directoryIndex.icons[type].forEach(ext => {
                if (!exports.typeLookup[ext]) {
                    exports.typeLookup[ext] = type;
                }
                else {
                    throw util_1.format('Multiple types for extension %s: %s', ext, exports.typeLookup[ext], type);
                }
            });
        });
        // const myWritable = new stream.
    });
}
exports.init = init;
// export type ServerConfig = NewConfig;
// export type ServerConfigSchema = NewConfigSchema;
const assets = path.resolve(__dirname, '../assets');
const favicon = path.resolve(__dirname, '../assets/favicon.ico');
const stylesheet = path.resolve(__dirname, '../assets/directory.css');
function loadSettings(settingsFile, routeKeys) {
    console.log("Settings file: %s", settingsFile);
    const settingsString = fs.readFileSync(settingsFile, 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
    let settingsObjSource = tryParseJSON(settingsString, (e) => {
        console.error(/*colors.BgWhite + */ colors.FgRed + "The settings file could not be parsed: %s" + colors.Reset, e.originalError.message);
        console.error(e.errorPosition);
        throw "The settings file could not be parsed: Invalid JSON";
    });
    if (!settingsObjSource.$schema)
        throw "The settings file needs to be upgraded to v2.1, please run > node upgrade-settings.js old new";
    var schemaChecker = new bundled_lib_1.ajv({ allErrors: true, async: false });
    schemaChecker.addMetaSchema(require('../lib/json-schema-refs/json-schema-draft-06.json'));
    var validate = schemaChecker.compile(require(path.resolve(path.dirname(settingsFile), settingsObjSource.$schema)));
    var valid = validate(settingsObjSource, "settings");
    var validationErrors = validate.errors;
    if (!valid)
        console.log(validationErrors && validationErrors.map(e => [e.keyword.toUpperCase() + ":", e.dataPath, e.message].join(' ')).join('\n'));
    if (!settingsObjSource.tree)
        throw "tree is not specified in the settings file";
    // let routeKeys = Object.keys(routes);
    let settingshttps = settingsObjSource.bindInfo && settingsObjSource.bindInfo.https;
    let settingsObj = server_config_1.normalizeSettings(settingsObjSource, settingsFile);
    settingsObj.__assetsDir = assets;
    if (typeof settingsObj.tree === "object") {
        let keys = [];
        settingsObj.tree;
        let conflict = keys.filter(k => routeKeys.indexOf(k) > -1);
        if (conflict.length)
            console.log("The following tree items are reserved for use by TiddlyServer: %s", conflict.map(e => '"' + e + '"').join(', '));
    }
    //remove the https settings and return them separately
    return { settings: settingsObj, settingshttps };
}
exports.loadSettings = loadSettings;
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
function tryParseJSON(str, onerror) {
    function findJSONError(message, json) {
        console.log(message);
        const res = [];
        const match = /at (\d+):(\d+)/gi.exec(message);
        if (!match)
            return "";
        const position = [+match[1], +match[2]];
        const lines = json.split('\n');
        res.push(...lines.slice(0, position[0]));
        res.push(new Array(position[1]).join('-') + '^  ' + message);
        res.push(...lines.slice(position[0]));
        return res.join('\n');
    }
    str = str.replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
    try {
        return bundled_lib_1.JSON5.parse(str);
    }
    catch (e) {
        let err = new JsonError(findJSONError(e.message, str), e);
        if (onerror)
            return onerror(err);
    }
}
exports.tryParseJSON = tryParseJSON;
class JsonError {
    constructor(
    /** The full JSON string showing the position of the error */
    errorPosition, 
    /** The original error return by JSON.parse */
    originalError) {
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
    return !!obj && obj.constructor === Error;
    // return [obj.message, obj.name].every(e => typeof e !== "undefined");
}
exports.isError = isError;
function isErrnoException(obj) {
    return isError(obj);
}
exports.isErrnoException = isErrnoException;
function DebugLogger(prefix, ignoreLevel) {
    //if(prefix.startsWith("V:")) return function(){};
    return function (msgLevel, tempString, ...args) {
        if (!ignoreLevel && settings.logging.debugLevel > msgLevel)
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
        debugOutput.write(' '
            + (msgLevel >= 3 ? (colors.BgRed + colors.FgWhite) : colors.FgRed) + prefix
            + ' ' + colors.FgCyan + date + colors.Reset
            + ' ' + util_1.format.apply(null, [tempString, ...args]).split('\n').map((e, i) => {
            if (i > 0) {
                return new Array(23 + prefix.length).join(' ') + e;
            }
            else {
                return e;
            }
        }).join('\n'), "utf8");
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
function serveFile(state, file, root) {
    exports.obs_stat(state)(root ? path.join(root, file) : file).mergeMap(([err, stat]) => {
        if (err)
            return state.throw(404);
        state.send({
            root,
            filepath: file,
            error: err => {
                state.log(2, '%s %s', err.status, err.message).throw(500);
            }
        });
        return rx_1.Observable.empty();
    }).subscribe();
}
exports.serveFile = serveFile;
function serveFileObs(obs, file, root) {
    return obs.do(state => serveFile(state, file, root)).ignoreElements();
}
exports.serveFileObs = serveFileObs;
function serveFolder(state, mount, root, serveIndex) {
    const pathname = state.url.pathname;
    if (state.url.pathname.slice(0, mount.length) !== mount) {
        state.log(2, 'URL is different than the mount point %s', mount).throw(500);
    }
    else {
        state.send({
            root,
            filepath: pathname.slice(mount.length),
            error: err => { state.log(-1, '%s %s', err.status, err.message).throw(404); },
            directory: (filepath) => {
                if (serveIndex) {
                    serveIndex(state, filepath);
                }
                else {
                    state.throw(403);
                }
            }
        });
    }
}
exports.serveFolder = serveFolder;
function serveFolderObs(obs, mount, root, serveIndex) {
    return obs.do(state => serveFolder(state, mount, root, serveIndex)).ignoreElements();
}
exports.serveFolderObs = serveFolderObs;
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
        return function (state, folder) {
            readFolder(folder).subscribe(item => {
                sendResponse(state, JSON.stringify(item), {
                    contentType: "application/json",
                    doGzip: canAcceptGzip(state.req)
                });
            });
        };
    }
}
exports.serveFolderIndex = serveFolderIndex;
function canAcceptGzip(header) {
    if (((a) => typeof a === "object")(header)) {
        header = header.headers['accept-encoding'];
    }
    var gzip = header.split(',').map(e => e.split(';')).filter(e => e[0] === "gzip")[0];
    var can = !!gzip && !!gzip[1] && parseFloat(gzip[1].split('=')[1]) > 0;
    return can;
}
exports.canAcceptGzip = canAcceptGzip;
function sendResponse(state, body, options = {}) {
    body = !Buffer.isBuffer(body) ? Buffer.from(body, 'utf8') : body;
    if (options.doGzip)
        zlib_1.gzip(body, (err, gzBody) => {
            if (err)
                _send(body, false);
            else
                _send(gzBody, true);
        });
    else
        _send(body, false);
    function _send(body, isGzip) {
        state.setHeaders({
            'Content-Length': Buffer.isBuffer(body)
                ? body.length.toString()
                : Buffer.byteLength(body, 'utf8').toString(),
            'Content-Type': options.contentType || 'text/plain; charset=utf-8'
        });
        if (isGzip)
            state.setHeaders({ 'Content-Encoding': 'gzip' });
        state.respond(200).buffer(body);
    }
}
exports.sendResponse = sendResponse;
/**
 * Returns the keys and paths from the PathResolverResult directory. If there
 * is an error it will be sent directly to the client and nothing will be emitted.
 *
 * @param {PathResolverResult} result
 * @returns
 */
function getTreePathFiles(result, state) {
    let dirpath = [
        result.treepathPortion.join('/'),
        result.filepathPortion.join('/')
    ].filter(e => e).join('/');
    const type = server_config_1.Config.isGroup(result.item) ? "group" : "folder";
    if (server_config_1.Config.isGroup(result.item)) {
        let $c = result.item.$children;
        const keys = $c.map(e => e.key);
        // const keys = Object.keys(result.item);
        const paths = $c.map(e => server_config_1.Config.isPath(e) ? e.path : true);
        return rx_1.Observable.of({ keys, paths, dirpath, type: type });
    }
    else {
        return exports.obs_readdir()(result.fullfilepath).map(([err, keys]) => {
            if (err) {
                state.log(2, 'Error calling readdir on folder "%s": %s', result.fullfilepath, err.message);
                state.throw(500);
                return;
            }
            const paths = keys.map(k => path.join(result.fullfilepath, k));
            return { keys, paths, dirpath, type: type };
        }).filter(obsTruthy);
    }
}
exports.getTreePathFiles = getTreePathFiles;
// /**
//  * Returns the keys and paths from the PathResolverResult directory. If there
//  * is an error it will be sent directly to the client and nothing will be emitted. 
//  * 
//  * @param {PathResolverResult} result 
//  * @returns 
//  */
// export function getTreeItemFiles(result: PathResolverResult, state: StateObject): Observable<DirectoryIndexData> {
// 	let dirpath = [
// 		result.treepathPortion.join('/'),
// 		result.filepathPortion.join('/')
// 	].filter(e => e).join('/')
// 	let type = typeof result.item === "object" ? "group" : "folder";
// 	if (typeof result.item === "object") {
// 		const keys = Object.keys(result.item);
// 		const paths = keys.map(k => 
// 			typeof result.item[k] === "string" ? result.item[k] : true
// 		);
// 		return Observable.of({ keys, paths, dirpath, type });
// 	} else {
// 		return obs_readdir()(result.fullfilepath).map(([err, keys]) => {
// 			if (err) {
// 				state.log(2, 'Error calling readdir on folder "%s": %s', result.fullfilepath, err.message);
// 				state.throw(500);
// 				return;
// 			}
// 			const paths = keys.map(k => path.join(result.fullfilepath, k));
// 			return { keys, paths, dirpath, type };
// 		}).filter(obsTruthy);
// 	}
// }
/// directory handler section =============================================
//I have this in a JS file so I can edit it without recompiling
const generateDirectoryListing = require('./generateDirectoryListing').generateDirectoryListing;
function sendDirectoryIndex([_r, options]) {
    let { keys, paths, dirpath, type } = _r;
    let pairs = keys.map((k, i) => [k, paths[i]]);
    return Promise.all(pairs.map(e => {
        let [key, val] = e;
        if (typeof val === "boolean")
            return Promise.resolve({ key, stat: undefined });
        else
            return statPath(val).then(res => ({ stat: res, key }));
    })).then(paths => {
        let entries = paths.map((e) => {
            let linkpath = [dirpath, e.key].filter(e => e).join('/');
            return {
                name: e.key,
                path: e.key + ((!e.stat || e.stat.itemtype === "folder") ? "/" : ""),
                type: (!e.stat ? "group" : (e.stat.itemtype === "file"
                    ? exports.typeLookup[e.key.split('.').pop()] || 'other'
                    : e.stat.itemtype)),
                size: (e.stat && e.stat.stat) ? getHumanSize(e.stat.stat.size) : ""
            };
        });
        if (options.format === "json") {
            return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
        }
        else {
            let def = { path: dirpath, entries, type };
            return generateDirectoryListing(def, options);
        }
    });
    // return Observable.from(pairs).mergeMap(([key, val]: [string, string | boolean]) => {
    // 	//if this is a group, just return the key
    // 	if (typeof val === "boolean") return Observable.of({ key })
    // 	//otherwise return the statPath result
    // 	else return statPath(val).then(res => { return { stat: res, key }; });
    // }).reduce((n, e: { key: string, stat?: StatPathResult }) => {
    // 	let linkpath = [dirpath, e.key].filter(e => e).join('/');
    // 	n.push({
    // 		name: e.key,
    // 		path: e.key + ((!e.stat || e.stat.itemtype === "folder") ? "/" : ""),
    // 		type: (!e.stat ? "group" : (e.stat.itemtype === "file"
    // 			? typeLookup[e.key.split('.').pop() as string] || 'other'
    // 			: e.stat.itemtype as string)),
    // 		size: (e.stat && e.stat.stat) ? getHumanSize(e.stat.stat.size) : ""
    // 	});
    // 	return n;
    // }, [] as DirectoryEntry[]).map(entries => {
    // 	if (options.format === "json") {
    // 		return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
    // 	} else {
    // 		let def = { path: dirpath, entries, type }
    // 		return generateDirectoryListing(def, options);
    // 	}
    // });
}
exports.sendDirectoryIndex = sendDirectoryIndex;
/**
 * If the path
 */
function statWalkPath(test) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!server_config_1.Config.isPath(test.item)) {
            console.log(test.item);
            throw "property item must be a TreePath";
        }
        let n = { statpath: "", index: -1, endStat: false };
        let stats = [test.item.path, ...test.filepathPortion].map((e) => {
            return (n = { statpath: path.join(n.statpath, e), index: n.index + 1, endStat: false });
        });
        while (true) {
            let s = stats.shift();
            /* should never be undefined because we always do at least
             * 1 loop and then exit if stats.length is 0 */
            if (!s)
                throw new Error("PROGRAMMER ERROR");
            let res = yield statPath(s);
            if (res.endStat || stats.length === 0)
                return res;
        }
        // return res;
        // return Observable.from([test.item.path].concat(test.filepathPortion)).scan((n, e) => {
        // 	return { statpath: path.join(n.statpath, e), index: n.index + 1, endStat: false };
        // }, { statpath: "", index: -1, endStat: false }).concatMap(s => {
        // 	if (endWalk) return Observable.empty<never>();
        // 	else return Observable.fromPromise(
        // 		statPath(s).then(res => { endWalk = endWalk || res.endStat; return res; })
        // 	);
        // }).takeLast(1);
    });
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
    return (function () {
        return __awaiter(this, void 0, void 0, function* () {
            let [err, stat] = yield exports.obs_stat(fs.stat)(statpath).toPromise();
            if (!err && stat.isDirectory()) {
                let [err2, infostat] = yield exports.obs_stat(stat)(path.join(statpath, "tiddlywiki.info")).toPromise();
                let exists = !err2 && infostat.isFile();
                if (exists)
                    endStat = true;
                return ({ stat, statpath, infostat: exists ? infostat : undefined, index, endStat, itemtype: '' });
            }
            else {
                if (err || stat.isFile())
                    endStat = true;
                return ({ stat, statpath, index, endStat, itemtype: '' });
            }
        });
    })().then(res => {
        res.itemtype = getItemType(res.stat, res.infostat);
        return res;
    });
    /*
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
    */
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
function treeWalker(tree, reqpath) {
    function getAncesterEntry(a) {
        return Object.assign({}, a, { $children: undefined });
    }
    var item = tree;
    var ancestry = [];
    var folderPathFound = server_config_1.Config.isPath(item);
    for (var end = 0; end < reqpath.length; end++) {
        if (server_config_1.Config.isPath(item)) {
            folderPathFound = true;
            break;
        }
        let t = item.$children.find((e) => (server_config_1.Config.isGroup(e) || server_config_1.Config.isPath(e)) && e.key === reqpath[end]);
        if (t) {
            ancestry.push(item);
            item = t;
        }
        else {
            break;
        }
    }
    return { item, end, folderPathFound, ancestry };
}
exports.treeWalker = treeWalker;
// export function treeWalkerOld(tree, reqpath) {
// 	var item: NewTreeItem = tree;
// 	var folderPathFound = false;
// 	for (var end = 0; end < reqpath.length; end++) {
// 		if (typeof item !== 'string' && typeof item[reqpath[end]] !== 'undefined') {
// 			item = item[reqpath[end]];
// 		} else if (typeof item === "string") {
// 			folderPathFound = true; break;
// 		} else break;
// 	}
// 	return { item, end, folderPathFound };
// }
function resolvePath(state, tree) {
    var reqpath;
    if (Array.isArray(state)) {
        reqpath = state;
    }
    else {
        reqpath = state.path;
    }
    reqpath = decodeURI(reqpath.slice().filter(a => a).join('/')).split('/').filter(a => a);
    //if we're at root, just return it
    // if (reqpath.length === 0) return {
    // 	item: tree,
    // 	ancestry: [],
    // 	reqpath,
    // 	treepathPortion: [],
    // 	filepathPortion: [],
    // 	fullfilepath: isNewTreePath(tree) ? tree.path : ''
    // }
    //check for invalid items (such as ..)
    if (!reqpath.every(a => a !== ".." && a !== "."))
        return;
    var result = treeWalker(tree, reqpath);
    if (reqpath.length > result.end && !result.folderPathFound)
        return;
    //get the remainder of the path
    let filepathPortion = reqpath.slice(result.end).map(a => a.trim());
    const fullfilepath = (result.folderPathFound)
        ? path.join(result.item.path, ...filepathPortion)
        : (server_config_1.Config.isPath(result.item) ? result.item.path : '');
    return {
        item: result.item,
        ancestry: result.ancestry,
        treepathPortion: reqpath.slice(0, result.end),
        filepathPortion,
        reqpath, fullfilepath
    };
}
exports.resolvePath = resolvePath;
exports.obs_stat = (tag = undefined) => (filepath) => new rx_1.Observable(subs => {
    fs.stat(filepath, (err, data) => {
        subs.next([err, data, tag, filepath]);
        subs.complete();
    });
});
exports.obs_readdir = (tag = undefined) => (filepath) => new rx_1.Observable(subs => {
    fs.readdir(filepath, (err, data) => {
        subs.next([err, data, tag, filepath]);
        subs.complete();
    });
});
exports.obs_readFile = (tag = undefined) => (filepath, encoding) => new rx_1.Observable(subs => {
    const cb = (err, data) => {
        subs.next([err, data, tag, filepath]);
        subs.complete();
    };
    if (encoding)
        fs.readFile(filepath, encoding, cb);
    else
        fs.readFile(filepath, cb);
});
// export type obs_writeFile_result<T> = typeof obs_readFile_inner
exports.obs_writeFile = (tag = undefined) => (filepath, data) => new rx_1.Observable(subs => fs.writeFile(filepath, data, (err) => {
    subs.next([err, tag, filepath]);
    subs.complete();
}));
function fs_move(oldPath, newPath, callback) {
    fs.rename(oldPath, newPath, function (err) {
        if (err) {
            if (err.code === 'EXDEV') {
                copy();
            }
            else {
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
exports.fs_move = fs_move;
// export const obs_writeFile = <T>(state?: T) => Observable.bindCallback(
//     fs.writeFile, (err, data): NodeCallback<string | Buffer, T> => [err, data, state] as any);
class StateError extends Error {
    constructor(state, message) {
        super(message);
        this.state = state;
    }
}
exports.StateError = StateError;
// export interface 
// export type LoggerFunc = (str: string, ...args: any[]) => void;
class URLSearchParams {
    constructor(str) {
    }
}
exports.URLSearchParams = URLSearchParams;
class StateObject {
    constructor(_req, _res, debugLog, eventer, hostLevelPermissionsKey, authAccountsKey, 
    /** The HostElement array index in settings.tree */
    treeHostIndex, username, settings) {
        this._req = _req;
        this._res = _res;
        this.debugLog = debugLog;
        this.eventer = eventer;
        this.hostLevelPermissionsKey = hostLevelPermissionsKey;
        this.authAccountsKey = authAccountsKey;
        this.treeHostIndex = treeHostIndex;
        this.username = username;
        this.settings = settings;
        this.body = "";
        // expressNext: ((err?: any) => void) | false;
        this.pathOptions = {
            noTrailingSlash: false
        };
        this.responseHeaders = {};
        this.responseSent = false;
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
        this.req = _req;
        this.res = _res;
        //parse the url and store in state.
        this.url = StateObject.parseURL(this.req.url);
        //parse the path for future use
        this.path = this.url.pathname.split('/');
        let t = new Date();
        this.timestamp = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
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
        });
    }
    static parseURL(str) {
        let item = url.parse(str, true);
        let { path, pathname, query, search, href } = item;
        if (!path)
            path = "";
        if (!pathname)
            pathname = "";
        if (!query)
            query = {};
        if (!search)
            search = "";
        if (!href)
            href = "";
        return { path, pathname, query, search, href };
    }
    static errorRoute(status, reason) {
        return (obs) => {
            return obs.mergeMap((state) => {
                if (reason)
                    return state.throwReason(status, reason);
                else
                    return state.throw(status);
            });
        };
    }
    get allow() {
        if (this.authAccountsKey) {
            return this.settings.authAccounts[this.authAccountsKey].permissions;
        }
        else {
            return this.settings.bindInfo.hostLevelPermissions[this.hostLevelPermissionsKey];
        }
        // let localAddress = this._req.socket.localAddress;
        // let keys = Object.keys(settings.tiddlyserver.hostLevelPermissions);
        // let isLocalhost = testAddress(localAddress, "127.0.0.1", 8);
        // let matches = parseHostList(keys)(localAddress);
        // if (isLocalhost) {
        // 	return settings.tiddlyserver.hostLevelPermissions["localhost"];
        // } else if (matches.lastMatch > -1) {
        // 	return settings.tiddlyserver.hostLevelPermissions[keys[matches.lastMatch]]
        // } else {
        // 	return settings.tiddlyserver.hostLevelPermissions["*"]
        // }
    }
    get hostRoot() {
        return this.settings.tree[this.treeHostIndex].$mount;
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
    log(level, format, ...args) {
        if (level < this.loglevel)
            return this;
        if (level > 1)
            this.hasCriticalLogs = true;
        this.doneMessage.push(format(format, ...args));
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
    throwError(statusCode, error, headers) {
        return this.throwReason(statusCode, this.allow.writeErrors ? error : error.reason, headers);
    }
    throwReason(statusCode, reason, headers) {
        if (!this.responseSent) {
            if (typeof reason === "string") {
                let res = this.respond(statusCode, reason, headers);
                if (statusCode !== 204)
                    res.string(reason);
            }
            else {
                let res = this.respond(statusCode, reason.reason, headers);
                if (statusCode !== 204)
                    res.string(reason.message);
            }
        }
        return rx_1.Observable.empty();
    }
    throw(statusCode, headers) {
        if (!this.responseSent) {
            if (headers)
                this.setHeaders(headers);
            this.respond(statusCode).empty();
        }
        return rx_1.Observable.empty();
    }
    setHeader(key, val) {
        this.setHeaders({ [key]: val });
    }
    setHeaders(headers) {
        Object.assign(this.responseHeaders, headers, headers["Set-Cookie"] ? {
            "Set-Cookie": (this.responseHeaders["Set-Cookie"] || []).concat(headers["Set-Cookie"] || [])
        } : {});
    }
    respond(code, message, headers) {
        if (headers)
            this.setHeaders(headers);
        if (!message)
            message = http.STATUS_CODES[code];
        if (this.settings._devmode) {
            let stack = new Error().stack;
            setTimeout(() => {
                if (!this.responseSent)
                    this.debugLog(3, "Response not sent \n %s", stack);
            }, 0);
        }
        var subthis = {
            json: (data) => {
                this.setHeader("Content-Type", "application/json");
                subthis.string(JSON.stringify(data));
            },
            string: (data) => {
                subthis.buffer(Buffer.from(data, 'utf8'));
            },
            stream: (data) => {
                this._res.writeHead(code, message, this.responseHeaders);
                data.pipe(this._res);
                this.responseSent = true;
            },
            buffer: (data) => {
                this.setHeader("Content-Length", data.byteLength.toString());
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
        };
        return subthis;
    }
    redirect(redirect) {
        this.respond(302, "", {
            'Location': redirect
        }).empty();
    }
    send(options) {
        const { filepath, root, error, directory, headers } = options;
        const sender = bundled_lib_1.send(this._req, filepath, { root });
        if (error)
            sender.on('error', options.error);
        if (directory)
            sender.on('directory', (res, fp) => directory(fp));
        if (headers)
            sender.on('headers', (res, fp) => {
                const hdrs = headers(fp);
                Object.keys(hdrs).forEach(e => {
                    let item = hdrs[e];
                    if (item)
                        res.setHeader(e, item.toString());
                });
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
    recieveBody(parseJSON, errorCB) {
        return new Promise(resolve => {
            let chunks = [];
            this._req.on("data", (chunk) => {
                if (typeof chunk === "string") {
                    chunks.push(Buffer.from(chunk));
                }
                else {
                    chunks.push(chunk);
                }
            });
            this._req.on("end", () => {
                this.body = Buffer.concat(chunks).toString('utf8');
                if (this.body.length === 0 || !parseJSON)
                    return resolve();
                let catchHandler = errorCB === true ? (e) => {
                    this.respond(400, "", {
                        "Content-Type": "text/plain"
                    }).string(e.errorPosition);
                    //return undefined;
                } : errorCB;
                this.json = catchHandler ? tryParseJSON(this.body, catchHandler) : tryParseJSON(this.body);
                resolve();
            });
        });
        // return Observable.fromEvent<Buffer>(this._req, 'data')
        // 	//only take one since we only need one. this will dispose the listener
        // 	.takeUntil(Observable.fromEvent(this._req, 'end').take(1))
        // 	//accumulate all the chunks until it completes
        // 	.reduce<Buffer>((n, e) => { n.push(e); return n; }, [])
        // 	//convert to json
        // 	.forEach((e) => {
        // 		this.body = Buffer.concat(e).toString('utf8');
        // 		//console.log(state.body);
        // 		if (this.body.length === 0)
        // 			return this;
        // 		let catchHandler = errorCB === true ? (e: JsonError) => {
        // 			this.respond(400, "", {
        // 				"Content-Type": "text/plain"
        // 			}).string(e.errorPosition);
        // 		} : errorCB;
        // 		this.json = catchHandler ? tryParseJSON<any>(this.body, catchHandler) : tryParseJSON(this.body);
        // 	})
        // 	//returns a promise with the state
        // 	.then(() => this);
    }
}
exports.StateObject = StateObject;
class ER extends Error {
    constructor(reason, message) {
        super(message);
        this.reason = reason;
    }
}
exports.ER = ER;
/** to be used with concatMap, mergeMap, etc. */
function recieveBody(state, parseJSON, sendError) {
    //get the data from the request
    return state.recieveBody(parseJSON, sendError);
}
exports.recieveBody = recieveBody;
exports.TestConfig = {};
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
// export function getError(code: string, ...args: string[]): any;
function getError(code, ...args) {
    // let code = args.shift() as keyof typeof ERRORS;
    if (ERRORS[code])
        args.unshift(ERRORS[code]);
    //else args.unshift(code);
    return { code: code, message: util_1.format(code, ...args) };
}
exports.getError = getError;
/**
 *
 *
 * @param {string} ip x.x.x.x
 * @param {string} range x.x.x.x
 * @param {number} netmask 0-32
 */
function testAddress(ip, range, netmask) {
    let netmaskBinStr = ipcalc.IPv4_bitsNM_to_binstrNM(netmask);
    let addressBinStr = ipcalc.IPv4_intA_to_binstrA(ipcalc.IPv4_dotquadA_to_intA(ip));
    let netaddrBinStr = ipcalc.IPv4_intA_to_binstrA(ipcalc.IPv4_dotquadA_to_intA(range));
    let netaddrBinStrMasked = ipcalc.IPv4_Calc_netaddrBinStr(netaddrBinStr, netmaskBinStr);
    let addressBinStrMasked = ipcalc.IPv4_Calc_netaddrBinStr(addressBinStr, netmaskBinStr);
    return netaddrBinStrMasked === addressBinStrMasked;
    // 	this.addressInteger = IPv4_dotquadA_to_intA( this.addressDotQuad );
    // //	this.addressDotQuad  = IPv4_intA_to_dotquadA( this.addressInteger );
    // 	this.addressBinStr  = IPv4_intA_to_binstrA( this.addressInteger );
    // 	this.netmaskBinStr  = IPv4_bitsNM_to_binstrNM( this.netmaskBits );
    // 	this.netmaskInteger = IPv4_binstrA_to_intA( this.netmaskBinStr );
    // 	this.netmaskDotQuad  = IPv4_intA_to_dotquadA( this.netmaskInteger );
    // 	this.netaddressBinStr = IPv4_Calc_netaddrBinStr( this.addressBinStr, this.netmaskBinStr );
    // 	this.netaddressInteger = IPv4_binstrA_to_intA( this.netaddressBinStr );
    // 	this.netaddressDotQuad  = IPv4_intA_to_dotquadA( this.netaddressInteger );
    // 	this.netbcastBinStr = IPv4_Calc_netbcastBinStr( this.addressBinStr, this.netmaskBinStr );
    // 	this.netbcastInteger = IPv4_binstrA_to_intA( this.netbcastBinStr );
    // 	this.netbcastDotQuad  = IPv4_intA_to_dotquadA( this.netbcastInteger );
}
exports.testAddress = testAddress;
let hostIPv4reg = /^(\-?)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/i;
function parseHostList(hosts) {
    let hostTests = hosts.map(e => hostIPv4reg.exec(e) || e);
    return (addr) => {
        let usable = false;
        let lastMatch = -1;
        hostTests.forEach((test, i) => {
            if (Array.isArray(test)) {
                let allow = !test[1];
                let ip = test[2];
                let netmask = +test[3];
                if (netmask < 0 || netmask > 32)
                    console.log("Host %s has an invalid netmask", test[0]);
                if (testAddress(addr, ip, netmask)) {
                    usable = allow;
                    lastMatch = i;
                }
            }
            else {
                let ip = test.startsWith('-') ? test.slice(1) : test;
                let deny = test.startsWith('-');
                if (ip === addr) {
                    usable = !deny;
                    lastMatch = i;
                }
            }
        });
        return { usable, lastMatch };
    };
}
exports.parseHostList = parseHostList;
function getUsableAddresses(hosts) {
    let reg = /^(\-?)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/i;
    let hostTests = hosts.map(e => reg.exec(e) || e);
    var ifaces = os_1.networkInterfaces();
    let addresses = Object.keys(ifaces).reduce((n, k) => n.concat(ifaces[k].filter(e => e.family === "IPv4")), []);
    let usableArray = addresses.filter(addr => {
        let usable = false;
        hostTests.forEach(test => {
            if (Array.isArray(test)) {
                //we can't match IPv6 interface addresses so just go to the next one
                if (addr.family === "IPv6")
                    return;
                let allow = !test[1];
                let ip = test[2];
                let netmask = +test[3];
                if (netmask < 0 || netmask > 32)
                    console.log("Host %s has an invalid netmask", test[0]);
                if (testAddress(addr.address, ip, netmask))
                    usable = allow;
            }
            else {
                let ip = test.startsWith('-') ? test.slice(1) : test;
                let deny = test.startsWith('-');
                if (ip === addr.address)
                    usable = !deny;
            }
        });
        return usable;
    });
    return usableArray;
}
exports.getUsableAddresses = getUsableAddresses;
function NodePromise(body) {
    return new Promise((resolve, reject) => {
        body((err, data) => err ? reject(err) : resolve(data));
    });
}
exports.NodePromise = NodePromise;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSw2QkFBNkI7QUFDN0IsMkJBQTJCO0FBQzNCLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFFN0IsK0JBQThCO0FBQzlCLGtDQUFtRDtBQUVuRCx3Q0FBd0M7QUFDeEMsb0RBQXVFO0FBQ3ZFLDJCQUEyQztBQUMzQywrQkFBNEI7QUFDNUIsbUNBQTBDO0FBRzFDLDJCQUE2RDtBQUM3RCxtQ0FBbUM7QUFDbkMsbURBdUJ5QjtBQVV4Qiw0QkFkQSxpQ0FBaUIsQ0FjQTtBQUNqQiwwQkFkQSwrQkFBZSxDQWNBO0FBVGYsaUJBSEEsc0JBQU0sQ0FHQTtBQVdQLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLElBQUksUUFBc0IsQ0FBQztBQUMzQixNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQTtBQUNyQyxJQUFJLFdBQVcsR0FBYSxJQUFJLGlCQUFRLENBQUM7SUFDeEMsS0FBSyxFQUFFLFVBQVUsS0FBSyxFQUFFLFFBQVEsRUFBRSxRQUFRO1FBQ3pDLGtEQUFrRDtRQUNsRCxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO1lBQUUsS0FBSyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0QsMkNBQTJDO1FBQzNDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVGLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUU7WUFDOUIsbUJBQWMsQ0FD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