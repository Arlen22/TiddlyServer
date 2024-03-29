import * as http from "http";
import * as url from "url";
import * as fs from "fs";
import * as path from "path";
import mime = require('mime');
import { format, promisify } from "util";
import * as JSON5 from "json5";
import * as send from "send";
import * as WebSocket from "ws";
import { Stats, appendFileSync } from "fs";
import { gzip, createGzip } from "zlib";
import { Writable, Stream } from "stream";
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
  OptionsConfig,
} from "./server-config";

import { JsonError, keys } from "./utils-functions";
// import { JsonError } from "./utils";
import { checkServerConfigSchema } from "./interface-checker";
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
  ConvertSettings,
};
declare const __non_webpack_require__: NodeRequire;
const nodeRequire =
  typeof __non_webpack_require__ !== "undefined"
    ? __non_webpack_require__
    : require;


type PromiseType<T> = T extends Promise<infer R> ? R : any;
type PromiseReturnType<T extends (...args: any) => any> = ReturnType<T> extends Promise<infer R>
  ? R
  : any;

interface Async<T> extends Promise<T> {
  readonly type: T;
}

export function as<T>(obj: T) {
  return obj;
}

type DebugFunc = (level: number, str: string | NodeJS.ErrnoException, ...args: any[]) => any;

interface ServerEventsListener<THIS> {
  (event: "websocket-connection", listener: (data: RequestEvent) => void): THIS;
  (event: "settingsChanged", listener: (keys: (keyof ServerConfig)[]) => void): THIS;
  (event: "settings", listener: (settings: ServerConfig) => void): THIS;
  (event: "stateError", listener: (state: StateObject) => void): THIS;
  (event: "stateDebug", listener: (state: StateObject) => void): THIS;
  (
    event: "serverOpen",
    listener: (serverList: any[], hosts: string[], https: boolean, dryRun: boolean) => void
  ): THIS;
  (event: "serverClose", listener: (iface: string) => void): THIS;
}
// type ServerEvents = "websocket-connection" | "settingsChanged" | "settings";
// export interface ServerEventEmitter extends EventEmitter {
//   emit(event: "websocket-connection", data: RequestEvent): boolean;
//   emit(event: "settingsChanged", keys: (keyof ServerConfig)[]): boolean;
//   emit(event: "settings", settings: ServerConfig): boolean;
//   emit(event: "stateError", state: StateObject): boolean;
//   emit(event: "stateDebug", state: StateObject): boolean;
//   emit(
//     event: "serverOpen",
//     serverList: any[],
//     hosts: string[],
//     https: boolean,
//     dryRun: boolean
//   ): boolean;
//   emit(event: "serverClose", iface: string): boolean;
//   // emit<T>(event: T, args: Parameters<ServerEventsListener<any>>)
//   addListener: ServerEventsListener<this>;
//   on: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
//   once: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
//   prependListener: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
//   prependOnceListener: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
//   removeListener: ServerEventsListener<this>; //(event: keyof ServerEvents, listener: Function): this;
//   removeAllListeners(event?: ServerEvents): this;
//   setMaxListeners(n: number): this;
//   getMaxListeners(): number;
//   listeners(event: ServerEvents): Function[];
//   eventNames(): ServerEvents[];
//   listenerCount(type: ServerEvents): number;
// }

export type ServerEvents = {
  "websocket-connection": readonly [RequestEvent]
  "settingsChanged": readonly [(keyof ServerConfig)[]]
  "settings": readonly [ServerConfig]
  "stateError": readonly [StateObject]
  "stateDebug": readonly [StateObject]
  "serverOpen": readonly [{ servers: import("./server").Listener[], hosts: string[], https: boolean, dryRun: boolean }]
  "serverClose": readonly [string]
}
export type ServerEventEmitter = EventEmitter<ServerEvents>;
export const TAGS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
export function getHumanSize(size: number) {

  let power = 0;
  while (size >= 1024) {
    size /= 1024;
    power++;
  }
  return size.toFixed(1) + TAGS[power];
}

