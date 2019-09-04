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
    // var schemaChecker = new ajv({ allErrors: true, async: false });
    // schemaChecker.addMetaSchema(require('../lib/json-schema-refs/json-schema-draft-06.json'));
    // // schemaChecker.addMetaSchema(require("../settings-2-1.schema.json"));
    // schemaChecker.addMetaSchema(require("../settings-2-1-tree.schema.json"));
    // schemaChecker.addMetaSchema(require("../settings-2-1-tree-options.schema.json"));
    // var validate = schemaChecker.compile(require(
    // 	path.resolve(path.dirname(settingsFile), settingsObjSource.$schema)
    // ));
    // var valid = validate(settingsObjSource, "settings");
    // var validationErrors = validate.errors;
    // if (!valid) console.log(validationErrors && validationErrors.map(e => [e.keyword.toUpperCase() + ":", e.dataPath, e.message].join(' ')).join('\n'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUF5QztBQUd6Qyx3Q0FBd0M7QUFDeEMsb0RBQWtFO0FBRWxFLCtCQUE0QjtBQUk1QiwyQkFBNkQ7QUFDN0QsbUNBQW1DO0FBQ25DLG1EQXdCeUI7QUFVdkIsNEJBZkEsaUNBQWlCLENBZUE7QUFDakIsMEJBZkEsK0JBQWUsQ0FlQTtBQVRmLGlCQUpBLHNCQUFNLENBSUE7QUFXUixJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNwQiw4QkFBOEI7QUFDOUIsd0NBQXdDO0FBQ3hDLDZDQUE2QztBQUM3QyxpREFBaUQ7QUFDakQsdURBQXVEO0FBQ3ZELGdFQUFnRTtBQUNoRSxnREFBZ0Q7QUFDaEQsaUdBQWlHO0FBRWpHLHFDQUFxQztBQUNyQyxxQkFBcUI7QUFDckIsaUNBQWlDO0FBQ2pDLDRGQUE0RjtBQUM1RiwyQkFBMkI7QUFDM0IsUUFBUTtBQUNSLE1BQU07QUFDTiwyRUFBMkU7QUFDM0UseUJBQXlCO0FBQ3pCLE1BQU07QUFDTiw0QkFBNEI7QUFDNUIsaUJBQWlCO0FBQ2pCLEtBQUs7QUFDTCxPQUFPO0FBQ1Asa0RBQWtEO0FBQ2xELFNBQWdCLElBQUksQ0FBQyxPQUEyQjtJQUM5QyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQ2hELCtCQUErQjtRQUMvQixrQkFBa0I7UUFDbEIsbUJBQW1CO1FBQ25CLDBEQUEwRDtRQUMxRCxtREFBbUQ7UUFDbkQsNEJBQTRCO1FBQzVCLDZCQUE2QjtRQUM3QixhQUFhO1FBQ2Isc0ZBQXNGO1FBQ3RGLE1BQU07UUFDTixNQUFNO1FBQ04sTUFBTTtRQUNOLGlDQUFpQztJQUNuQyxDQUFDLENBQUMsQ0FBQztBQUNMLENB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