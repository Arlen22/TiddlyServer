import * as http from "http";
import * as url from "url";
import * as fs from "fs";
import * as path from "path";

import { format, promisify } from "util";
// import { Observable, Subscriber } from '../lib/rx';
import { EventEmitter } from "events";
//import { StateObject } from "./index";
import * as JSON5 from "json5";
import * as send from "send";
import * as WebSocket from "ws";
import { Stats, appendFileSync } from "fs";
import { gzip, createGzip } from "zlib";
import { Writable, Stream } from "stream";
// import { TlsOptions } from 'tls';
import * as https from "https";
import { networkInterfaces, NetworkInterfaceInfo } from "os";
import * as ipcalc from "./ipcalc";
import {
  NewTreeOptions,
  NewTreePathOptions_Auth,
  NewTreePathOptions_Index,
  ServerConfig,
  ServerConfigBase,
  ServerConfigSchema,
  ServerConfig_AccessOptions,
  ServerConfig_BindInfo,
  normalizeSettings,
  ConvertSettings,
  NewTreeOptionsObject,
  Config,
  OptionsConfig
} from "./server-config";
export {
  Config,
  NewTreeOptions,
  NewTreePathOptions_Auth,
  NewTreePathOptions_Index,
  ServerConfig,
  ServerConfigBase,
  ServerConfigSchema,
  ServerConfig_AccessOptions,
  normalizeSettings,
  ConvertSettings
};
let DEBUGLEVEL = -1;

export function init(eventer: ServerEventEmitter) {
  eventer.on("settings", function(set: ServerConfig) {});
}

type PromiseType<T> = T extends Promise<infer R> ? R : any;
type PromiseReturnType<T extends (...args: any) => any> = ReturnType<
  T
> extends Promise<infer R>
  ? R
  : any;

interface Async<T> extends Promise<T> {
  readonly type: T;
}

export function as<T>(obj: T) {
  return obj;
}

const assets = path.resolve(__dirname, "../assets");
const favicon = path.resolve(__dirname, "../assets/favicon.ico");
const stylesheet = path.resolve(__dirname, "../assets/directory.css");

export function loadSettings(settingsFile: string, routeKeys: string[]) {
  console.log("Settings file: %s", settingsFile);

  const settingsString = fs
    .readFileSync(settingsFile, "utf8")
    .replace(/\t/gi, "    ")
    .replace(/\r\n/gi, "\n");

  let settingsObjSource: ServerConfigSchema = tryParseJSON<ServerConfigSchema>(
    settingsString,
    e => {
      console.error(
        /*colors.BgWhite + */ colors.FgRed +
          "The settings file could not be parsed: %s" +
          colors.Reset,
        e.originalError.message
      );
      console.error(e.errorPosition);
      throw "The settings file could not be parsed: Invalid JSON";
    }
  );

  if (!settingsObjSource.$schema)
    throw "The settings file needs to be upgraded to v2.1, please run > node upgrade-settings.js old new";

  if (!settingsObjSource.tree)
    throw "tree is not specified in the settings file";
  // let routeKeys = Object.keys(routes);
  let settingshttps =
    settingsObjSource.bindInfo && settingsObjSource.bindInfo.https;
  let settingsObj = normalizeSettings(settingsObjSource, settingsFile);

  settingsObj.__assetsDir = assets;
  settingsObj.__targetTW = settingsObj._datafoldertarget
    ? path.resolve(settingsObj.__dirname, settingsObj._datafoldertarget)
    : path.resolve(__dirname, "../tiddlywiki");

  if (typeof settingsObj.tree === "object") {
    let keys: string[] = [];
    settingsObj.tree;
    let conflict = keys.filter(k => routeKeys.indexOf(k) > -1);
    if (conflict.length)
      console.log(
        "The following tree items are reserved for use by TiddlyServer: %s",
        conflict.map(e => '"' + e + '"').join(", ")
      );
  }
  //remove the https settings and return them separately
  return { settings: settingsObj, settingshttps };
}

export interface RequestEvent {
  /** mark the request as handled, canceling any further processing */
  handled: boolean;
  /** the username to give to data folders and anywhere else it is needed */
  username: string;
  /** auth account key to be applied to this request */
  authAccountKey: string;
  /** hostLevelPermissions key to be applied to this request */
  localAddressPermissionsKey: string;
  interface: {
    /** HTTP server "host" option for this request (i.e. server.listen bind address) */
    iface: string;
    /** the host header */
    host: string | undefined;
    /** socket.localAddress */
    addr: string;
  };
  /** tree hosts array index to be applied to this request */
  treeHostIndex: number;
  /** the ServerConfig currently in use on the server */
  readonly settings: ServerConfig;
  request: http.IncomingMessage;
  /** A custom debug output may be set, otherwise the default is used */
  debugOutput: Writable;
}
export interface RequestEventHTTP extends RequestEvent {
  response: http.ServerResponse;
}
export interface RequestEventWS extends RequestEvent {
  client: WebSocket;
}