export type Hashmap<T> = { [K: string]: T };

export type FolderEntryType = "folder" | "datafolder" | "htmlfile" | "other" | "error";

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


// declare function DebugLog(str: string, ...args: any[]);
export function isError(obj): obj is Error {
  return !!obj && obj.constructor === Error;
  // return [obj.message, obj.name].every(e => typeof e !== "undefined");
}
export function isErrnoException(obj: NodeJS.ErrnoException): obj is NodeJS.ErrnoException {
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

export function serveFile(state: StateObject, file: string, root: string | undefined) {
  promisify(fs.stat)(root ? path.join(root, file) : file).then(
    (stat): any => {
      state.send({
        root,
        filepath: file,
        error: err => {
          state.log(2, "%s %s", err.status, err.message).throw(500);
        },
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
      },
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
            let itemtype = stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other";
            res[itemtype].push(file);
          },
          x => undefined
        )
      )
    );
    return res;
  }
  if (options.type === "json") {
    return function (state: StateObject, folder: string) {
      readFolder(folder).then(item => {
        sendResponse(state, JSON.stringify(item), {
          contentType: "application/json",
          doGzip: canAcceptGzip(state.req),
        });
      });
    };
  }
}
export function canAcceptGzip(header: string | { headers: http.IncomingHttpHeaders }) {
  if (((a): a is { headers: http.IncomingHttpHeaders } => typeof a === "object")(header)) {
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
      "Content-Type": options.contentType || "text/plain; charset=utf-8",
    });
    if (isGzip) state.setHeaders({ "Content-Encoding": "gzip" });
    state.respond(200).buffer(body);
  }
}

import { generateDirectoryListing } from "./generate-directory-listing";
import { generateDirectoryRSS } from "./generate-directory-rss";
import { RequestEvent } from "./request-event";

//const generateDirectoryListing: (...args: any[]) => string = require('./generate-directory-listing').generateDirectoryListing;
export type DirectoryIndexData = {
  keys: string[];
  paths: (string | true)[];
  dirpath: string;
  type: "group" | "folder";
};
export type DirectoryIndexListing = {
  path: string
  entries: {
    name: string;
    path: string;
    icon: string;
    type: "error" | "folder" | "datafolder" | "file" | "group";
    size: string;
    mime: string;
    modified: number;
  }[]
  type: "group" | "folder" | 403 | 404
}
export type DirectoryIndexOptions = {
  upload: boolean;
  mkdir: boolean;
  format: "json" | "html" | "rss";
  mixFolders: boolean;
  isLoggedIn: string | false;
  extIcons: { [ext_mime: string]: string };
  sort: string[]
};
export type DirectoryIndexEntry = DirectoryIndexListing["entries"][number];
export const DirectoryIndexKeys = keys<{ [K in keyof DirectoryIndexEntry]: undefined }>({
  name: undefined,
  size: undefined,
  icon: undefined,
  mime: undefined,
  modified: undefined,
  path: undefined,
  type: undefined
});

