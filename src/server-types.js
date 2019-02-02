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
            _devmode: set._devmode,
            https: false
        },
        tiddlyserver: {
            etag: set.etag,
            etagWindow: set.etagWindow,
            hostLevelPermissions: {
                "localhost": set.allowLocalhost,
                "*": set.allowNetwork
            },
            authCookieAge: 2592000
        },
        authAccounts: {},
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
// export type ServerConfig = NewConfig;
// export type ServerConfigSchema = NewConfigSchema;
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
function normalizeSettingsTree(settingsDir, tree) {
    if (typeof tree === "string" && tree.endsWith(".xml")) {
        //read the xml file and parse it as the tree structure
    }
    else if (typeof tree === "string" && (tree.endsWith(".js") || tree.endsWith(".json"))) {
        //require the json or js file and use it directly
        let filepath = path.resolve(settingsDir, tree);
        return normalizeTree(path.dirname(filepath), require(filepath), "tree", []);
    }
    else {
        //otherwise just assume we're using the value itself
        return normalizeTree(settingsDir, tree, "tree", []);
    }
}
exports.normalizeSettingsTree = normalizeSettingsTree;
function normalizeSettingsAuthAccounts(auth) {
    if (!auth)
        return {};
    let newAuth = {};
    Object.keys(auth).forEach(k => {
        let key = k;
        auth[key].credentials;
        let perm = (auth[k].permissions || {});
        while (auth[key].inheritPermissions) {
            key = auth[key].inheritPermissions;
            perm = Object.assign({}, (auth[key].permissions || {}), perm);
        }
        return perm;
    });
    return newAuth;
}
exports.normalizeSettingsAuthAccounts = normalizeSettingsAuthAccounts;
function normalizeSettings(set, settingsFile) {
    const settingsDir = path.dirname(settingsFile);
    let newset = {
        __dirname: "",
        __filename: "",
        __assetsDir: "",
        tree: normalizeSettingsTree(settingsDir, set.tree),
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
            _devmode: false,
            https: false
        }, set.server, {
            https: !!set.server.https
        }),
        authAccounts: normalizeSettingsAuthAccounts(set.authAccounts),
        tiddlyserver: Object.assign({
            etag: "",
            etagWindow: 3,
            hostLevelPermissions: {},
            authCookieAge: 2592000
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
            WARNING_all_settings_WARNING: false,
            websockets: true
        },
        "*": {
            writeErrors: true,
            mkdir: false,
            upload: false,
            settings: false,
            WARNING_all_settings_WARNING: false,
            websockets: true
        }
    }, set.tiddlyserver && set.tiddlyserver.hostLevelPermissions);
    if (newset.tiddlyserver.backupDirectory)
        newset.tiddlyserver.backupDirectory = path.resolve(settingsDir, newset.tiddlyserver.backupDirectory);
    if (newset.server.logAccess)
        newset.server.logAccess = path.resolve(settingsDir, newset.server.logAccess);
    if (newset.server.logError)
        newset.server.logError = path.resolve(settingsDir, newset.server.logError);
    newset.__dirname = settingsDir;
    newset.__filename = settingsFile;
    if (newset.tiddlyserver.etag === "disabled" && !newset.tiddlyserver.backupDirectory) {
        console.log("Etag checking is disabled, but a backup folder is not set. "
            + "Changes made in multiple tabs/windows/browsers/computers can overwrite each "
            + "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED "
            + "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can "
            + "also set the etagWindow setting to allow files to be modified if not newer than "
            + "so many seconds from the copy being saved.");
    }
    return newset;
}
exports.normalizeSettings = normalizeSettings;
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
    var validate = schemaChecker.compile(require("../settings.schema.json"));
    var valid = validate(settingsObjSource, "settings");
    var validationErrors = validate.errors;
    if (!valid)
        console.log(validationErrors && validationErrors.map(e => [e.keyword.toUpperCase() + ":", e.dataPath, e.message].join(' ')).join('\n'));
    if (!settingsObjSource.tree)
        throw "tree is not specified in the settings file";
    // let routeKeys = Object.keys(routes);
    let settingshttps = settingsObjSource.server && settingsObjSource.server.https;
    let settingsObj = normalizeSettings(settingsObjSource, settingsFile);
    settingsObj.__assetsDir = assets;
    if (typeof settingsObj.tree === "object") {
        let keys = [];
        if (settingsObj.tree.$element === "group") {
            keys = settingsObj.tree.$children
                .map(e => (e.$element === "group" || e.$element === "folder") && e.key)
                .filter((e) => !!e);
        }
        else if (settingsObj.tree.$element === "folder") {
            keys = fs.readdirSync(settingsObj.tree.path, { encoding: "utf8" });
        }
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
    const type = isNewTreeGroup(result.item) ? "group" : "folder";
    if (isNewTreeGroup(result.item)) {
        let $c = result.item.$children.filter(isNewTreeMountItem);
        const keys = $c.map(e => e.key);
        // const keys = Object.keys(result.item);
        const paths = $c.map(e => isNewTreePath(e) ? e.path : true);
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
    return rx_1.Observable.from(pairs).mergeMap(([key, val]) => {
        //if this is a group, just return the key
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
            type: (!e.stat ? "group" : (e.stat.itemtype === "file"
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
    function getAncesterEntry(a) {
        return Object.assign({}, a, { $children: (a.$children || []).filter(e => !isNewTreeMountItem(e)) });
    }
    var item = tree;
    var ancestry = [];
    var folderPathFound = isNewTreePath(item);
    for (var end = 0; end < reqpath.length; end++) {
        if (isNewTreePath(item)) {
            folderPathFound = true;
            break;
        }
        let t = item.$children.find((e) => isNewTreeMountItem(e) && e.key === reqpath[end]);
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
    constructor(_req, _res, debugLog, eventer, hostLevelPermissionsKey, authAccountsKey, settings) {
        this._req = _req;
        this._res = _res;
        this.debugLog = debugLog;
        this.eventer = eventer;
        this.hostLevelPermissionsKey = hostLevelPermissionsKey;
        this.authAccountsKey = authAccountsKey;
        this.settings = settings;
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
            return settings.authAccounts[this.authAccountsKey].permissions;
        }
        else {
            return settings.tiddlyserver.hostLevelPermissions[this.hostLevelPermissionsKey];
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
        if (settings.server._devmode)
            setTimeout(() => {
                if (!this.responseSent)
                    this.debugLog(3, "Response not sent \n %s", new Error().stack);
            }, 0);
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
    recieveBody(errorCB) {
        return rx_1.Observable.fromEvent(this._req, 'data')
            //only take one since we only need one. this will dispose the listener
            .takeUntil(rx_1.Observable.fromEvent(this._req, 'end').take(1))
            //accumulate all the chunks until it completes
            .reduce((n, e) => { n.push(e); return n; }, [])
            //convert to json
            .forEach((e) => {
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
        })
            //returns a promise with the state
            .then(() => this);
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
function NodePromise(body) {
    return new Promise((resolve, reject) => {
        body((err, data) => err ? reject(err) : resolve(data));
    });
}
exports.NodePromise = NodePromise;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUE4QjtBQUM5QixrQ0FBbUQ7QUFFbkQsd0NBQXdDO0FBQ3hDLG9EQUFnRTtBQUNoRSwyQkFBMkM7QUFDM0MsK0JBQTRCO0FBQzVCLG1DQUEwQztBQUcxQywyQkFBNkQ7QUFDN0QsbUNBQW1DO0FBOENuQyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNwQixJQUFJLFFBQXNCLENBQUM7QUFDM0IsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUE7QUFDckMsSUFBSSxXQUFXLEdBQWEsSUFBSSxpQkFBUSxDQUFDO0lBQ3hDLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxRQUFRLEVBQUUsUUFBUTtRQUN6QyxrREFBa0Q7UUFDbEQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztZQUFFLEtBQUssR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNELDJDQUEyQztRQUMzQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU1RixJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO1lBQzdCLG1CQUFjLENBQ2IsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQ3hCLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQ25GLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUNwQixDQUFDO1NBQ0Y7UUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRTtZQUNsRSxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ25CO1FBQ0QsUUFBUSxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztDQUNELENBQUMsQ0FBQztBQUFBLENBQUM7QUFFSixjQUFxQixPQUEyQjtJQUMvQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQ2pELCtCQUErQjtRQUMvQixRQUFRLEdBQUcsR0FBRyxDQUFDO1FBQ2Ysa0JBQVUsR0FBRyxFQUFFLENBQUM7UUFDaEIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNwRCxHQUFHLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQzVDLElBQUksQ0FBQyxrQkFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO29CQUNyQixrQkFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQztpQkFDdkI7cUJBQU07b0JBQ04sTUFBTSxhQUFNLENBQUMscUNBQXFDLEVBQUUsR0FBRyxFQUFFLGtCQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7aUJBQ2hGO1lBQ0YsQ0FBQyxDQUFDLENBQUE7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNILGlDQUFpQztJQUNsQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFoQkQsb0JBZ0JDO0FBQ0QsNEJBQW1DLEdBQW9CO0lBQ3RELElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSTtRQUFFLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQy9CLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSTtRQUFFLEdBQUcsQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDO0lBQ3RDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSztRQUFFLEdBQUcsQ0FBQyxLQUFLLEdBQUc7WUFDM0IsVUFBVSxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztTQUMzQixDQUFBO0lBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJO1FBQUUsR0FBRyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7SUFDN0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVO1FBQUUsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDeEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVO1FBQUUsR0FBRyxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFDNUMsSUFBSSxPQUFPLEdBQUcsQ0FBQyxVQUFVLEtBQUssUUFBUTtRQUFFLEdBQUcsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFNUQsQ0FBQyxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFXLEVBQUUsRUFBRTtRQUMxRCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztZQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFTLENBQUM7UUFDcEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLO1lBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDNUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNO1lBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7UUFDOUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFH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