interface ServerEventsListener<THIS> {
  (
    event: "websocket-connection",
    listener: (data: RequestEventWS) => void
  ): THIS;
  (
    event: "settingsChanged",
    listener: (keys: (keyof ServerConfig)[]) => void
  ): THIS;
  (event: "settings", listener: (settings: ServerConfig) => void): THIS;
  (event: "stateError", listener: (state: StateObject) => void): THIS;
  (event: "stateDebug", listener: (state: StateObject) => void): THIS;
  (
    event: "serverOpen",
    listener: (
      serverList: any[],
      hosts: string[],
      https: boolean,
      dryRun: boolean
    ) => void
  ): THIS;
  (event: "serverClose", listener: (iface: string) => void): THIS;
}
type ServerEvents = "websocket-connection" | "settingsChanged" | "settings";
export interface ServerEventEmitter extends EventEmitter {
  emit(event: "websocket-connection", data: RequestEventWS): boolean;
  emit(event: "settingsChanged", keys: (keyof ServerConfig)[]): boolean;
  emit(event: "settings", settings: ServerConfig): boolean;
  emit(event: "stateError", state: StateObject<any, any>): boolean;
  emit(event: "stateDebug", state: StateObject<any, any>): boolean;
  emit(
    event: "serverOpen",
    serverList: any[],
    hosts: string[],
    https: boolean,
    dryRun: boolean
  ): boolean;
  emit(event: "serverClose", iface: string): boolean;
  // emit<T>(event: T, args: Parameters<ServerEventsListener<any>>)
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
  eventNames(): ServerEvents[];
  listenerCount(type: ServerEvents): number;
}
export function getHumanSize(size: number) {
  const TAGS = ["B", "KB", "MB", "GB", "TB", "PB"];
  let power = 0;
  while (size >= 1024) {
    size /= 1024;
    power++;
  }
  return size.toFixed(1) + TAGS[power];
}

export type Hashmap<T> = { [K: string]: T };

export type FolderEntryType =
  | "folder"
  | "datafolder"
  | "htmlfile"
  | "other"
  | "error";

export interface DirectoryEntry {
  name: string;
  type: string;
  path: string;
  size: string;
}

export interface Directory {
  path: string;
  entries: DirectoryEntry[];
  type: string;
}

// export function tryParseJSON(str: string, errObj?: { error?: JsonError }): any;
// export function tryParseJSON(str: string, errObj?: ((e: JsonError) => T | void)): T;
/**
 * Calls the onerror handler if there is a JSON error. Returns whatever the error handler
 * returns. If there is no error handler, undefined is returned.
 * The string "undefined" is not a valid JSON document.
 */
export function tryParseJSON<T = any>(
  str: string,
  onerror: (e: JsonError) => never
): T;
export function tryParseJSON<T = any>(
  str: string,
  onerror: (e: JsonError) => T
): T;
export function tryParseJSON<T = any>(
  str: string,
  onerror: (e: JsonError) => void
): T | undefined;
export function tryParseJSON<T = any>(
  str: string,
  onerror?: undefined
): T | undefined;
export function tryParseJSON<T = any>(
  str: string,
  onerror?: (e: JsonError) => T
): T | undefined {
  function findJSONError(message: string, json: string) {
    console.log(message);
    const res: string[] = [];
    const match = /at (\d+):(\d+)/gi.exec(message);
    if (!match) return "";
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
  } catch (e) {
    let err = new JsonError(findJSONError(e.message, str), e);
    if (onerror) return onerror(err);
  }
}
export interface JsonErrorContainer {
  error?: JsonError;
}
export class JsonError {
  public filePath: string = "";
  constructor(
    /** The full JSON string showing the position of the error */
    public errorPosition: string,
    /** The original error return by JSON.parse */
    public originalError: Error
  ) {}
}

export function keys<T>(o: T): (keyof T)[] {
  return Object.keys(o) as (keyof T)[];
}
export function padLeft(
  str: any,
  pad: number | string,
  padStr?: string
): string {
  var item = str.toString();
  if (typeof padStr === "undefined") padStr = " ";
  if (typeof pad === "number") {
    pad = new Array(pad + 1).join(padStr);
  }
  //pad: 000000 val: 6543210 => 654321
  return pad.substr(0, Math.max(pad.length - item.length, 0)) + item;
}
export function sortBySelector<T extends { [k: string]: string }>(
  key: (e: T) => any
) {
  return function(a: T, b: T) {
    var va = key(a);
    var vb = key(b);

    if (va > vb) return 1;
    else if (va < vb) return -1;
    else return 0;
  };
}
export function sortByKey(key: string) {
  return sortBySelector(e => e[key]);
}
export namespace colors {
  export const Reset = "\x1b[0m";
  export const Bright = "\x1b[1m";
  export const Dim = "\x1b[2m";
  export const Underscore = "\x1b[4m";
  export const Blink = "\x1b[5m";
  export const Reverse = "\x1b[7m";
  export const Hidden = "\x1b[8m";

  export const FgBlack = "\x1b[30m";
  export const FgRed = "\x1b[31m";
  export const FgGreen = "\x1b[32m";
  export const FgYellow = "\x1b[33m";
  export const FgBlue = "\x1b[34m";
  export const FgMagenta = "\x1b[35m";
  export const FgCyan = "\x1b[36m";
  export const FgWhite = "\x1b[37m";