export async function sendDirectoryIndex(_r: DirectoryIndexData, options: DirectoryIndexOptions) {
  let { keys, paths, dirpath, type } = _r;
  // let pairs = keys.map((k, i) => [k, paths[i]] as [string, string | boolean]);
  let entries = await Promise.all(
    keys.map(async (key, i) => {
      let statpath = paths[i];
      let stat = statpath === true ? undefined : await statPath(statpath, false);
      const nameparts = key.indexOf(".") !== -1 ? key.split(".").pop() : "";
      const list: DirectoryIndexListing["entries"][number] = {
        name: key,
        path: key + (!stat || stat.itemtype === "folder" ? "/" : ""),
        type: !stat ? "group" : stat.itemtype,
        icon: !stat ? "group.png" : (stat.itemtype === "file")
          ? (nameparts && options.extIcons[nameparts] || "other.png")
          : (stat.itemtype as string + ".png"),
        size: stat && stat.stat ? getHumanSize(stat.stat.size) : "",
        mime: (stat?.itemtype === "file") ? mime.lookup(statpath, "") : "",
        modified: stat?.stat?.mtimeMs || 0,

      };
      return list;
    })
  );
  sortDirectoryEntries(entries, options)
  if (options.format === "json") {
    return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
  } else if (options.format === "rss") {
    let def: DirectoryIndexListing = { path: dirpath, entries, type };
    return generateDirectoryRSS(def, options);
  } else {
    let def: DirectoryIndexListing = { path: dirpath, entries, type };
    return generateDirectoryListing(def, options);
  }
}
export const directorySorters: {
  [K in keyof DirectoryIndexEntry]: (
    // e: DirectoryIndexListing["entries"][number],
    a: DirectoryIndexListing["entries"][number],
    b: DirectoryIndexListing["entries"][number],
    opts: DirectoryIndexOptions
  ) => number
} = {
  name: (a, b, opts) =>
    (opts.mixFolders ? 0 : directorySorters.type(a,b,opts))
    || a.name.localeCompare(b.name),
  size: (a, b, opts) =>
    TAGS.findIndex(e => a.size.endsWith(e)) - TAGS.findIndex(e => b.size.endsWith(e))
    || +a.size - +b.size,
  modified: (a,b,opts) => b.modified - a.modified,
  path: (a,b,opts) => a.path.localeCompare(b.path),
  icon: (a,b,opts) => a.icon.localeCompare(b.icon),
  mime: (a,b,opts) => a.mime.localeCompare(b.mime),
  type: (a,b,opts) => +(a.type === "file") - +(b.type === "file"),
};


/** sort directory entries in place according to sort array*/
export function sortDirectoryEntries(entries: DirectoryIndexListing["entries"], opts: DirectoryIndexOptions) {
  var { sort } = opts;
  return entries.sort((a, b) => {
    for (var i = 0, diff = 0, e = sort[i], reverse = false; i < sort.length && !diff; (i++, e = sort[i])) {
      reverse = e.startsWith("-");
      if (reverse) e = e.substr(1);
      diff = directorySorters[e](a, b, opts);
    }
    if(reverse) return -diff;
    else return diff;
  });
}
/**
 * If the path
 */
