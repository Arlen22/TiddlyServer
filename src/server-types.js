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
            }
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
function NewDefaultSettings(set) {
    let newset = {
        __dirname: "",
        __filename: "",
        __assetsDir: "",
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
            _devmode: false,
            https: false
        }, set.server),
        authAccounts: set.authAccounts || {},
        tiddlyserver: Object.assign({
            etag: "",
            etagWindow: 3,
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
    return newset;
}
exports.NewDefaultSettings = NewDefaultSettings;
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
function normalizeSettings(set, settingsFile) {
    const settingsDir = path.dirname(settingsFile);
    set = NewDefaultSettings(set);
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
    set.server.https = ((https) => {
        if (!https)
            return undefined;
        else if (typeof https === "string")
            return require(https);
        else {
            const mapkey = (e) => {
                let passphrase = typeof e === "string" ? "" : e.passphrase, filepath = typeof e === "string" ? e : e.path;
                return {
                    buff: fs.readFileSync(path.resolve(settingsDir, filepath)), passphrase, path: path.resolve(settingsDir, filepath)
                };
            };
            const mapcert = (e) => ({
                buff: fs.readFileSync(path.resolve(settingsDir, e)), path: path.resolve(settingsDir, e)
            });
            return {
                key: https.key.map(mapkey),
                cert: https.cert.map(mapcert),
                pfx: https.cert.map(mapkey),
                passphrase: https.passphrase,
                rejectUnauthorizedCertificate: https.rejectUnauthorizedCertificate,
                requestClientCertificate: https.requestClientCertificate
            };
        }
    })(set.server.https);
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
    return set;
}
exports.normalizeSettings = normalizeSettings;
const assets = path.resolve(__dirname, '../assets');
const favicon = path.resolve(__dirname, '../assets/favicon.ico');
const stylesheet = path.resolve(__dirname, '../assets/directory.css');
function loadSettings(settingsFile, routeKeys) {
    console.log("Settings file: %s", settingsFile);
    const settingsString = fs.readFileSync(settingsFile, 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
    let settingsObj = tryParseJSON(settingsString, (e) => {
        console.error(/*colors.BgWhite + */ colors.FgRed + "The settings file could not be parsed: %s" + colors.Reset, e.originalError.message);
        console.error(e.errorPosition);
        throw "The settings file could not be parsed: Invalid JSON";
    });
    if (!settingsObj.$schema)
        throw "The settings file needs to be upgraded to v2.1, please run > node upgrade-settings.js old new";
    var schemaChecker = new bundled_lib_1.ajv({ allErrors: true, async: false });
    schemaChecker.addMetaSchema(require('../lib/json-schema-refs/json-schema-draft-06.json'));
    var validate = schemaChecker.compile(require("../settings.schema.json"));
    var valid = validate(settingsObj, "settings");
    var validationErrors = validate.errors;
    if (!valid)
        console.log(validationErrors && validationErrors.map(e => [e.keyword.toUpperCase() + ":", e.dataPath, e.message].join(' ')).join('\n'));
    if (!settingsObj.tree)
        throw "tree is not specified in the settings file";
    // let routeKeys = Object.keys(routes);
    settingsObj = normalizeSettings(settingsObj, settingsFile);
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
        // let routeKeys = Object.keys(routes);
        let conflict = keys.filter(k => routeKeys.indexOf(k) > -1);
        if (conflict.length)
            console.log("The following tree items are reserved for use by TiddlyServer: %s", conflict.map(e => '"' + e + '"').join(', '));
    }
    //remove the https settings and return them separately
    let settingshttps = settingsObj.server.https;
    settingsObj.server.https = !!settingsObj.server.https;
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
            ancestry.push(getAncesterEntry(item));
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
    constructor(_req, _res, debugLog, eventer, hostLevelPermissionsKey, authAccountsKey) {
        this._req = _req;
        this._res = _res;
        this.debugLog = debugLog;
        this.eventer = eventer;
        this.hostLevelPermissionsKey = hostLevelPermissionsKey;
        this.authAccountsKey = authAccountsKey;
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
        return settings.tiddlyserver.hostLevelPermissions[this.hostLevelPermissionsKey];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUE4QjtBQUM5QixrQ0FBbUQ7QUFFbkQsd0NBQXdDO0FBQ3hDLG9EQUErQztBQUMvQywyQkFBMkM7QUFDM0MsK0JBQTRCO0FBQzVCLG1DQUEwQztBQUcxQywyQkFBNkQ7QUFDN0QsbUNBQW1DO0FBOENuQyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNwQixJQUFJLFFBQXNCLENBQUM7QUFDM0IsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUE7QUFDckMsSUFBSSxXQUFXLEdBQWEsSUFBSSxpQkFBUSxDQUFDO0lBQ3hDLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxRQUFRLEVBQUUsUUFBUTtRQUN6QyxrREFBa0Q7UUFDbEQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztZQUFFLEtBQUssR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNELDJDQUEyQztRQUMzQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU1RixJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO1lBQzdCLG1CQUFjLENBQ2IsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQ3hCLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQ25GLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUNwQixDQUFDO1NBQ0Y7UUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRTtZQUNsRSxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ25CO1FBQ0QsUUFBUSxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztDQUNELENBQUMsQ0FBQztBQUFBLENBQUM7QUFFSixjQUFxQixPQUEyQjtJQUMvQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQ2pELCtCQUErQjtRQUMvQixRQUFRLEdBQUcsR0FBRyxDQUFDO1FBQ2Ysa0JBQVUsR0FBRyxFQUFFLENBQUM7UUFDaEIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNwRCxHQUFHLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQzVDLElBQUksQ0FBQyxrQkFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO29CQUNyQixrQkFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQztpQkFDdkI7cUJBQU07b0JBQ04sTUFBTSxhQUFNLENBQUMscUNBQXFDLEVBQUUsR0FBRyxFQUFFLGtCQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7aUJBQ2hGO1lBQ0YsQ0FBQyxDQUFDLENBQUE7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNILGlDQUFpQztJQUNsQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFoQkQsb0JBZ0JDO0FBQ0QsNEJBQW1DLEdBQW9CO0lBQ3RELElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSTtRQUFFLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQy9CLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSTtRQUFFLEdBQUcsQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDO0lBQ3RDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSztRQUFFLEdBQUcsQ0FBQyxLQUFLLEdBQUc7WUFDM0IsVUFBVSxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztTQUMzQixDQUFBO0lBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJO1FBQUUsR0FBRyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7SUFDN0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVO1FBQUUsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDeEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVO1FBQUUsR0FBRyxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFDNUMsSUFBSSxPQUFPLEdBQUcsQ0FBQyxVQUFVLEtBQUssUUFBUTtRQUFFLEdBQUcsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFNUQsQ0FBQyxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFXLEVBQUUsRUFBRTtRQUMxRCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztZQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFTLENBQUM7UUFDcEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLO1lBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDNUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNO1lBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7UUFDOUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFH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