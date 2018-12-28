"use strict";
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
        if (settings.server.logError) {
            fs_1.appendFileSync(settings.server.logError, (settings.server.logColorsToFile ? chunk : chunk.replace(colorsRegex, "")) + "\r\n", { encoding: "utf8" });
        }
        if (!settings.server.logError || settings.server.logToConsoleAlso) {
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
function OldDefaultSettings(set) {
    if (!set.port)
        set.port = 8080;
    if (!set.host)
        set.host = "127.0.0.1";
    if (!set.types)
        set.types = {
            "htmlfile": ["htm", "html"]
        };
    if (!set.etag)
        set.etag = "";
    if (!set.etagWindow)
        set.etagWindow = 0;
    if (!set.useTW5path)
        set.useTW5path = false;
    if (typeof set.debugLevel !== "number")
        set.debugLevel = -1;
    ["allowNetwork", "allowLocalhost"].forEach((key) => {
        if (!set[key])
            set[key] = {};
        if (!set[key].mkdir)
            set[key].mkdir = false;
        if (!set[key].upload)
            set[key].upload = false;
        if (!set[key].settings)
            set[key].settings = false;
        if (!set[key].WARNING_all_settings_WARNING)
            set[key].WARNING_all_settings_WARNING = false;
    });
    if (!set.logColorsToFile)
        set.logColorsToFile = false;
    if (!set.logToConsoleAlso)
        set.logToConsoleAlso = false;
    if (!set.maxAge)
        set.maxAge = {};
    if (typeof set.maxAge.tw_plugins !== "number")
        set.maxAge.tw_plugins = 60 * 60 * 24 * 365 * 1000; //1 year of milliseconds
}
exports.OldDefaultSettings = OldDefaultSettings;
function ConvertSettings(set) {
    return {
        __assetsDir: set.__assetsDir,
        __dirname: set.__dirname,
        __filename: set.__filename,
        tree: set.tree,
        server: {
            bindAddress: [set.host],
            filterBindAddress: false,
            enableIPv6: false,
            port: set.port,
            bindWildcard: set.host === "0.0.0.0",
            logAccess: set.logAccess,
            logError: set.logError,
            logColorsToFile: set.logColorsToFile,
            logToConsoleAlso: set.logToConsoleAlso,
            debugLevel: set.debugLevel,
            _bindLocalhost: set._disableLocalHost === false,
            _devmode: set._devmode
        },
        tiddlyserver: {
            etag: set.etag,
            etagWindow: set.etagWindow,
            useTW5path: set.useTW5path,
            hostLevelPermissions: {
                "localhost": set.allowLocalhost,
                "*": set.allowNetwork
            }
        },
        directoryIndex: {
            defaultType: "html",
            icons: set.types,
            mixFolders: set.mixFolders
        },
        EXPERIMENTAL_clientside_datafolders: {
            enabled: false,
            alwaysRefreshCache: typeof set.tsa === "object" ? set.tsa.alwaysRefreshCache : true,
            maxAge_tw_plugins: typeof set.maxAge === "object" ? set.maxAge.tw_plugins : 0
        },
        $schema: "./settings.schema.json"
    };
}
exports.ConvertSettings = ConvertSettings;
function NewDefaultSettings(set) {
    let newset = {
        tree: set.tree,
        server: Object.assign({
            bindAddress: [],
            bindWildcard: true,
            enableIPv6: false,
            filterBindAddress: false,
            port: 8080,
            debugLevel: 0,
            logAccess: "",
            logError: "",
            logColorsToFile: false,
            logToConsoleAlso: true,
            _bindLocalhost: false,
            _devmode: false
        }, set.server),
        tiddlyserver: Object.assign({
            etag: "",
            etagWindow: 3,
            useTW5path: false,
            hostLevelPermissions: Object.assign({
                "localhost": {
                    writeErrors: true,
                    mkdir: true,
                    upload: true,
                    settings: true,
                    WARNING_all_settings_WARNING: false
                },
                "*": {
                    writeErrors: true,
                    mkdir: false,
                    upload: false,
                    settings: false,
                    WARNING_all_settings_WARNING: false
                }
            }, set.tiddlyserver.hostLevelPermissions)
        }, set.tiddlyserver),
        directoryIndex: Object.assign({
            defaultType: "html",
            icons: { "htmlfile": ["htm", "html"] },
            mixFolders: true
        }, set.directoryIndex),
        EXPERIMENTAL_clientside_datafolders: Object.assign({
            enabled: false,
            alwaysRefreshCache: true,
            maxAge_tw_plugins: 0
        }, set.EXPERIMENTAL_clientside_datafolders),
        $schema: "./settings.schema.json"
    };
    return newset;
}
exports.NewDefaultSettings = NewDefaultSettings;
function isNewTreeItem(a) {
    return (typeof a === "object" && typeof a["$element"] === "string");
}
exports.isNewTreeItem = isNewTreeItem;
function isNewTreeGroup(a) {
    return isNewTreeItem(a) && a.$element === "group";
}
exports.isNewTreeGroup = isNewTreeGroup;
function isNewTreeHashmapGroupSchema(a) {
    return isNewTreeGroup(a) && !Array.isArray(a.$children) && !a.key;
}
exports.isNewTreeHashmapGroupSchema = isNewTreeHashmapGroupSchema;
function isNewTreePath(a) {
    return isNewTreeItem(a) && a.$element === "folder";
}
exports.isNewTreePath = isNewTreePath;
function isNewTreeMountItem(a) {
    return isNewTreeItem(a) && (a.$element === "group" || a.$element === "folder");
}
exports.isNewTreeMountItem = isNewTreeMountItem;
function normalizeTree(settingsDir, item, key, keypath) {
    // let t = item as NewTreeObjectSchemaItem;
    if (typeof item === "string" || item.$element === "folder") {
        if (typeof item === "string")
            item = { $element: "folder", path: item };
        if (!item.path)
            throw new Error(util_1.format("path must be specified for folder item under '%s'", keypath.join(', ')));
        item.path = path.resolve(settingsDir, item.path);
        key = key || path.basename(item.path);
        //the hashmap key overrides the key attribute if available
        return Object.assign({}, item, { key });
    }
    else if (item.$element === "group") {
        if (((a) => !a.key)(item)) {
            if (!key)
                throw new Error("No key specified for group element under " + keypath.join(', '));
        }
        else {
            key = item.key;
        }
        //at this point we only need the TreeHashmapGroup type since we already extracted the key
        let t = item;
        let tc = t.$children;
        if (typeof tc !== "object")
            throw new Error("Invalid $children under " + keypath.join(', '));
        return ({
            $element: "group", key,
            $children: Array.isArray(tc)
                ? tc.map(e => normalizeTree(settingsDir, e, undefined, keypath))
                : Object.keys(tc).filter(k => k !== "$children")
                    .map(k => normalizeTree(settingsDir, tc[k], k, [...keypath, k]))
                    .concat(tc.$children || [])
        });
    }
    else {
        return item;
    }
}
exports.normalizeTree = normalizeTree;
function normalizeSettings(set, settingsFile, routeKeys) {
    const settingsDir = path.dirname(settingsFile);
    NewDefaultSettings(set);
    ((tree) => {
        if (typeof tree === "string" && tree.endsWith(".xml")) {
            //read the xml file and parse it as the tree structure
        }
        else if (typeof tree === "string" && (tree.endsWith(".js") || tree.endsWith(".json"))) {
            //require the json or js file and use it directly
            let filepath = path.resolve(settingsDir, tree);
            set.tree = normalizeTree(path.dirname(filepath), require(filepath), "tree", []);
        }
        else {
            //otherwise just assume we're using the value itself
            set.tree = normalizeTree(settingsDir, tree, "tree", []);
        }
    })(set.tree);
    if (set.tiddlyserver.backupDirectory)
        set.tiddlyserver.backupDirectory = path.resolve(settingsDir, set.tiddlyserver.backupDirectory);
    if (set.server.logAccess)
        set.server.logAccess = path.resolve(settingsDir, set.server.logAccess);
    if (set.server.logError)
        set.server.logError = path.resolve(settingsDir, set.server.logError);
    set.__dirname = settingsDir;
    set.__filename = settingsFile;
    if (set.tiddlyserver.etag === "disabled" && !set.tiddlyserver.backupDirectory) {
        console.log("Etag checking is disabled, but a backup folder is not set. "
            + "Changes made in multiple tabs/windows/browsers/computers can overwrite each "
            + "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED "
            + "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can "
            + "also set the etagWindow setting to allow files to be modified if not newer than "
            + "so many seconds from the copy being saved.");
    }
}
exports.normalizeSettings = normalizeSettings;
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
        if (onerror)
            return onerror(err);
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
function DebugLogger(prefix, ignoreLevel) {
    //if(prefix.startsWith("V:")) return function(){};
    return function (msgLevel, ...args) {
        if (!ignoreLevel && settings.server.debugLevel > msgLevel)
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
            + ' ' + util_1.format.apply(null, args).split('\n').map((e, i) => {
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
    exports.obs_stat(state)(path.join(root, file)).mergeMap(([err, stat]) => {
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
function getNewTreePathFiles(result, state) {
    let dirpath = [
        result.treepathPortion.join('/'),
        result.filepathPortion.join('/')
    ].filter(e => e).join('/');
    let type = isNewTreeGroup(result.item) ? "category" : "folder";
    if (isNewTreeGroup(result.item)) {
        let $c = result.item.$children.filter(isNewTreeMountItem);
        const keys = $c.map(e => e.key);
        // const keys = Object.keys(result.item);
        const paths = $c.map(e => isNewTreePath(e) ? e.path : true);
        return rx_1.Observable.of({ keys, paths, dirpath, type });
    }
    else {
        return exports.obs_readdir()(result.fullfilepath).map(([err, keys]) => {
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
exports.getNewTreePathFiles = getNewTreePathFiles;
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
// 	let type = typeof result.item === "object" ? "category" : "folder";
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
    return rx_1.Observable.from(pairs).mergeMap(([key, val]) => {
        //if this is a category, just return the key
        if (typeof val === "boolean")
            return rx_1.Observable.of({ key });
        //otherwise return the statPath result
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
        if (options.format === "json") {
            return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
        }
        else {
            return generateDirectoryListing({ path: dirpath, entries, type }, options);
        }
    });
}
exports.sendDirectoryIndex = sendDirectoryIndex;
/**
 * If the path
 */
function statWalkPath(test) {
    // let endStat = false;
    if (!isNewTreePath(test.item)) {
        console.log(test.item);
        throw "property item must be a TreePath";
    }
    let endWalk = false;
    return rx_1.Observable.from([test.item.path].concat(test.filepathPortion)).scan((n, e) => {
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
function treeWalker(tree, reqpath) {
    var item = tree;
    var ancestry = [];
    var folderPathFound = false;
    for (var end = 0; end < reqpath.length; end++) {
        if (isNewTreePath(item)) {
            folderPathFound = true;
            break;
        }
        let t = item.$children.find((e) => isNewTreeMountItem(e) && e.key === reqpath[end]);
        if (isNewTreeGroup(item) && t) {
            item = t;
            let a = Object.assign({}, item);
            delete a.$children;
            ancestry.push(a);
        }
        else {
            break;
        }
    }
    return { item, end, folderPathFound, ancestry };
}
exports.treeWalker = treeWalker;
function treeWalkerOld(tree, reqpath) {
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
}
exports.treeWalkerOld = treeWalkerOld;
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
    if (reqpath.length === 0)
        return {
            item: tree,
            ancestry: [],
            reqpath,
            treepathPortion: [],
            filepathPortion: [],
            fullfilepath: typeof tree === "string" ? tree : ''
        };
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
        : (isNewTreePath(result.item) ? result.item.path : '');
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
    constructor(_req, _res, debugLog, eventer) {
        this._req = _req;
        this._res = _res;
        this.debugLog = debugLog;
        this.eventer = eventer;
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
        // this.req = {
        //     method: _req.method as string,
        //     url: _req.url as string,
        //     headers: _req.headers,
        //     pipe: _req.pipe.bind(_req)
        // }
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
        let localAddress = this._req.socket.localAddress;
        let keys = Object.keys(settings.tiddlyserver.hostLevelPermissions);
        let isLocalhost = testAddress(localAddress, "127.0.0.1", 8);
        let matches = parseHostList(keys)(localAddress);
        if (isLocalhost) {
            return settings.tiddlyserver.hostLevelPermissions["localhost"];
        }
        else if (matches.lastMatch > -1) {
            return settings.tiddlyserver.hostLevelPermissions[keys[matches.lastMatch]];
        }
        else {
            return settings.tiddlyserver.hostLevelPermissions["*"];
        }
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
        return this.throwReason(statusCode, this.allow.writeErrors ? error.message : error.reason, headers);
    }
    throwReason(statusCode, reason, headers) {
        if (!this.responseSent) {
            var res = this.respond(statusCode, reason, headers);
            //don't write 204 reason
            if (statusCode !== 204 && reason)
                res.string(reason.toString());
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
        this.responseHeaders[key] = val;
    }
    setHeaders(headers) {
        Object.assign(this.responseHeaders, headers);
    }
    respond(code, message, headers) {
        if (headers)
            this.setHeaders(headers);
        if (!message)
            message = http.STATUS_CODES[code];
        if (settings.server._devmode)
            setTimeout(() => {
                if (!this.responseSent)
                    this.debugLog(3, "Response not sent \n %s", new Error().stack);
            }, 0);
        var subthis = {
            json: (data) => {
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
    recieveBody(errorCB) {
        return rx_1.Observable.fromEvent(this._req, 'data')
            //only take one since we only need one. this will dispose the listener
            .takeUntil(rx_1.Observable.fromEvent(this._req, 'end').take(1))
            //accumulate all the chunks until it completes
            .reduce((n, e) => { n.push(e); return n; }, [])
            //convert to json and return state for next part
            .map(e => {
            this.body = Buffer.concat(e).toString('utf8');
            //console.log(state.body);
            if (this.body.length === 0)
                return this;
            let catchHandler = errorCB === true ? (e) => {
                this.respond(400, "", {
                    "Content-Type": "text/plain"
                }).string(e.errorPosition);
            } : errorCB;
            this.json = tryParseJSON(this.body, catchHandler);
            return this;
        });
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
function recieveBody(state, sendError) {
    //get the data from the request
    return state.recieveBody(sendError);
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
function getError(...args) {
    let code = args.shift();
    if (ERRORS[code])
        args.unshift(ERRORS[code]);
    //else args.unshift(code);
    return { code: code, message: util_1.format.apply(null, args) };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUE4QjtBQUM5QixrQ0FBbUQ7QUFFbkQsd0NBQXdDO0FBQ3hDLG9EQUEwQztBQUMxQywyQkFBMkM7QUFDM0MsK0JBQTRCO0FBQzVCLG1DQUEwQztBQUcxQywyQkFBNkQ7QUFDN0QsbUNBQW1DO0FBQ25DLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLElBQUksUUFBc0IsQ0FBQztBQUMzQixNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQTtBQUNyQyxJQUFJLFdBQVcsR0FBYSxJQUFJLGlCQUFRLENBQUM7SUFDeEMsS0FBSyxFQUFFLFVBQVUsS0FBSyxFQUFFLFFBQVEsRUFBRSxRQUFRO1FBQ3pDLGtEQUFrRDtRQUNsRCxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO1lBQUUsS0FBSyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0QsMkNBQTJDO1FBQzNDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVGLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7WUFDN0IsbUJBQWMsQ0FDYixRQUFRLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFDeEIsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENB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