export async function statWalkPath(test: PathResolverResult) {
  if (!Config.isPath(test.item)) {
    console.log(test.item);
    throw "property item must be a TreePath";
  }
  let noDataFolder = Config.isPath(test.item) ? !!test.item.noDataFolder : false;
  let n = { statpath: "", index: -1, endStat: false };
  let stats = [test.item.path, ...test.filepathPortion].map(e => {
    return (n = {
      statpath: path.join(n.statpath, e),
      index: n.index + 1,
      endStat: false,
    });
  });
  while (true) {
    let s = stats.shift();
    /* should never be undefined because we always do at least
     * 1 loop and then exit if stats.length is 0 */
    if (!s) throw new Error("PROGRAMMER ERROR");
    let res = await statPath(s, noDataFolder);
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
export async function statPath(s: { statpath: string; index: number } | string, noDataFolder: boolean) {
  if (typeof s === "string") s = { statpath: s, index: 0 };
  const { statpath, index } = s;
  let stat = await statsafe(statpath);
  let endStat = !stat || !stat.isDirectory();
  let infostat: fs.Stats | undefined = undefined;
  if (!endStat && !noDataFolder) {
    infostat = await statsafe(path.join(statpath, "tiddlywiki.info"));
    endStat = !!infostat && infostat.isFile();
  }

  return {
    stat,
    statpath,
    index,
    endStat,
    itemtype: getItemType(stat, !noDataFolder && infostat),
    infostat: noDataFolder && infostat && infostat.isFile() ? infostat : undefined,
  } as StatPathResult;
}

function getItemType(stat: Stats | undefined, infostat: Stats | false | undefined) {
  let itemtype;

  if (!stat) itemtype = "error";
  else if (stat.isDirectory()) itemtype = !!infostat ? "datafolder" : "folder";
  else if (stat.isFile() || stat.isSymbolicLink()) itemtype = "file";
  else itemtype = "error";

  return itemtype;
}
export function treeWalker(tree: Config.GroupElement | Config.FolderElement, reqpath) {
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
    let t = item.$children.find((e): e is Config.GroupElement | Config.FolderElement =>
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
    reqpath.slice().filter(a => a).join("/")
  ).split("/").filter(a => a);

  if (!reqpath.every(a => a !== ".." && a !== ".")) return;

  var result = treeWalker(tree, reqpath);

  if (reqpath.length > result.end && !result.folderPathFound) return;

  //get the remainder of the path
  let filepathPortion = reqpath.slice(result.end).map(a => a.trim());

  const fullfilepath = Config.isPath(result.item)
    ? path.join(result.item.path, ...filepathPortion)
    : "";

  return {
    item: result.item,
    ancestry: result.ancestry,
    treepathPortion: reqpath.slice(0, result.end),
    filepathPortion,
    reqpath,
    fullfilepath,
  };
}

type NodeCallback<T, S> = [NodeJS.ErrnoException, T, S];

export function fs_move(oldPath, newPath, callback) {
  fs.rename(oldPath, newPath, function (err) {
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

    readStream.on("close", function () {
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


export type getStatPathResult<T extends StatPathResult["itemtype"]> = Extract<StatPathResult, { itemtype: T }>;

export class URLSearchParams {
  constructor(str: string) { }
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

import { StateObject } from "./state-object";
import { EventEmitter } from "./event-emitter-types";

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

export class Resolved implements PathResolverResult {
  static resolve(
    pathname: string[],
    root: Config.GroupElement | Config.FolderElement
  ) {
    let res = resolvePath(pathname, root);
    if (!res) return false;
    else return new Resolved(res);
  }
  public item: Config.MountElement
  public ancestry: Config.MountElement[]
  public reqpath: string[]
  public treepathPortion: string[]
  public filepathPortion: string[]
  public fullfilepath: string
  constructor(
    res: PathResolverResult
  ) {
    this.item = res.item;
    this.ancestry = res.ancestry;
    this.reqpath = res.reqpath;
    this.treepathPortion = res.treepathPortion;
    this.filepathPortion = res.filepathPortion;
    this.fullfilepath = res.fullfilepath;
  }

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
  | TreePathResultObject<Config.FolderElement, number, true>;
export function createHashmapString<T>(keys: string[], values: T[]): { [id: string]: T } {
  if (keys.length !== values.length) throw "keys and values must be the same length";
  var obj: { [id: string]: T } = {};
  keys.forEach((e, i) => {
    obj[e] = values[i];
  });
  return obj;
}
export function createHashmapNumber<T>(keys: number[], values: T[]): { [id: number]: T } {
  if (keys.length !== values.length) throw "keys and values must be the same length";
  var obj: { [id: number]: T } = {};
  keys.forEach((e, i) => {
    obj[e] = values[i];
  });
  return obj;
}

export function obsTruthy<T>(a: T | undefined | null | false | "" | 0 | void): a is T {
  return !!a;
}

const ERRORS = {
  PROGRAMMER_EXCEPTION: "A programmer exception occurred: %s",
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
        if (netmask < 0 || netmask > 32) console.log("Host %s has an invalid netmask", test[0]);
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
        if (netmask < 0 || netmask > 32) console.log("Host %s has an invalid netmask", test[0]);
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

export function NodePromise<T>(body: (cb: (err: NodeJS.ErrnoException, data: T) => void) => void) {
  return new Promise<T>((resolve, reject) => {
    body((err, data) => (err ? reject(err) : resolve(data)));
  });
}

// import { TreeStateObject } from "./tiddlyserver";