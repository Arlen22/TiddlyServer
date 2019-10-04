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
    settingsObj.__targetTW = settingsObj._datafoldertarget
        ? path.resolve(settingsObj.__dirname, settingsObj._datafoldertarget)
        : path.resolve(__dirname, "../tiddlywiki");
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
        // sender.on("overrideStream", (tag) => {
        //   // this._res.setHeader("Transfer-Encoding", "gzip");
        //   const gz = createGzip();
        //   const res = tag.dest as http.ServerResponse;
        //   const buffs: Buffer[] = [];
        //   let length = 0;
        //   gz.on("data", (chunk: Buffer) => { length += chunk.length; buffs.push(chunk); });
        //   gz.on("end", () => {
        //     this._res.setHeader("Content-Length", length);
        //     this._res.setHeader("Content-Encoding", "gzip");
        //     console.log(buffs.length);
        //     for (let i = 0; i < buffs.length; i++) {
        //       res.write(buffs[i]);
        //     }
        //     res.end();
        //   })
        //   tag.dest = gz;
        // });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUF5QztBQUd6Qyx3Q0FBd0M7QUFDeEMsb0RBQWtFO0FBRWxFLCtCQUF3QztBQUl4QywyQkFBNkQ7QUFDN0QsbUNBQW1DO0FBQ25DLG1EQXdCeUI7QUFVdkIsNEJBZkEsaUNBQWlCLENBZUE7QUFDakIsMEJBZkEsK0JBQWUsQ0FlQTtBQVRmLGlCQUpBLHNCQUFNLENBSUE7QUFXUixJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNwQiw4QkFBOEI7QUFDOUIsd0NBQXdDO0FBQ3hDLDZDQUE2QztBQUM3QyxpREFBaUQ7QUFDakQsdURBQXVEO0FBQ3ZELGdFQUFnRTtBQUNoRSxnREFBZ0Q7QUFDaEQsaUdBQWlHO0FBRWpHLHFDQUFxQztBQUNyQyxxQkFBcUI7QUFDckIsaUNBQWlDO0FBQ2pDLDRGQUE0RjtBQUM1RiwyQkFBMkI7QUFDM0IsUUFBUTtBQUNSLE1BQU07QUFDTiwyRUFBMkU7QUFDM0UseUJBQXlCO0FBQ3pCLE1BQU07QUFDTiw0QkFBNEI7QUFDNUIsaUJBQWlCO0FBQ2pCLEtBQUs7QUFDTCxPQUFPO0FBQ1Asa0RBQWtEO0FBQ2xELFNBQWdCLElBQUksQ0FBQyxPQUEyQjtJQUM5QyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQ2hELCtCQUErQjtRQUMvQixrQkFBa0I7UUFDbEIsbUJBQW1CO1FBQ25CLDBEQUEwRDtRQUMxRCxtREFBbUQ7UUFDbkQsNEJBQTRCO1FBQzVCLDZCQUE2QjtRQUM3QixhQUFhO1FBQ2Isc0ZBQXNGO1FBQ3RGLE1BQU07UUFDTixNQUFNO1FBQ04sTUFBTTtRQUNOLGlDQUFpQztJQUNuQyxDQUFDLENBQUMsQ0FBQztBQUNMLENB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