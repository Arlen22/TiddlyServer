"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
//import { StateObject } from "./index";
const bundled_lib_1 = require("../lib/bundled-lib");
const zlib_1 = require("zlib");
const os_1 = require("os");
const ipcalc = require("./ipcalc");
const server_config_1 = require("./server-config");
exports.normalizeSettings = server_config_1.normalizeSettings;
exports.ConvertSettings = server_config_1.ConvertSettings;
exports.Config = server_config_1.Config;
let DEBUGLEVEL = -1;
// let settings: ServerConfig;
// const colorsRegex = /\x1b\[[0-9]+m/gi
// let debugOutput: Writable = new Writable({
// 	write: function (chunk, encoding, callback) {
// 		// if we're given a buffer, convert it to a string
// 		if (Buffer.isBuffer(chunk)) chunk = chunk.toString('utf8');
// 		// remove ending linebreaks for consistency
// 		chunk = chunk.slice(0, chunk.length - (chunk.endsWith("\r\n") ? 2 : +chunk.endsWith("\n")));
// 		if (settings.logging.logError) {
// 			appendFileSync(
// 				settings.logging.logError,
// 				(settings.logging.logColorsToFile ? chunk : chunk.replace(colorsRegex, "")) + "\r\n",
// 				{ encoding: "utf8" }
// 			);
// 		}
// 		if (!settings.logging.logError || settings.logging.logToConsoleAlso) {
// 			console.log(chunk);
// 		}
// 		callback && callback();
// 		return true;
// 	}
// });;
// export let typeLookup: { [k: string]: string };
function init(eventer) {
    eventer.on('settings', function (set) {
        // DEBUGLEVEL = set.debugLevel;
        // settings = set;
        // typeLookup = {};
        // Object.keys(set.directoryIndex.icons).forEach(type => {
        // 	set.directoryIndex.icons[type].forEach(ext => {
        // 		if (!typeLookup[ext]) {
        // 			typeLookup[ext] = type;
        // 		} else {
        // 			throw format('Multiple types for extension %s: %s', ext, typeLookup[ext], type);
        // 		}
        // 	})
        // });
        // const myWritable = new stream.
    });
}
exports.init = init;
// export type ServerConfig = NewConfig;
// export type ServerConfigSchema = NewConfigSchema;
function as(obj) {
    return obj;
}
exports.as = as;
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
    // schemaChecker.addMetaSchema(require("../settings-2-1.schema.json"));
    schemaChecker.addMetaSchema(require("../settings-2-1-tree.schema.json"));
    schemaChecker.addMetaSchema(require("../settings-2-1-tree-options.schema.json"));
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
// export function DebugLogger(prefix: string, ignoreLevel?: boolean): typeof DebugLog {
// 	//if(prefix.startsWith("V:")) return function(){};
// 	return function (msgLevel: number, tempString: any, ...args: any[]) {
// 		if (!ignoreLevel && settings.logging.debugLevel > msgLevel) return;
// 		if (isError(args[0])) {
// 			let err = args[0];
// 			args = [];
// 			if (err.stack) args.push(err.stack);
// 			else args.push("Error %s: %s", err.name, err.message);
// 		}
// 		let t = new Date();
// 		let date = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
// 			padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
// 		debugOutput.write(' '
// 			+ (msgLevel >= 3 ? (colors.BgRed + colors.FgWhite) : colors.FgRed) + prefix
// 			+ ' ' + colors.FgCyan + date + colors.Reset
// 			+ ' ' + format.apply(null, [tempString, ...args]).split('\n').map((e, i) => {
// 				if (i > 0) {
// 					return new Array(23 + prefix.length).join(' ') + e;
// 				} else {
// 					return e;
// 				}
// 			}).join('\n'), "utf8");
// 	} as typeof DebugLog;
// }
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
    util_1.promisify(fs.stat)(root ? path.join(root, file) : file).then((stat) => {
        state.send({
            root,
            filepath: file,
            error: err => {
                state.log(2, '%s %s', err.status, err.message).throw(500);
            }
        });
        // return Observable.empty<StateObject>();
    }, err => { state.throw(404); });
}
exports.serveFile = serveFile;
// export function serveFileObs(obs: Observable<StateObject>, file: string, root: string) {
// 	return obs.do(state => serveFile(state, file, root)).ignoreElements();
// }
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
// export function serveFolderObs(obs: Observable<StateObject>, mount: string, root: string, serveIndex?: Function) {
// 	return obs.do(state => serveFolder(state, mount, root, serveIndex)).ignoreElements();
// }
function serveFolderIndex(options) {
    async function readFolder(folder) {
        let files = await util_1.promisify(fs.readdir)(folder);
        let res = { "directory": [], "file": [] };
        await Promise.all(files.map(file => util_1.promisify(fs.stat)(path.join(folder, file)).then(stat => {
            let itemtype = stat.isDirectory() ? 'directory' : (stat.isFile() ? 'file' : 'other');
            res[itemtype].push(file);
        }, x => undefined)));
        return res;
    }
    if (options.type === "json") {
        return function (state, folder) {
            readFolder(folder).then(item => {
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
        return Promise.resolve({ keys, paths, dirpath, type: type });
    }
    else {
        return util_1.promisify(fs.readdir)(result.fullfilepath).then(keys => {
            const paths = keys.map(k => path.join(result.fullfilepath, k));
            return { keys, paths, dirpath, type: type };
        }).catch(err => {
            if (!err)
                return Promise.reject(err);
            state.log(2, 'Error calling readdir on folder "%s": %s', result.fullfilepath, err.message);
            state.throw(500);
            return Promise.reject(false);
        });
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
async function sendDirectoryIndex([_r, options]) {
    let { keys, paths, dirpath, type } = _r;
    let pairs = keys.map((k, i) => [k, paths[i]]);
    let entries = await Promise.all(keys.map(async (key, i) => {
        // if(paths[key] == null) debugger;
        let statpath = paths[i];
        let stat = (statpath === true) ? undefined : await statPath(statpath);
        // let e = { stat, key };
        // let linkpath = [dirpath, e.key].filter(e => e).join('/');
        return {
            name: key,
            path: key + ((!stat || stat.itemtype === "folder") ? "/" : ""),
            type: (!stat ? "group" : (stat.itemtype === "file"
                ? options.extTypes[key.split('.').pop()] || 'other'
                : stat.itemtype)),
            size: (stat && stat.stat) ? getHumanSize(stat.stat.size) : ""
        };
    }));
    if (options.format === "json") {
        return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
    }
    else {
        let def = { path: dirpath, entries, type };
        return generateDirectoryListing(def, options);
    }
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
async function statWalkPath(test) {
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
        let res = await statPath(s);
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
}
exports.statWalkPath = statWalkPath;
function statsafe(p) {
    return util_1.promisify(fs.stat)(p).catch(x => undefined);
}
exports.statsafe = statsafe;
/**
 * returns the info about the specified path. endstat is true if the statpath is not
 * found or if it is a directory and contains a tiddlywiki.info file, or if it is a file.
 *
 * @param {({ statpath: string, index: number, endStat: boolean } | string)} s
 * @returns
 */
async function statPath(s) {
    if (typeof s === "string")
        s = { statpath: s, index: 0 };
    const { statpath, index } = s;
    let stat = await statsafe(statpath);
    let endStat = !stat || !stat.isDirectory();
    let infostat = undefined;
    if (!endStat) {
        infostat = await statsafe(path.join(statpath, "tiddlywiki.info"));
        endStat = !!infostat && infostat.isFile();
    }
    return {
        stat, statpath, index, endStat, itemtype: getItemType(stat, infostat),
        infostat: (infostat && infostat.isFile()) ? infostat : undefined
    };
}
exports.statPath = statPath;
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
// export function obs<S>(state?: S) {
//     return Observable.bindCallback(fs.stat, (err, stat): NodeCallback<fs.Stats, S> => [err, stat, state] as any);
// }
// export type obs_stat_result<T> = [NodeJS.ErrnoException | null, fs.Stats, T, string]
// export const obs_stat = <T = undefined>(tag: T = undefined as any) =>
// 	(filepath: string) => new Observable<obs_stat_result<T>>(subs => {
// 		fs.stat(filepath, (err, data) => {
// 			subs.next([err, data, tag, filepath]);
// 			subs.complete();
// 		})
// 	})
// export type obs_readdir_result<T> = [NodeJS.ErrnoException | null, string[], T, string]
// export const obs_readdir = <T>(tag: T = undefined as any) =>
// 	(filepath: string) => new Observable<obs_readdir_result<T>>(subs => {
// 		fs.readdir(filepath, (err, data) => {
// 			subs.next([err, data, tag, filepath]);
// 			subs.complete();
// 		})
// 	})
// export type obs_readFile_result<T> = typeof obs_readFile_inner
// export const obs_readFile = <T>(tag: T = undefined as any): obs_readFile_result<T> =>
// 	(filepath: string, encoding?: string) =>
// 		new Observable(subs => {
// 			const cb = (err, data) => {
// 				subs.next([err, data, tag, filepath]);
// 				subs.complete();
// 			}
// 			if (encoding)
// 				fs.readFile(filepath, encoding, cb);
// 			else
// 				fs.readFile(filepath, cb)
// 		}) as any;
// declare function obs_readFile_inner<T>(filepath: string): Observable<[NodeJS.ErrnoException, Buffer, T, string]>;
// declare function obs_readFile_inner<T>(filepath: string, encoding: string): Observable<[NodeJS.ErrnoException, string, T, string]>;
// // export type obs_writeFile_result<T> = typeof obs_readFile_inner
// export const obs_writeFile = <T>(tag: T = undefined as any) =>
// 	(filepath: string, data: any) => new Observable<[NodeJS.ErrnoException | null, T, string]>(subs =>
// 		fs.writeFile(filepath, data, (err) => {
// 			subs.next([err, tag, filepath]);
// 			subs.complete();
// 		})
// 	);
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
    constructor(_req, _res, eventer, hostLevelPermissionsKey, authAccountsKey, 
    /** The HostElement array index in settings.tree */
    treeHostIndex, username, settings, debugOutput) {
        this._req = _req;
        this._res = _res;
        this.eventer = eventer;
        this.hostLevelPermissionsKey = hostLevelPermissionsKey;
        this.authAccountsKey = authAccountsKey;
        this.treeHostIndex = treeHostIndex;
        this.username = username;
        this.settings = settings;
        this.debugOutput = debugOutput;
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
        // return (obs: Observable<any>): any => {
        // 	return obs.mergeMap((state: StateObject) => {
        // 		if (reason)
        // 			return state.throwReason(status, reason);
        // 		else
        // 			return state.throw(status);
        // 	})
        // }
    }
    get allow() {
        if (this.authAccountsKey) {
            return this.settings.authAccounts[this.authAccountsKey].permissions;
        }
        else {
            return this.settings.bindInfo.localAddressPermissions[this.hostLevelPermissionsKey];
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
    log(level, template, ...args) {
        if (level < this.loglevel)
            return this;
        if (level > 1) {
            this.hasCriticalLogs = true;
            debugger;
        }
        this.doneMessage.push(util_1.format(template, ...args));
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
        // return Observable.empty<T>();
    }
    throw(statusCode, headers) {
        if (!this.responseSent) {
            if (headers)
                this.setHeaders(headers);
            this.respond(statusCode).empty();
        }
        // return Observable.empty<T>();
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
                    this.debugOutput.write("Response not sent syncly\n " + stack);
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
            sender.on('error', error);
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
    static DebugLogger(prefix, ignoreLevel) {
        //if(prefix.startsWith("V:")) return function(){};
        return function (msgLevel, tempString, ...args) {
            if (!ignoreLevel && this.settings.logging.debugLevel > msgLevel)
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
            this.debugOutput.write(' '
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUF5QztBQUd6Qyx3Q0FBd0M7QUFDeEMsb0RBQXVFO0FBRXZFLCtCQUE0QjtBQUk1QiwyQkFBNkQ7QUFDN0QsbUNBQW1DO0FBQ25DLG1EQXdCeUI7QUFVeEIsNEJBZkEsaUNBQWlCLENBZUE7QUFDakIsMEJBZkEsK0JBQWUsQ0FlQTtBQVRmLGlCQUpBLHNCQUFNLENBSUE7QUFXUCxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNwQiw4QkFBOEI7QUFDOUIsd0NBQXdDO0FBQ3hDLDZDQUE2QztBQUM3QyxpREFBaUQ7QUFDakQsdURBQXVEO0FBQ3ZELGdFQUFnRTtBQUNoRSxnREFBZ0Q7QUFDaEQsaUdBQWlHO0FBRWpHLHFDQUFxQztBQUNyQyxxQkFBcUI7QUFDckIsaUNBQWlDO0FBQ2pDLDRGQUE0RjtBQUM1RiwyQkFBMkI7QUFDM0IsUUFBUTtBQUNSLE1BQU07QUFDTiwyRUFBMkU7QUFDM0UseUJBQXlCO0FBQ3pCLE1BQU07QUFDTiw0QkFBNEI7QUFDNUIsaUJBQWlCO0FBQ2pCLEtBQUs7QUFDTCxPQUFPO0FBQ1Asa0RBQWtEO0FBQ2xELFNBQWdCLElBQUksQ0FBQyxPQUEyQjtJQUMvQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQ2pELCtCQUErQjtRQUMvQixrQkFBa0I7UUFDbEIsbUJBQW1CO1FBQ25CLDBEQUEwRDtRQUMxRCxtREFBbUQ7UUFDbkQsNEJBQTRCO1FBQzVCLDZCQUE2QjtRQUM3QixhQUFhO1FBQ2Isc0ZBQXNGO1FBQ3RGLE1BQU07UUFDTixNQUFNO1FBQ04sTUFBTTtRQUNOLGlDQUFpQztJQUNsQyxDQUFDLENBQUMsQ0FBQztBQUNKLENB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