  export const BgBlack = "\x1b[40m";
  export const BgRed = "\x1b[41m";
  export const BgGreen = "\x1b[42m";
  export const BgYellow = "\x1b[43m";
  export const BgBlue = "\x1b[44m";
  export const BgMagenta = "\x1b[45m";
  export const BgCyan = "\x1b[46m";
  export const BgWhite = "\x1b[47m";
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
declare function DebugLog(
  this: { debugOutput: Writable; settings: ServerConfig },
  level: number,
  str: string | NodeJS.ErrnoException,
  ...args: any[]
);
// declare function DebugLog(str: string, ...args: any[]);
export function isError(obj): obj is Error {
  return !!obj && obj.constructor === Error;
  // return [obj.message, obj.name].every(e => typeof e !== "undefined");
}
export function isErrnoException(
  obj: NodeJS.ErrnoException
): obj is NodeJS.ErrnoException {
  return isError(obj);
}

export function sanitizeJSON(key: string, value: any) {
  // returning undefined omits the key from being serialized
  if (!key) {
    return value;
  } //This is the entire value to be serialized
  else if (key.substring(0, 1) === "$") return;
  //Remove angular tags
  else if (key.substring(0, 1) === "_") return;
  //Remove NoSQL tags
  else return value;
}

export interface ServeStaticResult {
  status: number;
  headers: {};
  message: string;
}

export function serveFile(
  state: StateObject,
  file: string,
  root: string | undefined
) {
  promisify(fs.stat)(root ? path.join(root, file) : file).then(
    (stat): any => {
      state.send({
        root,
        filepath: file,
        error: err => {
          state.log(2, "%s %s", err.status, err.message).throw(500);
        }
      });
      // return Observable.empty<StateObject>();
    },
    err => {
      state.throw<StateObject>(404);
    }
  );
}
export function serveFolder(
  state: StateObject,
  mount: string,
  root: string,
  serveIndex?: Function
) {
  const pathname = state.url.pathname;
  if (state.url.pathname.slice(0, mount.length) !== mount) {
    state.log(2, "URL is different than the mount point %s", mount).throw(500);
  } else {
    state.send({
      root,
      filepath: pathname.slice(mount.length),
      error: err => {
        state.log(-1, "%s %s", err.status, err.message).throw(404);
      },
      directory: filepath => {
        if (serveIndex) {
          serveIndex(state, filepath);
        } else {
          state.throw(403);
        }
      }
    });
  }
}
export function serveFolderIndex(options: { type: string }) {
  async function readFolder(folder: string) {
    let files = await promisify(fs.readdir)(folder);
    let res = { directory: [], file: [] };
    await Promise.all(
      files.map(file =>
        promisify(fs.stat)(path.join(folder, file)).then(
          stat => {
            let itemtype = stat.isDirectory()
              ? "directory"
              : stat.isFile()
              ? "file"
              : "other";
            res[itemtype].push(file);
          },
          x => undefined
        )
      )
    );
    return res;
  }
  if (options.type === "json") {
    return function(state: StateObject, folder: string) {
      readFolder(folder).then(item => {
        sendResponse(state, JSON.stringify(item), {
          contentType: "application/json",
          doGzip: canAcceptGzip(state.req)
        });
      });
    };
  }
}
export function canAcceptGzip(
  header: string | { headers: http.IncomingHttpHeaders }
) {
  if (
    ((a): a is { headers: http.IncomingHttpHeaders } => typeof a === "object")(
      header
    )
  ) {
    header = header.headers["accept-encoding"] as string;
  }
  var gzip = header
    .split(",")
    .map(e => e.split(";"))
    .filter(e => e[0] === "gzip")[0];
  var can = !!gzip && !!gzip[1] && parseFloat(gzip[1].split("=")[1]) > 0;
  return can;
}

export function sendResponse(
  state: StateObject,
  body: Buffer | string,
  options: {
    doGzip?: boolean;
    contentType?: string;
  } = {}
) {
  body = !Buffer.isBuffer(body) ? Buffer.from(body, "utf8") : body;
  if (options.doGzip)
    gzip(body, (err, gzBody) => {
      if (err) _send(body, false);
      else _send(gzBody, true);
    });
  else _send(body, false);

  function _send(body, isGzip) {
    state.setHeaders({
      "Content-Length": Buffer.isBuffer(body)
        ? body.length.toString()
        : Buffer.byteLength(body, "utf8").toString(),
      "Content-Type": options.contentType || "text/plain; charset=utf-8"
    });
    if (isGzip) state.setHeaders({ "Content-Encoding": "gzip" });
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
export function getTreePathFiles(
  result: PathResolverResult,
  state: StateObject
): Promise<DirectoryIndexData> {
  let dirpath = [
    result.treepathPortion.join("/"),
    result.filepathPortion.join("/")
  ]
    .filter(e => e)
    .join("/");
  const type = Config.isGroup(result.item) ? "group" : "folder";
  if (Config.isGroup(result.item)) {
    let $c = result.item.$children;
    const keys = $c.map(e => e.key);
    // const keys = Object.keys(result.item);
    const paths = $c.map(e => (Config.isPath(e) ? e.path : true));
    return Promise.resolve({
      keys,
      paths,
      dirpath,
      type: type as "group" | "folder"
    });
  } else {
    return promisify(fs.readdir)(result.fullfilepath)
      .then(keys => {
        const paths = keys.map(k => path.join(result.fullfilepath, k));
        return { keys, paths, dirpath, type: type as "group" | "folder" };
      })
      .catch(err => {
        if (!err) return Promise.reject(err);
        state.log(
          2,
          'Error calling readdir on folder "%s": %s',
          result.fullfilepath,
          err.message
        );
        state.throw(500);
        return Promise.reject(false);
      });
  }
}

export function getTreeOptions(state: StateObject) {
  //nonsense we have to write because putsaver could be false
  // type putsaverT = Required<typeof state.settings.putsaver>;
  let putsaver = as<typeof state.settings.putsaver>({
    enabled: true,
    gzipBackups: true,
    backupFolder: "",
    etag: "optional",
    etagAge: 3,
    ...(state.settings.putsaver || {})
  });
  let options: OptionsConfig = {
    auth: { $element: "auth", authError: 403, authList: null },
    putsaver: { $element: "putsaver", ...putsaver },
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
        if (
          f.$element === "auth" ||
          f.$element === "putsaver" ||
          f.$element === "index"
        ) {
          // console.log(f);
          Object.keys(f).forEach(k => {
            if (f[k] === undefined) return;
            options[f.$element][k] = f[k];
          });
        }
      });
  });
  return options;
}

