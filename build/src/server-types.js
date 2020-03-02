"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
//import { StateObject } from "./index";
const JSON5 = require("json5");
const send = require("send");
const zlib_1 = require("zlib");
const os_1 = require("os");
const ipcalc = require("./ipcalc");
const server_config_1 = require("./server-config");
exports.normalizeSettings = server_config_1.normalizeSettings;
exports.ConvertSettings = server_config_1.ConvertSettings;
exports.Config = server_config_1.Config;
let DEBUGLEVEL = -1;
function init(eventer) {
    eventer.on("settings", function (set) { });
}
exports.init = init;
function as(obj) {
    return obj;
}
exports.as = as;
const assets = path.resolve(__dirname, "../assets");
const favicon = path.resolve(__dirname, "../assets/favicon.ico");
const stylesheet = path.resolve(__dirname, "../assets/directory.css");
function loadSettings(settingsFile, routeKeys) {
    console.log("Settings file: %s", settingsFile);
    const settingsString = fs
        .readFileSync(settingsFile, "utf8")
        .replace(/\t/gi, "    ")
        .replace(/\r\n/gi, "\n");
    let settingsObjSource = tryParseJSON(settingsString, e => {
        console.error(
        /*colors.BgWhite + */ colors.FgRed +
            "The settings file could not be parsed: %s" +
            colors.Reset, e.originalError.message);
        console.error(e.errorPosition);
        throw "The settings file could not be parsed: Invalid JSON";
    });
    if (!settingsObjSource.$schema)
        throw "The settings file needs to be upgraded to v2.1, please run > node upgrade-settings.js old new";
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
            console.log("The following tree items are reserved for use by TiddlyServer: %s", conflict.map(e => '"' + e + '"').join(", "));
    }
    //remove the https settings and return them separately
    return { settings: settingsObj, settingshttps };
}
exports.loadSettings = loadSettings;
function getHumanSize(size) {
    const TAGS = ["B", "KB", "MB", "GB", "TB", "PB"];
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
        const lines = json.split("\n");
        res.push(...lines.slice(0, position[0]));
        res.push(new Array(position[1]).join("-") + "^  " + message);
        res.push(...lines.slice(position[0]));
        return res.join("\n");
    }
    str = str.replace(/\t/gi, "    ").replace(/\r\n/gi, "\n");
    try {
        return JSON5.parse(str);
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
    if (typeof padStr === "undefined")
        padStr = " ";
    if (typeof pad === "number") {
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
function sanitizeJSON(key, value) {
    // returning undefined omits the key from being serialized
    if (!key) {
        return value;
    } //This is the entire value to be serialized
    else if (key.substring(0, 1) === "$")
        return;
    //Remove angular tags
    else if (key.substring(0, 1) === "_")
        return;
    //Remove NoSQL tags
    else
        return value;
}
exports.sanitizeJSON = sanitizeJSON;
function serveFile(state, file, root) {
    util_1.promisify(fs.stat)(root ? path.join(root, file) : file).then((stat) => {
        state.send({
            root,
            filepath: file,
            error: err => {
                state.log(2, "%s %s", err.status, err.message).throw(500);
            }
        });
        // return Observable.empty<StateObject>();
    }, err => {
        state.throw(404);
    });
}
exports.serveFile = serveFile;
function serveFolder(state, mount, root, serveIndex) {
    const pathname = state.url.pathname;
    if (state.url.pathname.slice(0, mount.length) !== mount) {
        state.log(2, "URL is different than the mount point %s", mount).throw(500);
    }
    else {
        state.send({
            root,
            filepath: pathname.slice(mount.length),
            error: err => {
                state.log(-1, "%s %s", err.status, err.message).throw(404);
            },
            directory: filepath => {
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
function serveFolderIndex(options) {
    async function readFolder(folder) {
        let files = await util_1.promisify(fs.readdir)(folder);
        let res = { directory: [], file: [] };
        await Promise.all(files.map(file => util_1.promisify(fs.stat)(path.join(folder, file)).then(stat => {
            let itemtype = stat.isDirectory()
                ? "directory"
                : stat.isFile()
                    ? "file"
                    : "other";
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
        header = header.headers["accept-encoding"];
    }
    var gzip = header
        .split(",")
        .map(e => e.split(";"))
        .filter(e => e[0] === "gzip")[0];
    var can = !!gzip && !!gzip[1] && parseFloat(gzip[1].split("=")[1]) > 0;
    return can;
}
exports.canAcceptGzip = canAcceptGzip;
function sendResponse(state, body, options = {}) {
    body = !Buffer.isBuffer(body) ? Buffer.from(body, "utf8") : body;
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
            "Content-Length": Buffer.isBuffer(body)
                ? body.length.toString()
                : Buffer.byteLength(body, "utf8").toString(),
            "Content-Type": options.contentType || "text/plain; charset=utf-8"
        });
        if (isGzip)
            state.setHeaders({ "Content-Encoding": "gzip" });
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
        result.treepathPortion.join("/"),
        result.filepathPortion.join("/")
    ]
        .filter(e => e)
        .join("/");
    const type = server_config_1.Config.isGroup(result.item) ? "group" : "folder";
    if (server_config_1.Config.isGroup(result.item)) {
        let $c = result.item.$children;
        const keys = $c.map(e => e.key);
        // const keys = Object.keys(result.item);
        const paths = $c.map(e => (server_config_1.Config.isPath(e) ? e.path : true));
        return Promise.resolve({
            keys,
            paths,
            dirpath,
            type: type
        });
    }
    else {
        return util_1.promisify(fs.readdir)(result.fullfilepath)
            .then(keys => {
            const paths = keys.map(k => path.join(result.fullfilepath, k));
            return { keys, paths, dirpath, type: type };
        })
            .catch(err => {
            if (!err)
                return Promise.reject(err);
            state.log(2, 'Error calling readdir on folder "%s": %s', result.fullfilepath, err.message);
            state.throw(500);
            return Promise.reject(false);
        });
    }
}
exports.getTreePathFiles = getTreePathFiles;
function getTreeOptions(state) {
    //nonsense we have to write because putsaver could be false
    // type putsaverT = Required<typeof state.settings.putsaver>;
    let putsaver = as(Object.assign({ enabled: true, gzipBackups: true, backupFolder: "", etag: "optional", etagAge: 3 }, (state.settings.putsaver || {})));
    let options = {
        auth: { $element: "auth", authError: 403, authList: null },
        putsaver: Object.assign({ $element: "putsaver" }, putsaver),
        index: {
            $element: "index",
            defaultType: state.settings.directoryIndex.defaultType,
            indexFile: [],
            indexExts: []
        }
    };
    // console.log(state.ancestry);
    state.ancestry.forEach(e => {
        // console.log(e);
        e.$options &&
            e.$options.forEach(f => {
                if (f.$element === "auth" ||
                    f.$element === "putsaver" ||
                    f.$element === "index") {
                    // console.log(f);
                    Object.keys(f).forEach(k => {
                        if (f[k] === undefined)
                            return;
                        options[f.$element][k] = f[k];
                    });
                }
            });
    });
    return options;
}
exports.getTreeOptions = getTreeOptions;
async function sendDirectoryIndex([_r, options]) {
    let { keys, paths, dirpath, type } = _r;
    let pairs = keys.map((k, i) => [k, paths[i]]);
    let entries = await Promise.all(keys.map(async (key, i) => {
        // if(paths[key] == null) debugger;
        let statpath = paths[i];
        let stat = statpath === true ? undefined : await statPath(statpath);
        // let e = { stat, key };
        // let linkpath = [dirpath, e.key].filter(e => e).join('/');
        return {
            name: key,
            path: key + (!stat || stat.itemtype === "folder" ? "/" : ""),
            type: !stat
                ? "group"
                : stat.itemtype === "file"
                    ? options.extTypes[key.split(".").pop()] || "other"
                    : stat.itemtype,
            size: stat && stat.stat ? getHumanSize(stat.stat.size) : ""
        };
    }));
    if (options.format === "json") {
        return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
    }
    else {
        let def = { path: dirpath, entries, type };
        return; //generateDirectoryListing(def, options);
    }
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
    let stats = [test.item.path, ...test.filepathPortion].map(e => {
        return (n = {
            statpath: path.join(n.statpath, e),
            index: n.index + 1,
            endStat: false
        });
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
        stat,
        statpath,
        index,
        endStat,
        itemtype: getItemType(stat, infostat),
        infostat: infostat && infostat.isFile() ? infostat : undefined
    };
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
function resolvePath(state, tree) {
    var reqpath;
    if (Array.isArray(state)) {
        reqpath = state;
    }
    else {
        reqpath = state.path;
    }
    reqpath = decodeURI(reqpath
        .slice()
        .filter(a => a)
        .join("/"))
        .split("/")
        .filter(a => a);
    if (!reqpath.every(a => a !== ".." && a !== "."))
        return;
    var result = treeWalker(tree, reqpath);
    if (reqpath.length > result.end && !result.folderPathFound)
        return;
    //get the remainder of the path
    let filepathPortion = reqpath.slice(result.end).map(a => a.trim());
    const fullfilepath = result.folderPathFound
        ? path.join(result.item.path, ...filepathPortion)
        : server_config_1.Config.isPath(result.item)
            ? result.item.path
            : "";
    return {
        item: result.item,
        ancestry: result.ancestry,
        treepathPortion: reqpath.slice(0, result.end),
        filepathPortion,
        reqpath,
        fullfilepath
    };
}
exports.resolvePath = resolvePath;
function fs_move(oldPath, newPath, callback) {
    fs.rename(oldPath, newPath, function (err) {
        if (err) {
            if (err.code === "EXDEV") {
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
        readStream.on("error", callback);
        writeStream.on("error", callback);
        readStream.on("close", function () {
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
    constructor(str) { }
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
        this.path = this.url.pathname.split("/");
        let t = new Date();
        this.timestamp = util_1.format("%s-%s-%s %s:%s:%s", t.getFullYear(), padLeft(t.getMonth() + 1, "00"), padLeft(t.getDate(), "00"), padLeft(t.getHours(), "00"), padLeft(t.getMinutes(), "00"), padLeft(t.getSeconds(), "00"));
        const interval = setInterval(() => {
            this.log(-2, "LONG RUNNING RESPONSE");
            this.log(-2, "%s %s ", this.req.method, this.req.url);
        }, 60000);
        _res.on("finish", () => {
            clearInterval(interval);
            if (this.hasCriticalLogs)
                this.eventer.emit("stateError", this);
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
        Object.assign(this.responseHeaders, headers, headers["Set-Cookie"]
            ? {
                "Set-Cookie": (this.responseHeaders["Set-Cookie"] || []).concat(headers["Set-Cookie"] || [])
            }
            : {});
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
                subthis.buffer(Buffer.from(data, "utf8"));
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
            Location: redirect
        }).empty();
    }
    send(options) {
        const { filepath, root, error, directory, headers } = options;
        const sender = send(this._req, filepath, { root });
        if (error)
            sender.on("error", error);
        if (directory)
            sender.on("directory", (res, fp) => directory(fp));
        if (headers)
            sender.on("headers", (res, fp) => {
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
            this._req.on("data", chunk => {
                if (typeof chunk === "string") {
                    chunks.push(Buffer.from(chunk));
                }
                else {
                    chunks.push(chunk);
                }
            });
            this._req.on("end", () => {
                this.body = Buffer.concat(chunks).toString("utf8");
                if (this.body.length === 0 || !parseJSON)
                    return resolve();
                let catchHandler = errorCB === true
                    ? (e) => {
                        this.respond(400, "", {
                            "Content-Type": "text/plain"
                        }).string(e.errorPosition);
                        //return undefined;
                    }
                    : errorCB;
                this.json = catchHandler
                    ? tryParseJSON(this.body, catchHandler)
                    : tryParseJSON(this.body);
                resolve();
            });
        });
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
            let date = util_1.format("%s-%s-%s %s:%s:%s", t.getFullYear(), padLeft(t.getMonth() + 1, "00"), padLeft(t.getDate(), "00"), padLeft(t.getHours(), "00"), padLeft(t.getMinutes(), "00"), padLeft(t.getSeconds(), "00"));
            this.debugOutput.write(" " +
                (msgLevel >= 3 ? colors.BgRed + colors.FgWhite : colors.FgRed) +
                prefix +
                " " +
                colors.FgCyan +
                date +
                colors.Reset +
                " " +
                util_1.format
                    .apply(null, [tempString, ...args])
                    .split("\n")
                    .map((e, i) => {
                    if (i > 0) {
                        return new Array(23 + prefix.length).join(" ") + e;
                    }
                    else {
                        return e;
                    }
                })
                    .join("\n"), "utf8");
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
function createHashmapString(keys, values) {
    if (keys.length !== values.length)
        throw "keys and values must be the same length";
    var obj = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    });
    return obj;
}
exports.createHashmapString = createHashmapString;
function createHashmapNumber(keys, values) {
    if (keys.length !== values.length)
        throw "keys and values must be the same length";
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
    PROGRAMMER_EXCEPTION: "A programmer exception occurred: %s"
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
                let ip = test.startsWith("-") ? test.slice(1) : test;
                let deny = test.startsWith("-");
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
                let ip = test.startsWith("-") ? test.slice(1) : test;
                let deny = test.startsWith("-");
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
        body((err, data) => (err ? reject(err) : resolve(data)));
    });
}
exports.NodePromise = NodePromise;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NlcnZlci10eXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDZCQUE2QjtBQUM3QiwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUU3QiwrQkFBeUM7QUFHekMsd0NBQXdDO0FBQ3hDLCtCQUErQjtBQUMvQiw2QkFBNkI7QUFHN0IsK0JBQXdDO0FBSXhDLDJCQUE2RDtBQUM3RCxtQ0FBbUM7QUFDbkMsbURBY3lCO0FBVXZCLDRCQWZBLGlDQUFpQixDQWVBO0FBQ2pCLDBCQWZBLCtCQUFlLENBZUE7QUFUZixpQkFKQSxzQkFBTSxDQUlBO0FBV1IsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFFcEIsU0FBZ0IsSUFBSSxDQUFDLE9BQTJCO0lBQzlDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLFVBQVMsR0FBaUIsSUFBRyxDQUFDLENBQUMsQ0FBQztBQUN6RCxDQUFDO0FBRkQsb0JBRUM7QUFhRCxTQUFnQixFQUFFLENBQUksR0FBTTtJQUMxQixPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFGRCxnQkFFQztBQUVELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQ3BELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLHVCQUF1QixDQUFDLENBQUM7QUFDakUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUseUJBQXlCLENBQUMsQ0FBQztBQUV0RSxTQUFnQixZQUFZLENBQUMsWUFBb0IsRUFBRSxTQUFtQjtJQUNwRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLFlBQVksQ0FBQyxDQUFDO0lBRS9DLE1BQU0sY0FBYyxHQUFHLEVBQUU7U0FDdEIsWUFBWSxDQUFDLFlB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