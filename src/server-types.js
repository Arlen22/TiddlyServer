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
            bindAddress: (set.host === "0.0.0.0" || set.host === "::") ? [] : [set.host],
            filterBindAddress: false,
            enableIPv6: set.host === "::",
            port: set.port,
            bindWildcard: set.host === "0.0.0.0" || set.host === "::",
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
            useTW5path: true,
            hostLevelPermissions: {}
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
    // set second level object defaults
    newset.tiddlyserver.hostLevelPermissions = Object.assign({
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
    }, set.tiddlyserver.hostLevelPermissions);
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