//const generateDirectoryListing: (...args: any[]) => string = require('./generateDirectoryListing').generateDirectoryListing;
export type DirectoryIndexData = {
  keys: string[];
  paths: (string | true)[];
  dirpath: string;
  type: "group" | "folder";
};
export type DirectoryIndexOptions = {
  upload: boolean;
  mkdir: boolean;
  format: "json" | "html";
  mixFolders: boolean;
  isLoggedIn: string | false;
  extTypes: { [ext: string]: string };
};
export async function sendDirectoryIndex([_r, options]: [
  DirectoryIndexData,
  DirectoryIndexOptions
]) {
  let { keys, paths, dirpath, type } = _r;
  let pairs = keys.map((k, i) => [k, paths[i]] as [string, string | boolean]);
  let entries = await Promise.all(
    keys.map(async (key, i) => {
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
          ? options.extTypes[key.split(".").pop() as string] || "other"
          : (stat.itemtype as string),
        size: stat && stat.stat ? getHumanSize(stat.stat.size) : ""
      };
    })
  );
  if (options.format === "json") {
    return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
  } else {
    let def = { path: dirpath, entries, type };
    return; //generateDirectoryListing(def, options);
  }
}

/**
 * If the path
 */
export async function statWalkPath(test: PathResolverResult) {
  if (!Config.isPath(test.item)) {
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
    if (!s) throw new Error("PROGRAMMER ERROR");
    let res = await statPath(s);
    if (res.endStat || stats.length === 0) return res;
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
export function statsafe(p: string) {
  return promisify(fs.stat)(p).catch(x => undefined);
}
/**
 * returns the info about the specified path. endstat is true if the statpath is not
 * found or if it is a directory and contains a tiddlywiki.info file, or if it is a file.
 *
 * @param {({ statpath: string, index: number, endStat: boolean } | string)} s
 * @returns
 */
export async function statPath(
  s: { statpath: string; index: number } | string
) {
  if (typeof s === "string") s = { statpath: s, index: 0 };
  const { statpath, index } = s;
  let stat = await statsafe(statpath);
  let endStat = !stat || !stat.isDirectory();
  let infostat: fs.Stats | undefined = undefined;
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
  } as StatPathResult;
}

function getItemType(stat: Stats | undefined, infostat: Stats | undefined) {
  let itemtype;

  if (!stat) itemtype = "error";
  else if (stat.isDirectory()) itemtype = !!infostat ? "datafolder" : "folder";
  else if (stat.isFile() || stat.isSymbolicLink()) itemtype = "file";
  else itemtype = "error";

  return itemtype;
}
export function treeWalker(
  tree: Config.GroupElement | Config.PathElement,
  reqpath
) {
  function getAncesterEntry(a) {
    return Object.assign({}, a, { $children: undefined });
  }
  var item = tree;
  var ancestry: Config.MountElement[] = [];
  var folderPathFound = Config.isPath(item);
  for (var end = 0; end < reqpath.length; end++) {
    if (Config.isPath(item)) {
      folderPathFound = true;
      break;
    }
    let t = item.$children.find(
      (e): e is Config.GroupElement | Config.PathElement =>
        (Config.isGroup(e) || Config.isPath(e)) && e.key === reqpath[end]
    );
    if (t) {
      ancestry.push(item);
      item = t;
    } else {
      break;
    }
  }
  return { item, end, folderPathFound, ancestry } as TreePathResult;
}

export function resolvePath(
  state: StateObject | string[],
  tree: Config.MountElement
): PathResolverResult | undefined {
  var reqpath;
  if (Array.isArray(state)) {
    reqpath = state;
  } else {
    reqpath = state.path;
  }

  reqpath = decodeURI(
    reqpath
      .slice()
      .filter(a => a)
      .join("/")
  )
    .split("/")
    .filter(a => a);

  if (!reqpath.every(a => a !== ".." && a !== ".")) return;

  var result = treeWalker(tree, reqpath);

  if (reqpath.length > result.end && !result.folderPathFound) return;

  //get the remainder of the path
  let filepathPortion = reqpath.slice(result.end).map(a => a.trim());

  const fullfilepath = result.folderPathFound
    ? path.join(result.item.path, ...filepathPortion)
    : Config.isPath(result.item)
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

type NodeCallback<T, S> = [NodeJS.ErrnoException, T, S];

export function fs_move(oldPath, newPath, callback) {
  fs.rename(oldPath, newPath, function(err) {
    if (err) {
      if (err.code === "EXDEV") {
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

    readStream.on("error", callback);
    writeStream.on("error", callback);

    readStream.on("close", function() {
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
export interface IStatPathResult<IT, ST, IFST, END> {
  stat: ST;
  infostat: IFST;
  index: number;
  endStat: END;
  itemtype: IT;
  statpath: string;
}
export type StatPathResult =
  | IStatPathResult<"error", fs.Stats | undefined, undefined, true>
  | IStatPathResult<"folder", fs.Stats, undefined, false>
  | IStatPathResult<"datafolder", fs.Stats, fs.Stats, true>
  | IStatPathResult<"file", fs.Stats, undefined, true>;
// export interface
// export type LoggerFunc = (str: string, ...args: any[]) => void;
export class URLSearchParams {
  constructor(str: string) {}
}
export interface StateObjectUrl {
  path: string;
  pathname: string;
  query: Hashmap<string[] | string | undefined>;
  search: string;
  href: string;
}
type StandardResponseHeaderValue = number | string | string[] | undefined;
export interface StandardResponseHeaders {
  /** Specifying which web sites can participate in cross-origin resource sharing */
  "Access-Control-Allow-Origin"?: string;
  /** Specifying which web sites can participate in cross-origin resource sharing */
  "Access-Control-Allow-Credentials"?: string;
  /** Specifying which web sites can participate in cross-origin resource sharing */
  "Access-Control-Expose-Headers"?: string;
  /** Specifying which web sites can participate in cross-origin resource sharing */
  "Access-Control-Max-Age"?: string;
  /** Specifying which web sites can participate in cross-origin resource sharing */
  "Access-Control-Allow-Methods"?: string;
  /** Specifying which web sites can participate in cross-origin resource sharing */
  "Access-Control-Allow-Headers"?: string;
  /** Specifies which patch document formats this server supports */
  "Accept-Patch"?: string;
  /** What partial content range types this server supports via byte serving */
  "Accept-Ranges"?: string;
  /** The age the object has been in a proxy cachein seconds */
  Age?: string;
  /** Valid methods for a specified resource. To be used for a 405 Method not allowed */
  Allow?: string;
  /**
   * A server uses "Alt-Svc" header (meaning Alternative Services) to indicate that its resources can also be accessed at a different
   * When using HTTP/2, servers should instead send an ALTSVC frame. [45]
   */
  "Alt-Svc"?: string;
  /** Tells all caching mechanisms from server to client whether they may cache this object. It is measured in seconds */
  "Cache-Control"?: string;
  /** Control options for the current connection and list of hop-by-hop response fields.[12] Must not be used with HTTP/2.[13] */
  Connection?: string;
  /** An opportunity to raise a "File Download" dialogue box for a known MIME type with binary format or suggest a filename for dynami */
  "Content-Disposition"?: string;
  /** The type of encoding used on the data. See HTTP compression. */
  "Content-Encoding"?: string;
  /** The natural language or languages of the intended audience for the enclosed content[47] */
  "Content-Language"?: string;
  /** The length of the response body in octets (8-bit bytes) */
  "Content-Length"?: string;
  /** An alternate location for the returned data */
  "Content-Location"?: string;
  /** A Base64-encoded binary MD5 sum of the content of the response */
  "Content-MD5"?: string;
  /** Where in a full body message this partial message belongs */
  "Content-Range"?: string;
  /** The MIME type of this content */
  "Content-Type"?: string;
  /** The date and time that the message was sent (in "HTTP-date" format as defined by RFC 7231) [48] */
  Date?: string;
  /** Specifies the delta-encoding entity tag of the response[10]. */
  "Delta-Base"?: string;
  /** An identifier for a specific version of a resource, often a message digest */
  ETag?: string;
  /** Gives the date/time after which the response is considered stale (in "HTTP-date" format as defined by RFC 7231) */
  Expires?: string;
  /** Instance-manipulations applied to the response[10]. */
  IM?: string;
  /** The last modified date for the requested object (in "HTTP-date" format as defined by RFC 7231) */
  "Last-Modified"?: string;
  /** Used to express a typed relationship with another resource, where the relation type is defined by RFC 5988 */
  Link?: string;
  /** Used in redirection, or when a new resource has been created. */
  Location?: string;
  /** This field is supposed to set P3P policy, in the form of P3P:CP="your_compact_policy". However, P3P did not take off,[50] most b*/
  P3P?: string;
  /** Implementation-specific fields that may have various effects anywhere along the request-response chain. */
  Pragma?: string;
  /** Request authentication to access the proxy. */
  "Proxy-Authenticate"?: string;
  /** HTTP Public Key Pinning, announces hash of website's authentic TLS certificate */
  "Public-Key-Pins"?: string;
  /** If an entity is temporarily unavailable, this instructs the client to try again later. Value could be a specified period of time*/
  "Retry-After"?: string;
  /** A name for the server */
  Server?: string;
  /** An HTTP cookie */
  "Set-Cookie"?: string[];
  /** A HSTS Policy informing the HTTP client how long to cache the HTTPS only policy and whether this applies to subdomains. */
  "Strict-Transport-Security"?: string;
  /** The Trailer general field value indicates that the given set of header fields is present in the trailer of a message encoded wit */
  Trailer?: string;
  /** The form of encoding used to safely transfer the entity to the user. Currently defined methods are: chunked, compress, deflate, */
  "Transfer-Encoding"?: string;
  /** Tracking Status header, value suggested to be sent in response to a DNT(do-not-track), possible values: */
  Tk?: string;
  /** Ask the client to upgrade to another protocol. */
  Upgrade?: string;
  /** Tells downstream proxies how to match future request headers to decide whether the cached response can be used rather than reque */
  Vary?: string;
  /** Informs the client of proxies through which the response was sent. */
  Via?: string;
  /** A general warning about possible problems with the entity body. */
  Warning?: string;
  /** Indicates the authentication scheme that should be used to access the requested entity. */
  "WWW-Authenticate"?: string;
  /** Clickjacking protection: deny - no rendering within a frame, sameorigin - no rendering if origin mismatch, allow-from - allow fr */
  "X-Frame-Options"?: string;
  "x-api-access-type"?: string;
  dav?: string;
  etag?: string;
}
export class StateObject<STATPATH = StatPathResult, T = any> {
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
    // return (obs: Observable<any>): any => {
    // 	return obs.mergeMap((state: StateObject) => {
    // 		if (reason)
    // 			return state.throwReason(status, reason);
    // 		else
    // 			return state.throw(status);
    // 	})
    // }
  }

  get allow(): ServerConfig_AccessOptions {
    if (this.authAccountsKey) {
      return this.settings.authAccounts[this.authAccountsKey].permissions;
    } else {
      return this.settings.bindInfo.localAddressPermissions[
        this.hostLevelPermissionsKey
      ];
    }
  }

  get hostRoot() {
    return this.settings.tree[this.treeHostIndex].$mount;
  }

  // req: http.IncomingMessage;
  // res: http.ServerResponse;
  startTime: [number, number];
  timestamp: string;

  body: string = "";
  json: any | undefined;

  /** The StatPathResult if this request resolves to a path */
  //@ts-ignore Property has no initializer and is not definitely assigned in the constructor.
  statPath: STATPATH;
  /** The tree ancestors in descending order, including the final folder element. */
  //@ts-ignore Property has no initializer and is not definitely assigned in the constructor.
  ancestry: Config.MountElement[];
  /** The tree ancestors options as they apply to this request */
  //@ts-ignore Property has no initializer and is not definitely assigned in the constructor.
  treeOptions: OptionsConfig;

  url: StateObjectUrl;

  path: string[];

  // maxid: number;

  // where: string;
  query: any;
  // errorThrown: Error;

  restrict: any;

  // expressNext: ((err?: any) => void) | false;

  pathOptions: {
    noTrailingSlash: boolean;
  } = {
    noTrailingSlash: false
  };

  req: http.IncomingMessage;
  res: http.ServerResponse;

  responseHeaders: StandardResponseHeaders = {} as any;
  responseSent: boolean = false;

  constructor(
    private _req: http.IncomingMessage,
    private _res: http.ServerResponse,

    private eventer: ServerEventEmitter,
    public hostLevelPermissionsKey: string,
    public authAccountsKey: string,
    /** The HostElement array index in settings.tree */
    public treeHostIndex: number,
    public username: string,
    public readonly settings: Readonly<ServerConfig>,
    public debugOutput: Writable
  ) {
    this.startTime = process.hrtime();
    this.req = _req;
    this.res = _res;
    //parse the url and store in state.
    this.url = StateObject.parseURL(this.req.url as string);
    //parse the path for future use
    this.path = (this.url.pathname as string).split("/");

    let t = new Date();
    this.timestamp = format(
      "%s-%s-%s %s:%s:%s",
      t.getFullYear(),
      padLeft(t.getMonth() + 1, "00"),
      padLeft(t.getDate(), "00"),
      padLeft(t.getHours(), "00"),
      padLeft(t.getMinutes(), "00"),
      padLeft(t.getSeconds(), "00")
    );
    const interval = setInterval(() => {
      this.log(-2, "LONG RUNNING RESPONSE");
      this.log(-2, "%s %s ", this.req.method, this.req.url);
    }, 60000);
    _res.on("finish", () => {
      clearInterval(interval);
      if (this.hasCriticalLogs) this.eventer.emit("stateError", this);
      else this.eventer.emit("stateDebug", this);
    });
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
  log(level: number, template: any, ...args: any[]) {
    if (level < this.loglevel) return this;
    if (level > 1) {
      this.hasCriticalLogs = true;
      debugger;
    }
    this.doneMessage.push(format(template, ...args));
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
  throwError<T = StateObject>(
    statusCode: number,
    error: ER,
    headers?: StandardResponseHeaders
  ) {
    return this.throwReason(
      statusCode,
      this.allow.writeErrors ? error : error.reason,
      headers
    );
  }
  throwReason<T = StateObject>(
    statusCode: number,
    reason: string | ER,
    headers?: StandardResponseHeaders
  ) {
    if (!this.responseSent) {
      if (typeof reason === "string") {
        let res = this.respond(statusCode, reason, headers);
        if (statusCode !== 204) res.string(reason);
      } else {
        let res = this.respond(statusCode, reason.reason, headers);
        if (statusCode !== 204) res.string(reason.message);
      }
    }
    // return Observable.empty<T>();
  }
  throw<T = never>(statusCode: number, headers?: StandardResponseHeaders) {
    if (!this.responseSent) {
      if (headers) this.setHeaders(headers);
      this.respond(statusCode).empty();
    }
    // return Observable.empty<T>();
  }
  setHeader(key: keyof StandardResponseHeaders, val: string) {
    this.setHeaders({ [key]: val } as any);
  }
  setHeaders(headers: StandardResponseHeaders) {
    Object.assign(
      this.responseHeaders,
      headers,
      headers["Set-Cookie"]
        ? {
            "Set-Cookie": (this.responseHeaders["Set-Cookie"] || []).concat(
              headers["Set-Cookie"] || []
            )
          }
        : {}
    );
  }
  respond(code: number, message?: string, headers?: StandardResponseHeaders) {
    if (headers) this.setHeaders(headers);
    if (!message) message = http.STATUS_CODES[code];
    if (this.settings._devmode) {
      let stack = new Error().stack;
      setTimeout(() => {
        if (!this.responseSent)
          this.debugOutput.write("Response not sent syncly\n " + stack);
      }, 0);
    }
    var subthis = {
      json: (data: any) => {
        this.setHeader("Content-Type", "application/json");
        subthis.string(JSON.stringify(data));
      },
      string: (data: string) => {
        subthis.buffer(Buffer.from(data, "utf8"));
      },
      stream: (data: Stream) => {
        this._res.writeHead(code, message, this.responseHeaders as any);
        data.pipe(this._res);
        this.responseSent = true;
      },
      buffer: (data: Buffer) => {
        this.setHeader("Content-Length", data.byteLength.toString());
        this._res.writeHead(code, message, this.responseHeaders as any);
        this._res.write(data);
        this._res.end();
        this.responseSent = true;
      },
      empty: () => {
        this._res.writeHead(code, message, this.responseHeaders as any);
        this._res.end();
        this.responseSent = true;
      }
    };
    return subthis;
  }

  redirect(redirect: string) {
    this.respond(302, "", {
      Location: redirect
    }).empty();
  }
  send(options: {
    root: string | undefined;
    filepath: string;
    error?: (err: any) => void;
    directory?: (filepath: string) => void;
    headers?: (filepath: string) => http.OutgoingHttpHeaders;
  }) {
    const { filepath, root, error, directory, headers } = options;
    const sender = send(this._req, filepath, { root });
    if (error) sender.on("error", error);
    if (directory)
      sender.on("directory", (res: http.ServerResponse, fp) => directory(fp));
    if (headers)
      sender.on("headers", (res: http.ServerResponse, fp) => {
        const hdrs = headers(fp);
        Object.keys(hdrs).forEach(e => {
          let item = hdrs[e];
          if (item) res.setHeader(e, item.toString());
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
  recieveBody(parseJSON: boolean, errorCB?: true | ((e: JsonError) => void)) {
    return new Promise<Buffer>(resolve => {
      let chunks: Buffer[] = [];
      this._req.on("data", chunk => {
        if (typeof chunk === "string") {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(chunk);
        }
      });
      this._req.on("end", () => {
        this.body = Buffer.concat(chunks).toString("utf8");

        if (this.body.length === 0 || !parseJSON) return resolve();

        let catchHandler =
          errorCB === true
            ? (e: JsonError) => {
                this.respond(400, "", {
                  "Content-Type": "text/plain"
                }).string(e.errorPosition);
                //return undefined;
              }
            : errorCB;

        this.json = catchHandler
          ? tryParseJSON<any>(this.body, catchHandler)
          : tryParseJSON(this.body);
        resolve();
      });
    });
  }
  static DebugLogger(prefix: string, ignoreLevel?: boolean): typeof DebugLog {
    //if(prefix.startsWith("V:")) return function(){};
    return function(
      this: { debugOutput: Writable; settings: ServerConfig },
      msgLevel: number,
      tempString: any,
      ...args: any[]
    ) {
      if (!ignoreLevel && this.settings.logging.debugLevel > msgLevel) return;
      if (isError(args[0])) {
        let err = args[0];
        args = [];
        if (err.stack) args.push(err.stack);
        else args.push("Error %s: %s", err.name, err.message);
      }
      let t = new Date();
      let date = format(
        "%s-%s-%s %s:%s:%s",
        t.getFullYear(),
        padLeft(t.getMonth() + 1, "00"),
        padLeft(t.getDate(), "00"),
        padLeft(t.getHours(), "00"),
        padLeft(t.getMinutes(), "00"),
        padLeft(t.getSeconds(), "00")
      );
      this.debugOutput.write(
        " " +
          (msgLevel >= 3 ? colors.BgRed + colors.FgWhite : colors.FgRed) +
          prefix +
          " " +
          colors.FgCyan +
          date +
          colors.Reset +
          " " +
          format
            .apply(null, [tempString, ...args])
            .split("\n")
            .map((e, i) => {
              if (i > 0) {
                return new Array(23 + prefix.length).join(" ") + e;
              } else {
                return e;
              }
            })
            .join("\n"),
        "utf8"
      );
    };
  }
  // private debugLog: typeof DebugLog = StateObject.DebugLogger("STATE  ");
}

export class ER extends Error {
  constructor(public reason: string, message: string) {
    super(message);
  }
}
/** to be used with concatMap, mergeMap, etc. */
export function recieveBody(
  state: StateObject,
  parseJSON: boolean,
  sendError?: true | ((e: JsonError) => void)
) {
  //get the data from the request
  return state.recieveBody(parseJSON, sendError);
}
export interface ThrowFunc<T> {
  throw(statusCode: number, reason?: string, str?: string, ...args: any[]);
}

export const TestConfig: ServerConfig = {} as any;
export interface AccessPathResult<T> {
  isFullpath: boolean;
  type: string | NodeJS.ErrnoException;
  tag: T;
  end: number;
  statItem: fs.Stats;
  statTW?: fs.Stats;
}
export interface AccessPathTag {
  state: StateObject;
  item: string | {};
  treepath: string;
  filepath: string;
}
export interface PathResolverResult {
  //the tree item returned from the path resolver
  item: Config.MountElement;
  //the ancestors of the tree item for reference
  ancestry: Config.MountElement[];
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
export type TreePathResultObject<T, U, V> = {
  item: T;
  end: U;
  folderPathFound: V;
  /** The array of mount items in the path. Redundant, but easy to iterate quickly. */
  ancestry: T[];
};
export type TreePathResult =
  // TreePathResultObject<NewTreeItem, number, false>
  | TreePathResultObject<Config.GroupElement, number, false>
  | TreePathResultObject<Config.PathElement, number, true>;
export function createHashmapString<T>(
  keys: string[],
  values: T[]
): { [id: string]: T } {
  if (keys.length !== values.length)
    throw "keys and values must be the same length";
  var obj: { [id: string]: T } = {};
  keys.forEach((e, i) => {
    obj[e] = values[i];
  });
  return obj;
}
export function createHashmapNumber<T>(
  keys: number[],
  values: T[]
): { [id: number]: T } {
  if (keys.length !== values.length)
    throw "keys and values must be the same length";
  var obj: { [id: number]: T } = {};
  keys.forEach((e, i) => {
    obj[e] = values[i];
  });
  return obj;
}

export function obsTruthy<T>(
  a: T | undefined | null | false | "" | 0 | void
): a is T {
  return !!a;
}

const ERRORS = {
  PROGRAMMER_EXCEPTION: "A programmer exception occurred: %s"
};

export function getError(code: "PRIMARY_KEYS_REQUIRED"): any;
export function getError(code: "OLD_REVISION"): any;
export function getError(code: "KEYS_REQUIRED", keyList: string): any;
export function getError(code: "ROW_NOT_FOUND", table: string, id: string): any;
export function getError(code: "PROGRAMMER_EXCEPTION", message: string): any;
// export function getError(code: string, ...args: string[]): any;
export function getError(code: string, ...args: string[]): any {
  // let code = args.shift() as keyof typeof ERRORS;
  if (ERRORS[code]) args.unshift(ERRORS[code]);
  //else args.unshift(code);
  return { code: code, message: format(code, ...args) };
}

/**
 *
 *
 * @param {string} ip x.x.x.x
 * @param {string} range x.x.x.x
 * @param {number} netmask 0-32
 */
export function testAddress(ip: string, range: string, netmask: number) {
  let netmaskBinStr = ipcalc.IPv4_bitsNM_to_binstrNM(netmask);
  let addressBinStr = ipcalc.IPv4_intA_to_binstrA(
    ipcalc.IPv4_dotquadA_to_intA(ip)
  );
  let netaddrBinStr = ipcalc.IPv4_intA_to_binstrA(
    ipcalc.IPv4_dotquadA_to_intA(range)
  );
  let netaddrBinStrMasked = ipcalc.IPv4_Calc_netaddrBinStr(
    netaddrBinStr,
    netmaskBinStr
  );
  let addressBinStrMasked = ipcalc.IPv4_Calc_netaddrBinStr(
    addressBinStr,
    netmaskBinStr
  );
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
let hostIPv4reg = /^(\-?)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/i;

export function parseHostList(hosts: string[]) {
  let hostTests = hosts.map(e => hostIPv4reg.exec(e) || e);
  return (addr: string) => {
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
      } else {
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
export function getUsableAddresses(hosts: string[]) {
  let reg = /^(\-?)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/i;
  let hostTests = hosts.map(e => reg.exec(e) || e);
  var ifaces = networkInterfaces();
  let addresses = Object.keys(ifaces).reduce(
    (n, k) => n.concat(ifaces[k].filter(e => e.family === "IPv4")),
    [] as NetworkInterfaceInfo[]
  );
  let usableArray = addresses.filter(addr => {
    let usable = false;
    hostTests.forEach(test => {
      if (Array.isArray(test)) {
        //we can't match IPv6 interface addresses so just go to the next one
        if (addr.family === "IPv6") return;
        let allow = !test[1];
        let ip = test[2];
        let netmask = +test[3];
        if (netmask < 0 || netmask > 32)
          console.log("Host %s has an invalid netmask", test[0]);
        if (testAddress(addr.address, ip, netmask)) usable = allow;
      } else {
        let ip = test.startsWith("-") ? test.slice(1) : test;
        let deny = test.startsWith("-");
        if (ip === addr.address) usable = !deny;
      }
    });
    return usable;
  });
  return usableArray;
}

export function NodePromise<T>(
  body: (cb: (err: NodeJS.ErrnoException, data: T) => void) => void
) {
  return new Promise<T>((resolve, reject) => {
    body((err, data) => (err ? reject(err) : resolve(data)));
  });
}
