import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';

import { format } from "util";
import { Observable, Subscriber } from '../lib/rx';
import { EventEmitter } from "events";
//import { StateObject } from "./index";
import { send } from '../lib/bundled-lib';
import { Stats, appendFileSync } from 'fs';
import { gzip } from 'zlib';
import { Writable, Stream } from 'stream';
// import { TlsOptions } from 'tls';
import * as https from "https";
import { networkInterfaces, NetworkInterfaceInfo } from 'os';
import * as ipcalc from "./ipcalc";
let DEBUGLEVEL = -1;
let settings: ServerConfig;
const colorsRegex = /\x1b\[[0-9]+m/gi
let debugOutput: Writable = new Writable({
	write: function (chunk, encoding, callback) {
		// if we're given a buffer, convert it to a string
		if (Buffer.isBuffer(chunk)) chunk = chunk.toString('utf8');
		// remove ending linebreaks for consistency
		chunk = chunk.slice(0, chunk.length - (chunk.endsWith("\r\n") ? 2 : +chunk.endsWith("\n")));

		if (settings.server.logError) {
			appendFileSync(
				settings.server.logError,
				(settings.server.logColorsToFile ? chunk : chunk.replace(colorsRegex, "")) + "\r\n",
				{ encoding: "utf8" }
			);
		}
		if (!settings.server.logError || settings.server.logToConsoleAlso) {
			console.log(chunk);
		}
		callback && callback();
		return true;
	}
});;
export let typeLookup: { [k: string]: string };
export function init(eventer: ServerEventEmitter) {
	eventer.on('settings', function (set: ServerConfig) {
		// DEBUGLEVEL = set.debugLevel;
		settings = set;
		typeLookup = {};
		Object.keys(set.directoryIndex.icons).forEach(type => {
			set.directoryIndex.icons[type].forEach(ext => {
				if (!typeLookup[ext]) {
					typeLookup[ext] = type;
				} else {
					throw format('Multiple types for extension %s: %s', ext, typeLookup[ext], type);
				}
			})
		});
		// const myWritable = new stream.
	});
}
export function OldDefaultSettings(set: OldServerConfig) {
	if (!set.port) set.port = 8080;
	if (!set.host) set.host = "127.0.0.1";
	if (!set.types) set.types = {
		"htmlfile": ["htm", "html"]
	}
	if (!set.etag) set.etag = "";
	if (!set.etagWindow) set.etagWindow = 0;
	if (!set.useTW5path) set.useTW5path = false;
	if (typeof set.debugLevel !== "number") set.debugLevel = -1;

	["allowNetwork", "allowLocalhost"].forEach((key: string) => {
		if (!set[key]) set[key] = {} as any;
		if (!set[key].mkdir) set[key].mkdir = false;
		if (!set[key].upload) set[key].upload = false;
		if (!set[key].settings) set[key].settings = false;
		if (!set[key].WARNING_all_settings_WARNING)
			set[key].WARNING_all_settings_WARNING = false;
	});

	if (!set.logColorsToFile) set.logColorsToFile = false;
	if (!set.logToConsoleAlso) set.logToConsoleAlso = false;

	if (!set.maxAge) set.maxAge = {} as any;
	if (typeof set.maxAge.tw_plugins !== "number")
		set.maxAge.tw_plugins = 60 * 60 * 24 * 365 * 1000; //1 year of milliseconds
}

export function ConvertSettings(set: OldServerConfig): ServerConfig {
	type T = ServerConfig;
	type T1 = T["server"];
	type T2 = T["tiddlyserver"];
	type T21 = T["tiddlyserver"]["hostLevelPermissions"];
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
	}
}
export function NewDefaultSettings(set: ServerConfig) {
	type T = ServerConfig;
	type T1 = T["server"];
	type T2 = T["tiddlyserver"];
	type T21 = T["tiddlyserver"]["hostLevelPermissions"];
	let newset = {
		tree: set.tree,
		server: Object.assign<T["server"], T["server"]>({
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
		tiddlyserver: Object.assign<T["tiddlyserver"], any>({
			etag: "",
			etagWindow: 3,
			useTW5path: false,
			hostLevelPermissions: Object.assign<T["tiddlyserver"]["hostLevelPermissions"], any>({
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
		directoryIndex: Object.assign<T["directoryIndex"], any>({
			defaultType: "html",
			icons: { "htmlfile": ["htm", "html"] },
			mixFolders: true
		}, set.directoryIndex),
		EXPERIMENTAL_clientside_datafolders: Object.assign<T["EXPERIMENTAL_clientside_datafolders"], any>({
			enabled: false,
			alwaysRefreshCache: true,
			maxAge_tw_plugins: 0
		}, set.EXPERIMENTAL_clientside_datafolders),
		$schema: "./settings.schema.json"
	}
	return newset;
}
export interface OldServerConfigSchema extends OldServerConfigBase {
	tree: NewTreeObjectSchemaItem
}
export interface OldServerConfig extends OldServerConfigBase {
	tree: NewTreeItem
	__dirname: string;
	__filename: string;
	__assetsDir: string;
}
// export type ServerConfig = NewConfig;
// export type ServerConfigSchema = NewConfigSchema;
export interface ServerConfigSchema extends ServerConfigBase {
	tree: NewTreeObjectSchemaItem
}
export interface ServerConfig extends ServerConfigBase {
	tree: NewTreeItem
	__dirname: string;
	__filename: string;
	__assetsDir: string;
}


export interface NewTreeHashmapGroupSchema {
	$element: "group";
	// key: string;
	/** @default  [{"$element": ""}]  */
	/** @default  {}  */
	$children: NewTreeItemSchema[] | NewTreeObjectSchema;
}
export interface NewTreeGroupSchema extends NewTreeHashmapGroupSchema {
	key: string;
}
/** @default { "$element": {}} */
/**
 * 
 * @description A hashmap of `group` elements, `folder` elements, and folder paths
 */
export interface NewTreeObjectSchema {
	/**
	 * The children of a hashmap `group` element which are not
	 * `group` or `folder` elements
	 */
	//@ts-ignore
	$children?: NewTreeOptions[]
	/** 
	 * @description A hashmap tree element: either a string or a group/folder element without the `key` attribute
	 * @default { "$element": {}}
	 * @pattern ^([^$]+)+$ 
	 */
	[K: string]: NewTreeObjectSchemaItem
}
export type NewTreeObjectSchemaItem = NewTreeHashmapGroupSchema | NewTreeHashmapPath | string
/**
 * @default {"$element": ""} 
 */
export type NewTreeItemSchema = NewTreeGroupSchema | NewTreePathSchema | string;
export type NewTreeItem = NewTreeGroup | NewTreePath | NewTreeOptions;
export interface NewTreeGroup {
	$element: "group";
	key: string;
	$children: (NewTreeItem | NewTreeOptions)[];
}
export interface NewTreeHashmapPath {
	$element: "folder";
	path: string;
	$children?: NewTreeOptions[];

}
export interface NewTreePathSchema extends NewTreeHashmapPath {
	key?: string;
}
export interface NewTreePath extends NewTreeHashmapPath {
	key: string;
}
/** @default { "$element": "" } */
export type NewTreeOptions =
	| NewTreePathOptions_Index
	| NewTreePathOptions_AuthPassword
	| NewTreePathOptions_AuthPublicKey;

export interface NewTreePathOptions_Index {
	/**
	 * Options related to the directory index (request paths ending in a 
	 * backslash which do not resolve to a TiddlyWiki data folder).
	 */
	$element: "index",
	/** 
	 * The format of the index generated if no index file is found, or "403" to 
	 * return a 403 Access Denied, or "404" to return a 404 Not Found.
	 */
	defaultType: "html" | "json" | "403" | "404",
	/** 
	 * Look for index files named exactly this or with one of the defaultExts added. 
	 * For example, a defaultFile of ["index"] and a defaultExts of ["htm","html"] would 
	 * look for "index.htm", "index.html", in that order. 
	 */
	indexFile: string[],
	/** 
	 * Extensions to add when looking for an index file. A blank string will set the order 
	 * to search for the exact indexFile name. The extensions are searched in the order specified. 
	 */
	indexExts: string[]
}
export interface NewTreePathOptions_AuthPassword {
	/** Use basic auth for access control */
	$element: "authPassword"
	/** Username given to TiddlyWiki data folders and anywhere else it's needed */
	username: string,
	/** password encoded in utf8 */
	password: string
}
export interface NewTreePathOptions_AuthPublicKey {
	/** use TLS Client Certificates for access control */
	$element: "authClientKey",
	/** Username given to TiddlyWiki data folders and anywhere else it's needed */
	username: string,
	// /** matches any certificate with this public key */
	// publicKey?: string,
	// /** match this certificate */
	// certificate?: string,
	/** all certificate authories and self-signed certificates to allow */
	certificateAuthority: string,
	/** Reject requests that cannot present a signed certificate */
	rejectUnauthorized: boolean,
	// $children: undefined;
}
export function isNewTreeItem(a: any): a is NewTreeItem {
	return (typeof a === "object"
		&& typeof a["$element"] === "string"
		&& (a.$element === "folder" || a.$element === "group")
		|| typeof a === "string");
}
export function isNewTreeGroup(a: any): a is NewTreeGroup {
	return isNewTreeItem(a) && typeof a === "object" && a.$element === "group";
}
export function isNewTreeHashmapGroupSchema(a: any): a is NewTreeHashmapGroupSchema {
	return isNewTreeGroup(a) && !Array.isArray(a.$children) && !a.key;
}
export function isNewTreePath(a: any): a is NewTreePath {
	return isNewTreeItem(a) && typeof a === "object" && a.$element === "folder";
}
export const normalizeTree = (settingsDir: string) => function upgradeTree(item: NewTreeObjectSchemaItem | NewTreeOptions | NewTreeItem, key: string | undefined, keypath): NewTreeItem {
	// let t = item as NewTreeObjectSchemaItem;
	if (typeof item === "string" || item.$element === "folder") {
		if (typeof item === "string") item = { $element: "folder", path: item } as NewTreePath;
		if (!item.path) throw new Error(format("path must be specified for folder item under '%s'", keypath.join(', ')));
		item.path = path.resolve(settingsDir, item.path);
		key = key || path.basename(item.path);
		//the hashmap key overrides the key attribute if available
		return { ...item, key } as NewTreePath;
	} else if (item.$element === "group") {
		if (((a: any): a is NewTreeHashmapGroupSchema => !a.key)(item)) {
			if (!key) throw new Error("No key specified for group element under " + keypath.join(', '));
		} else {
			key = item.key;
		}
		//at this point we only need the TreeHashmapGroup type since we already extracted the key
		let t = item as NewTreeHashmapGroupSchema;
		let tc = t.$children;
		if (typeof tc !== "object") throw new Error("Invalid $children under " + keypath.join(', '));
		return ({
			$element: "group", key,
			$children: Array.isArray(tc)
				? tc.map(e => upgradeTree(e, undefined, keypath))
				: Object.keys(tc)
					.filter(k => k !== "$children")
					.map(k => upgradeTree(tc[k], k, [...keypath, k]))
					.concat(tc.$children || [])
		})
	} else {
		return item;
	}
}
export function normalizeSettings(set: ServerConfig, settingsFile, routeKeys: string[]) {
	const settingsDir = path.dirname(settingsFile);
	
	NewDefaultSettings(set);
	((tree: ServerConfigSchema["tree"]) => {
		if (typeof tree === "string" && tree.endsWith(".xml")) {
			//read the xml file and parse it as the tree structure

		} else if (typeof tree === "string" && (tree.endsWith(".js") || tree.endsWith(".json"))) {
			//require the json or js file and use it directly
			let filepath = path.resolve(settingsDir, tree);
			set.tree = normalizeTree(path.dirname(filepath))(require(filepath), "tree", []);
		} else {
			//otherwise just assume we're using the value itself
			set.tree = normalizeTree(settingsDir)(tree, "tree", []);
		}
	})(set.tree as any)

	if (set.tiddlyserver.backupDirectory) set.tiddlyserver.backupDirectory = path.resolve(settingsDir, set.tiddlyserver.backupDirectory);
	if (set.server.logAccess) set.server.logAccess = path.resolve(settingsDir, set.server.logAccess);
	if (set.server.logError) set.server.logError = path.resolve(settingsDir, set.server.logError);

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

interface ServerEventsListener<THIS> {
	(event: "websocket-connection", listener: (client: WebSocket, request: http.IncomingMessage) => void): THIS;
	(event: "settingsChanged", listener: (keys: (keyof ServerConfig)[]) => void): THIS;
	(event: "settings", listener: (settings: ServerConfig) => void): THIS;
	(event: "stateError", listener: (state: StateObject) => void): THIS;
	(event: "stateDebug", listener: (state: StateObject) => void): THIS;
	(event: "serverOpen", listener: (iface: string) => void): THIS;
	(event: "serverClose", listener: (iface: string) => void): THIS;
}
type ServerEvents = "websocket-connection" | "settingsChanged" | "settings";
export interface ServerEventEmitter extends EventEmitter {
	emit(event: "websocket-connection", client: WebSocket, request: http.IncomingMessage): boolean;
	emit(event: "settingsChanged", keys: (keyof ServerConfig)[]): boolean;
	emit(event: "settings", settings: ServerConfig): boolean;
	emit(event: "stateError", state: StateObject): boolean;
	emit(event: "stateDebug", state: StateObject): boolean;
	emit(event: "serverOpen", serverList: any[], https: boolean): boolean;
	emit(event: "serverClose", iface: string): boolean;

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
	eventNames(): (ServerEvents)[];
	listenerCount(type: ServerEvents): number;
}
export function getHumanSize(size: number) {
	const TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
	let power = 0;
	while (size >= 1024) {
		size /= 1024;
		power++;
	}
	return size.toFixed(1) + TAGS[power];
}

export type Hashmap<T> = { [K: string]: T };

export type FolderEntryType = 'folder' | 'datafolder' | 'htmlfile' | 'other' | 'error';

export interface DirectoryEntry {
	name: string,
	type: string,
	path: string,
	size: string
}

export interface Directory {
	path: string,
	entries: DirectoryEntry[]
	type: string
}


// export function tryParseJSON(str: string, errObj?: { error?: JsonError }): any;
// export function tryParseJSON(str: string, errObj?: ((e: JsonError) => T | void)): T;
/**
 * Calls the onerror handler if there is a JSON error.  
 */
export function tryParseJSON<T = any>(str: string, onerror?: ((e: JsonError) => never)): T;
export function tryParseJSON<T = any>(str: string, onerror?: ((e: JsonError) => T)): T;
export function tryParseJSON<T = any>(str: string, onerror?: ((e: JsonError) => void)): T | undefined;
export function tryParseJSON<T = any>(str: string, onerror?: ((e: JsonError) => T)): T | undefined {
	function findJSONError(message: string, json: string) {
		const res: string[] = [];
		const match = /position (\d+)/gi.exec(message);
		if (!match) return "";
		const position = +match[1];
		const lines = json.split('\n');
		let current = 1;
		let i = 0;
		for (; i < lines.length; i++) {
			current += lines[i].length + 1; //add one for the new line
			res.push(lines[i]);
			if (current > position) break;
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
	} catch (e) {
		let err = new JsonError(findJSONError(e.message, str), e)
		if (onerror) return onerror(err);
	}
}
export interface JsonErrorContainer {
	error?: JsonError
}
export class JsonError {
	public filePath: string = "";
	constructor(
		public errorPosition: string,
		public originalError: Error
	) {

	}
}

export function keys<T>(o: T): (keyof T)[] {
	return Object.keys(o) as (keyof T)[];
}
export function padLeft(str: any, pad: number | string, padStr?: string): string {
	var item = str.toString();
	if (typeof padStr === 'undefined')
		padStr = ' ';
	if (typeof pad === 'number') {
		pad = new Array(pad + 1).join(padStr);
	}
	//pad: 000000 val: 6543210 => 654321
	return pad.substr(0, Math.max(pad.length - item.length, 0)) + item;
}
export function sortBySelector<T extends { [k: string]: string }>(key: (e: T) => any) {
	return function (a: T, b: T) {
		var va = key(a);
		var vb = key(b);

		if (va > vb)
			return 1;
		else if (va < vb)
			return -1;
		else
			return 0;
	}

}
export function sortByKey(key: string) {
	return sortBySelector(e => e[key]);
}
export namespace colors {
	export const Reset = "\x1b[0m"
	export const Bright = "\x1b[1m"
	export const Dim = "\x1b[2m"
	export const Underscore = "\x1b[4m"
	export const Blink = "\x1b[5m"
	export const Reverse = "\x1b[7m"
	export const Hidden = "\x1b[8m"

	export const FgBlack = "\x1b[30m"
	export const FgRed = "\x1b[31m"
	export const FgGreen = "\x1b[32m"
	export const FgYellow = "\x1b[33m"
	export const FgBlue = "\x1b[34m"
	export const FgMagenta = "\x1b[35m"
	export const FgCyan = "\x1b[36m"
	export const FgWhite = "\x1b[37m"

	export const BgBlack = "\x1b[40m"
	export const BgRed = "\x1b[41m"
	export const BgGreen = "\x1b[42m"
	export const BgYellow = "\x1b[43m"
	export const BgBlue = "\x1b[44m"
	export const BgMagenta = "\x1b[45m"
	export const BgCyan = "\x1b[46m"
	export const BgWhite = "\x1b[47m"
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
declare function DebugLog(level: number, str: string | NodeJS.ErrnoException, ...args: any[]);
// declare function DebugLog(str: string, ...args: any[]);
export function isError(obj): obj is Error {
	return obj.constructor === Error;
	// return [obj.message, obj.name].every(e => typeof e !== "undefined");
}
export function isErrnoException(obj: NodeJS.ErrnoException): obj is NodeJS.ErrnoException {
	return isError(obj);
}
export function DebugLogger(prefix: string, ignoreLevel?: boolean): typeof DebugLog {
	//if(prefix.startsWith("V:")) return function(){};
	return function (msgLevel: number, ...args: any[]) {
		if (!ignoreLevel && settings.server.debugLevel > msgLevel) return;
		if (isError(args[0])) {
			let err = args[0];
			args = [];
			if (err.stack) args.push(err.stack);
			else args.push("Error %s: %s", err.name, err.message);
		}
		let t = new Date();
		let date = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
			padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
		debugOutput.write(' '
			+ (msgLevel >= 3 ? (colors.BgRed + colors.FgWhite) : colors.FgRed) + prefix
			+ ' ' + colors.FgCyan + date + colors.Reset
			+ ' ' + format.apply(null, args).split('\n').map((e, i) => {
				if (i > 0) {
					return new Array(23 + prefix.length).join(' ') + e;
				} else {
					return e;
				}
			}).join('\n'), "utf8");
	} as typeof DebugLog;
}



export function sanitizeJSON(key: string, value: any) {
	// returning undefined omits the key from being serialized
	if (!key) { return value; } //This is the entire value to be serialized
	else if (key.substring(0, 1) === "$") return; //Remove angular tags
	else if (key.substring(0, 1) === "_") return; //Remove NoSQL tags
	else return value;
}

export interface ServeStaticResult {
	status: number,
	headers: {},
	message: string
}

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



export function serveFile(state: StateObject, file: string, root: string) {
	obs_stat(state)(path.join(root, file)).mergeMap(([err, stat]): any => {
		if (err) return state.throw<StateObject>(404);
		state.send({
			root,
			filepath: file,
			error: err => {
				state.log(2, '%s %s', err.status, err.message).throw(500);
			}
		});
		return Observable.empty<StateObject>();
	}).subscribe();

}
export function serveFileObs(obs: Observable<StateObject>, file: string, root: string) {
	return obs.do(state => serveFile(state, file, root)).ignoreElements();
}
export function serveFolder(state: StateObject, mount: string, root: string, serveIndex?: Function) {
	const pathname = state.url.pathname;
	if (state.url.pathname.slice(0, mount.length) !== mount) {
		state.log(2, 'URL is different than the mount point %s', mount).throw(500);
	} else {
		state.send({
			root,
			filepath: pathname.slice(mount.length),
			error: err => { state.log(-1, '%s %s', err.status, err.message).throw(404); },
			directory: (filepath) => {
				if (serveIndex) {
					serveIndex(state, filepath);
				} else {
					state.throw(403);
				}
			}
		})
	}
}
export function serveFolderObs(obs: Observable<StateObject>, mount: string, root: string, serveIndex?: Function) {
	return obs.do(state => serveFolder(state, mount, root, serveIndex)).ignoreElements();
}
export function serveFolderIndex(options: { type: string }) {
	function readFolder(folder: string) {
		return obs_readdir()(folder).mergeMap(([err, files]) => {
			return Observable.from(files)
		}).mergeMap(file => {
			return obs_stat(file)(path.join(folder, file));
		}).map(([err, stat, key]) => {
			let itemtype = stat.isDirectory() ? 'directory' : (stat.isFile() ? 'file' : 'other');
			return { key, itemtype };
		}).reduce((n, e) => {
			n[e.itemtype].push(e.key);
			return n;
		}, { "directory": [], "file": [] });
	}
	if (options.type === "json") {
		return function (state: StateObject, folder: string) {
			readFolder(folder).subscribe(item => {
				sendResponse(state, JSON.stringify(item), {
					contentType: "application/json",
					doGzip: canAcceptGzip(state.req)
				})
			})
		}
	}
}
export function canAcceptGzip(header: string | { headers: http.IncomingHttpHeaders }) {
	if (((a): a is { headers: http.IncomingHttpHeaders } => typeof a === "object")(header)) {
		header = header.headers['accept-encoding'] as string;
	}
	var gzip = header.split(',').map(e => e.split(';')).filter(e => e[0] === "gzip")[0];
	var can = !!gzip && !!gzip[1] && parseFloat(gzip[1].split('=')[1]) > 0;
	return can;
}

export function sendResponse(state: StateObject, body: Buffer | string, options: {
	doGzip?: boolean,
	contentType?: string
} = {}) {
	body = !Buffer.isBuffer(body) ? Buffer.from(body, 'utf8') : body;
	if (options.doGzip) gzip(body, (err, gzBody) => {
		if (err) _send(body, false);
		else _send(gzBody, true)
	}); else _send(body, false);

	function _send(body, isGzip) {
		state.setHeaders({
			'Content-Length': Buffer.isBuffer(body)
				? body.length.toString()
				: Buffer.byteLength(body, 'utf8').toString(),
			'Content-Type': options.contentType || 'text/plain; charset=utf-8'
		});
		if (isGzip) state.setHeaders({ 'Content-Encoding': 'gzip' });
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
export function getNewTreePathFiles(result: PathResolverResult, state: StateObject): Observable<DirectoryIndexData> {
	let dirpath = [
		result.treepathPortion.join('/'),
		result.filepathPortion.join('/')
	].filter(e => e).join('/')
	let type = isNewTreeGroup(result.item) ? "category" : "folder";
	if (isNewTreeGroup(result.item)) {
		const keys = result.item.$children.map(e => e.key);
		// const keys = Object.keys(result.item);
		const paths = result.item.$children.map(e =>
			isNewTreePath(e) ? e.path : true
		);
		return Observable.of({ keys, paths, dirpath, type });
	} else {
		return obs_readdir()(result.fullfilepath).map(([err, keys]) => {
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
const generateDirectoryListing: (...args: any[]) => string = require('./generateDirectoryListing').generateDirectoryListing;
export type DirectoryIndexData = { keys: string[], paths: (string | boolean)[], dirpath: string, type: string };
export type DirectoryIndexOptions = { upload: boolean, mkdir: boolean, format: "json" | "html", mixFolders: boolean }
export function sendDirectoryIndex([_r, options]: [DirectoryIndexData, DirectoryIndexOptions]) {
	let { keys, paths, dirpath, type } = _r;
	let pairs = keys.map((k, i) => [k, paths[i]]);
	return Observable.from(pairs).mergeMap(([key, val]: [string, string | boolean]) => {
		//if this is a category, just return the key
		if (typeof val === "boolean") return Observable.of({ key })
		//otherwise return the statPath result
		else return statPath(val).then(res => { return { stat: res, key }; });
	}).reduce((n, e: { key: string, stat?: StatPathResult }) => {
		let linkpath = [dirpath, e.key].filter(e => e).join('/');
		n.push({
			name: e.key,
			path: e.key + ((!e.stat || e.stat.itemtype === "folder") ? "/" : ""),
			type: (!e.stat ? "category" : (e.stat.itemtype === "file"
				? typeLookup[e.key.split('.').pop() as string] || 'other'
				: e.stat.itemtype as string)),
			size: (e.stat && e.stat.stat) ? getHumanSize(e.stat.stat.size) : ""
		});
		return n;
	}, [] as DirectoryEntry[]).map(entries => {
		if (options.format === "json") {
			return JSON.stringify({ path: dirpath, entries, type, options }, null, 2);
		} else {
			return generateDirectoryListing({ path: dirpath, entries, type }, options);
		}
	});
}

/**
 * If the path 
 */
export function statWalkPath(test: PathResolverResult) {
	// let endStat = false;
	if (!isNewTreePath(test.item)) {
		console.log(test.item);
		throw "property item must be a TreePath";
	}
	let endWalk = false;
	return Observable.from([test.item.path].concat(test.filepathPortion)).scan((n, e) => {
		return { statpath: path.join(n.statpath, e), index: n.index + 1, endStat: false };
	}, { statpath: "", index: -1, endStat: false }).concatMap(s => {
		if (endWalk) return Observable.empty<never>();
		else return Observable.fromPromise(
			statPath(s).then(res => { endWalk = endWalk || res.endStat; return res; })
		);
	}).takeLast(1);
}
/**
 * returns the info about the specified path. endstat is true if the statpath is not
 * found or if it is a directory and contains a tiddlywiki.info file, or if it is a file.
 * 
 * @param {({ statpath: string, index: number, endStat: boolean } | string)} s 
 * @returns 
 */
export function statPath(s: { statpath: string, index: number, endStat: boolean } | string) {
	if (typeof s === "string") s = { statpath: s, index: 0, endStat: false };
	const { statpath, index } = s;
	let { endStat } = s;
	if (typeof endStat !== "boolean") endStat = false;
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
}

function getItemType(stat: Stats, infostat: Stats | undefined) {
	let itemtype;

	if (!stat) itemtype = "error";
	else if (stat.isDirectory()) itemtype = !!infostat ? "datafolder" : "folder";
	else if (stat.isFile() || stat.isSymbolicLink()) itemtype = "file"
	else itemtype = "error"

	return itemtype;

}
export function treeWalker(tree, reqpath) {
	var item: NewTreeItem = tree;
	var ancestry: NewTreeItem[] = [];
	var folderPathFound = false;
	for (var end = 0; end < reqpath.length; end++) {
		if (isNewTreePath(item)) {
			folderPathFound = true;
			break;
		}
		let t = item.$children.find(e => e.key === reqpath[end]);
		if (isNewTreeGroup(item) && t) {
			item = t;
			let a = Object.assign({}, item);
			delete a.$children;
			ancestry.push(a);
		} else {
			break;
		}
	}
	return { item, end, folderPathFound, ancestry } as TreePathResult;
}
export function treeWalkerOld(tree, reqpath) {
	var item: NewTreeItem = tree;
	var folderPathFound = false;
	for (var end = 0; end < reqpath.length; end++) {

		if (typeof item !== 'string' && typeof item[reqpath[end]] !== 'undefined') {
			item = item[reqpath[end]];
		} else if (typeof item === "string") {
			folderPathFound = true; break;
		} else break;
	}
	return { item, end, folderPathFound };
}
export function resolvePath(state: StateObject | string[], tree: NewTreeItem): PathResolverResult | undefined {
	var reqpath;
	if (Array.isArray(state)) {
		reqpath = state;
	} else {
		reqpath = state.path;
	}

	reqpath = decodeURI(reqpath.slice().filter(a => a).join('/')).split('/').filter(a => a);

	//if we're at root, just return it
	if (reqpath.length === 0) return {
		item: tree,
		ancestry: [],
		reqpath,
		treepathPortion: [],
		filepathPortion: [],
		fullfilepath: typeof tree === "string" ? tree : ''
	}
	//check for invalid items (such as ..)
	if (!reqpath.every(a => a !== ".." && a !== ".")) return;

	var result = treeWalker(tree, reqpath);

	if (reqpath.length > result.end && !result.folderPathFound) return;

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

type NodeCallback<T, S> = [NodeJS.ErrnoException, T, S];


// export function obs<S>(state?: S) {
//     return Observable.bindCallback(fs.stat, (err, stat): NodeCallback<fs.Stats, S> => [err, stat, state] as any);
// }
export type obs_stat_result<T> = [NodeJS.ErrnoException, fs.Stats, T, string]
export const obs_stat = <T = undefined>(tag: T = undefined as any) =>
	(filepath: string) => new Observable<obs_stat_result<T>>(subs => {
		fs.stat(filepath, (err, data) => {
			subs.next([err, data, tag, filepath]);
			subs.complete();
		})
	})

export type obs_readdir_result<T> = [NodeJS.ErrnoException, string[], T, string]
export const obs_readdir = <T>(tag: T = undefined as any) =>
	(filepath: string) => new Observable<obs_readdir_result<T>>(subs => {
		fs.readdir(filepath, (err, data) => {
			subs.next([err, data, tag, filepath]);
			subs.complete();
		})
	})

export type obs_readFile_result<T> = typeof obs_readFile_inner
export const obs_readFile = <T>(tag: T = undefined as any): obs_readFile_result<T> =>
	(filepath: string, encoding?: string) =>
		new Observable(subs => {
			const cb = (err, data) => {
				subs.next([err, data, tag, filepath]);
				subs.complete();
			}
			if (encoding)
				fs.readFile(filepath, encoding, cb);
			else
				fs.readFile(filepath, cb)
		}) as any;

declare function obs_readFile_inner<T>(filepath: string): Observable<[NodeJS.ErrnoException, Buffer, T, string]>;
declare function obs_readFile_inner<T>(filepath: string, encoding: string): Observable<[NodeJS.ErrnoException, string, T, string]>;


// export type obs_writeFile_result<T> = typeof obs_readFile_inner
export const obs_writeFile = <T>(tag: T = undefined as any) =>
	(filepath: string, data: any) => new Observable<[NodeJS.ErrnoException | undefined, T, string]>(subs =>
		fs.writeFile(filepath, data, (err) => {
			subs.next([err, tag, filepath]);
			subs.complete();
		})
	);
export function fs_move(oldPath, newPath, callback) {

	fs.rename(oldPath, newPath, function (err) {
		if (err) {
			if (err.code === 'EXDEV') {
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

		readStream.on('error', callback);
		writeStream.on('error', callback);

		readStream.on('close', function () {
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
export type StatPathResult = {
	stat: fs.Stats,
	statpath: string,
	infostat?: fs.Stats,
	index: number,
	/**
	 * error, folder, datafolder, file
	 * 
	 * @type {string}
	 */
	itemtype: string,
	/**
	 * either the path does not exist or it is a data folder
	 * 
	 * @type {boolean}
	 */
	endStat: boolean
}
// export interface 
// export type LoggerFunc = (str: string, ...args: any[]) => void;
export class URLSearchParams {
	constructor(str: string) {

	}
}
export interface StateObjectUrl {
	path: string,
	pathname: string,
	query: Hashmap<string>,
	search: string,
	href: string
}

export class StateObject {
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
		return (obs: Observable<any>): any => {
			return obs.mergeMap((state: StateObject) => {
				if (reason)
					return state.throwReason(status, reason);
				else
					return state.throw(status);
			})
		}
	}

	get allow(): ServerConfig_AccessOptions {
		let isLocalhost = testAddress(this._req.socket.localAddress, "127.0.0.1", 8);

		switch (this.trustLevel) {
			case "trusted": return {
				mkdir: true,
				settings: true,
				upload: true,
				WARNING_all_settings_WARNING: true,
				writeErrors: true
			};

			case "network": return settings.allowNetwork;
		}
	}

	// req: http.IncomingMessage;
	// res: http.ServerResponse;
	startTime: [number, number];
	timestamp: string;

	body: string;
	json: any | undefined;

	statPath: StatPathResult;

	url: StateObjectUrl;

	path: string[];

	maxid: number;

	where: string;
	query: any;
	errorThrown: Error;

	restrict: any;

	expressNext: ((err?: any) => void) | false;

	// req: {
	//     url: string;
	//     headers: { [K: string]: any; };
	//     method: string;
	//     pipe: Stream["pipe"]
	// }
	// res(
	//     statusCode: number,
	//     body: string | Buffer,
	//     headers: Hashmap<string>,
	//     isBase64Encoded: boolean
	// ) {

	// }

	req: http.IncomingMessage;
	res: http.ServerResponse;

	responseHeaders: http.OutgoingHttpHeaders = {};
	responseSent: boolean = false;

	constructor(
		private _req: http.IncomingMessage,
		private _res: http.ServerResponse,
		private debugLog: typeof DebugLog,
		private eventer: ServerEventEmitter,
		public readonly trustLevel: "trusted" | "localhost" | "network" = "network"
	) {
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
		this.url = StateObject.parseURL(this.req.url as string);
		//parse the path for future use
		this.path = (this.url.pathname as string).split('/')

		let t = new Date();
		this.timestamp = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
			padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
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
		})
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
	log(level: number, ...args: any[]) {
		if (level < this.loglevel) return this;
		if (level > 1) this.hasCriticalLogs = true;
		this.doneMessage.push(format.apply(null, args));
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
	throwError<T = StateObject>(statusCode: number, error: ER, headers?: Hashmap<string>) {
		return this.throwReason(statusCode, this.allow.writeErrors ? error.message : error.reason, headers);
	}
	throwReason<T = StateObject>(statusCode: number, reason: string, headers?: Hashmap<string>) {
		if (!this.responseSent) {
			var res = this.respond(statusCode, reason, headers)
			//don't write 204 reason
			if (statusCode !== 204 && reason) res.string(reason.toString());
		}
		return Observable.empty<T>();
	}
	throw<T = StateObject>(statusCode: number, headers?: Hashmap<string>) {
		if (!this.responseSent) {
			if (headers) this.setHeaders(headers);
			this.respond(statusCode).empty();
		}
		return Observable.empty<T>();
	}
	setHeader(key: string, val: string) {
		this.responseHeaders[key] = val;
	}
	setHeaders(headers: http.OutgoingHttpHeaders) {
		Object.assign(this.responseHeaders, headers);
	}
	respond(code: number, message?: string, headers?: http.OutgoingHttpHeaders) {
		if (headers) this.setHeaders(headers);
		if (!message) message = http.STATUS_CODES[code];
		if (settings.server._devmode) setTimeout(() => {
			if (!this.responseSent)
				this.debugLog(3, "Response not sent \n %s", new Error().stack);
		}, 0);
		var subthis = {
			json: (data: any) => {
				subthis.string(JSON.stringify(data));
			},
			string: (data: string) => {
				subthis.buffer(Buffer.from(data, 'utf8'));
			},
			stream: (data: Stream) => {
				this._res.writeHead(code, message, this.responseHeaders);
				data.pipe(this._res);
				this.responseSent = true;
			},
			buffer: (data: Buffer) => {
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
		}
		return subthis;
	}

	redirect(redirect: string) {
		this.respond(302, "", {
			'Location': redirect
		}).empty();
	}
	send(options: {
		root: string;
		filepath: string;
		error?: (err: any) => void;
		directory?: (filepath: string) => void;
		headers?: (filepath: string) => http.OutgoingHttpHeaders;
	}) {
		const { filepath, root, error, directory, headers } = options;
		const sender = send(this._req, filepath, { root });
		if (error)
			sender.on('error', options.error);
		if (directory)
			sender.on('directory', (res: http.ServerResponse, fp) => directory(fp));
		if (headers)
			sender.on('headers', (res: http.ServerResponse, fp) => {
				const hdrs = headers(fp);
				Object.keys(hdrs).forEach(e => {
					let item = hdrs[e];
					if (item) res.setHeader(e, item.toString());
				})
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
	recieveBody(errorCB?: true | ((e: JsonError) => void)) {

		return Observable.fromEvent<Buffer>(this._req, 'data')
			//only take one since we only need one. this will dispose the listener
			.takeUntil(Observable.fromEvent(this._req, 'end').take(1))
			//accumulate all the chunks until it completes
			.reduce<Buffer>((n, e) => { n.push(e); return n; }, [])
			//convert to json and return state for next part
			.map(e => {
				this.body = Buffer.concat(e).toString('utf8');
				//console.log(state.body);
				if (this.body.length === 0)
					return this;

				let catchHandler = errorCB === true ? (e: JsonError) => {
					this.respond(400, "", {
						"Content-Type": "text/plain"
					}).string(e.errorPosition);
				} : errorCB;

				this.json = tryParseJSON<any>(this.body, catchHandler);
				return this;
			});
	}

}

export class ER extends Error {
	constructor(public reason: string, message: string) {
		super(message);
	}
}
/** to be used with concatMap, mergeMap, etc. */
export function recieveBody(state: StateObject, sendError?: true | ((e: JsonError) => void)) {
	//get the data from the request
	return state.recieveBody(sendError);

}
export interface ThrowFunc<T> {
	throw(statusCode: number, reason?: string, str?: string, ...args: any[]): Observable<T>;
}
export interface ServerConfig_AccessOptions {
	writeErrors: boolean
	/** allow uploads on the directory index page */
	upload: boolean
	/** allow create directory on directory index page */
	mkdir: boolean
	/** allow non-critical settings to be modified */
	settings: boolean
	/** allow critical settings to be modified */
	WARNING_all_settings_WARNING: boolean
}
export interface OldServerConfigBase {

	_disableLocalHost: boolean;
	_devmode: boolean;
	// tree: NewTreeItem,
	types: {
		htmlfile: string[];
		[K: string]: string[]
	}
	username?: string,
	password?: string,
	host: string,
	port: number | 8080,
	backupDirectory?: string,
	etag: "required" | "disabled" | "", //otherwise if present
	etagWindow: number,
	useTW5path: boolean,
	debugLevel: number,
	allowNetwork: ServerConfig_AccessOptions,
	allowLocalhost: ServerConfig_AccessOptions,
	logAccess: string | false,
	logError: string,
	logColorsToFile: boolean,
	logToConsoleAlso: boolean;
	/** cache max age in milliseconds for different types of data */
	maxAge: { tw_plugins: number }
	tsa: { alwaysRefreshCache: boolean; },
	mixFolders: boolean;
	/** Schema generated by marcoq.vscode-typescript-to-json-schema VS code plugin */
	$schema: string;
}
export interface SecureServerOptions {
	/** All private keys as specified in 
	 * https://nodejs.org/docs/latest-v8.x/api/tls.html#tls_tls_createsecurecontext_options 
	 */
	key: any;
	/** The certificate chain for all private keys as specified in 
	 * https://nodejs.org/docs/latest-v8.x/api/tls.html#tls_tls_createsecurecontext_options 
	 */
	cert: any;
	/** 
	 * EITHER: A list of file paths of self-signed certs and certificate authorities to allow for 
	 * client certificates. OR: Boolean `true`, then the list of Mozilla CAs will be used and 
	 * self-signed certs will not be possible unless `rejectUnauthorizedCertificate` is false.
	 */
	requestClientCertificate: string[] | boolean;
	/** whether to reject connections which do not have a valid certificate */
	rejectUnauthorizedCertificate: boolean;
}
export interface ServerConfigBase {
	// tree: NewTreeItem;
	/** 
	 * Generic webserver options. 
	 */
	server: {
		/** 
		 * An array of IP addresses to accept requests on. Can be any IP address
		 * assigned to the machine. Default is "127.0.0.1".
		 * 
		 * If `bindWildcard` is true, each connection is checked individually. Otherwise, the server listens
		 * on the specified IP addresses and accepts all connections from the operating system. If an IP address
		 * cannot be bound, the server skips it unless `--bindAddressRequired` is specified
		 * 
		 * If `filterBindAddress` is true, IPv4 addresses may include a subnet mask,
		 * (e.g. `/24`) which matches any interface IP address in that range. Prefix with a minus sign (-) 
		 * to block requests incoming to that IP address or range.
		 */
		bindAddress: string[];
		/**
		 * IPv4 addresses may include a subnet mask,
		 * (e.g. `/24`) which matches any IP address in that range. Prefix with a minus sign (-) 
		 * to block requests incoming to that IP address or range.
		 */
		filterBindAddress: boolean;
		/**
		 * Bind to the wildcard addresses `0.0.0.0` and `::` (if enabled) in that order.
		 * The default is `true`. In many cases this is preferred, however 
		 * Android does not support this for some reason. On Android, set this to
		 * `false` and set host to `["0.0.0.0/0"]` to bind to all IPv4 addresses.
		 */
		bindWildcard: true | false;
		/** 
		 * Bind to the IPv6 wildcard as well if `bindWilcard` is true and allow requests
		 * incoming to IPv6 addresses if not explicitly denied.
		 */
		enableIPv6: boolean;
		/** port to listen on */
		port: number;
		/** access log file */
		logAccess: string | false;
		/** error log file */
		logError: string;
		/** write the console color markers to file, useful if you read the logs by printing them to a terminal */
		logColorsToFile: boolean;
		/** print access and error events to the console regardless of whether they are logged to a file */
		logToConsoleAlso: boolean;
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
		debugLevel: number;
		/** 
		 * https-only options: an object or a string to a `require`-able file (such as .js or .json) 
		 * which exports the object
		 */
		https?: SecureServerOptions | string
		/** always bind a separate server instance to 127.0.0.1 regardless of any other settings */
		_bindLocalhost: boolean;
		/** enables certain expensive per-request checks */
		_devmode: boolean;
	}
	/** directory index options */
	directoryIndex: {
		/** sort folder and files together rather than separated */
		mixFolders: boolean;
		/** default format for the directory index */
		defaultType: "html" | "json";
		/** 
		 * Hashmap of type { "icon_name": ["ext", "ext"]} where ext represents the extensions to use this icon for. 
		 * Icons are in the TiddlyServer/assets/icons folder.
		 */
		icons: { [iconName: string]: string[] }
	}
	/** tiddlyserver specific options */
	tiddlyserver: {
		/** backup directory for saving SINGLE-FILE wikis only */
		backupDirectory?: string
		/** whether to use the etag field, blank string means "if specified" */
		etag: "required" | "disabled" | ""
		/** etag does not need to be exact by this many seconds */
		etagWindow: number
		/** serve datafolders with a trailing slash */
		useTW5path: boolean
		/** permissions based on host address: "localhost", "*" (all others), "192.168.0.0/16" */
		hostLevelPermissions: { [host: string]: ServerConfig_AccessOptions }
	}
	/** client-side data folder loader which loads datafolders directly into the browser */
	EXPERIMENTAL_clientside_datafolders: {
		/** temporarily disable clientside datafolders (does NOT disable the `tiddlywiki` folder) */
		enabled: boolean;
		/** how long to cache tw_plugins on the server side */
		maxAge_tw_plugins: number;
		/** refresh cache whenever ?refresh=true is called */
		alwaysRefreshCache: boolean;
	},
	/** 
	 * The JSON schema location for this document. This schema is generated 
	 * directly from the TypeScript interfaces
	 * used in TiddlyServer. A text-editor with autocomplete, such as VS code, 
	 * will make editing this file much simpler. 
	 * Most fields include a description like this one. 
	 * 
	 * All relative paths in this file are resolved relative to this file, so 
	 * `./settings-tree.xml` refers to an XML file in the same folder as this file. 
	 * All relative paths in included files (such as the XML file) are resolved 
	 * relative to the included file. 
	 */
	$schema: string;
}

export const TestConfig: ServerConfig = {} as any;
export interface AccessPathResult<T> {
	isFullpath: boolean,
	type: string | NodeJS.ErrnoException,
	tag: T,
	end: number,
	statItem: fs.Stats,
	statTW?: fs.Stats
};
export interface AccessPathTag {
	state: StateObject,
	item: string | {},
	treepath: string,
	filepath: string
};
export interface PathResolverResult {
	//the tree item returned from the path resolver
	item: NewTreeItem;
	//the ancestors of the tree item for reference
	ancestry: NewTreeItem[];
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
export type TreePathResultObject<T, U, V> = { item: T, end: U, folderPathFound: V, ancestry: T[] }
export type TreePathResult =
	// TreePathResultObject<NewTreeItem, number, false>
	| TreePathResultObject<NewTreeItem, number, false>
	| TreePathResultObject<NewTreePath, number, true>;
export function createHashmapString<T>(keys: string[], values: T[]): { [id: string]: T } {
	if (keys.length !== values.length)
		throw 'keys and values must be the same length';
	var obj: { [id: string]: T } = {};
	keys.forEach((e, i) => {
		obj[e] = values[i];
	})
	return obj;
}
export function createHashmapNumber<T>(keys: number[], values: T[]): { [id: number]: T } {
	if (keys.length !== values.length)
		throw 'keys and values must be the same length';
	var obj: { [id: number]: T } = {};
	keys.forEach((e, i) => {
		obj[e] = values[i];
	})
	return obj;
}

export function obsTruthy<T>(a: T | undefined | null | false | "" | 0 | void): a is T {
	return !!a;
}

const ERRORS = {
	'PROGRAMMER_EXCEPTION': 'A programmer exception occurred: %s'
}

export function getError(code: 'PRIMARY_KEYS_REQUIRED'): any;
export function getError(code: 'OLD_REVISION'): any;
export function getError(code: 'KEYS_REQUIRED', keyList: string): any;
export function getError(code: 'ROW_NOT_FOUND', table: string, id: string): any;
export function getError(code: 'PROGRAMMER_EXCEPTION', message: string): any;
export function getError(code: string, ...args: string[]): any;
export function getError(...args: string[]) {
	let code = args.shift() as keyof typeof ERRORS;
	if (ERRORS[code]) args.unshift(ERRORS[code])
	//else args.unshift(code);
	return { code: code, message: format.apply(null, args) };
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
	let netaddrBinStr = ipcalc.IPv4_intA_to_binstrA(ipcalc.IPv4_dotquadA_to_intA(range))
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
		hostTests.forEach(test => {
			if (Array.isArray(test)) {
				let allow = !test[1];
				let ip = test[2];
				let netmask = +test[3];
				if (netmask < 0 || netmask > 32) console.log("Host %s has an invalid netmask", test[0]);
				if (testAddress(addr, ip, netmask)) usable = allow;
			} else {
				let ip = test.startsWith('-') ? test.slice(1) : test;
				let deny = test.startsWith('-');
				if (ip === addr) usable = !deny;
			}
		});
		return usable;
	}
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
				let ip = test.startsWith('-') ? test.slice(1) : test;
				let deny = test.startsWith('-');
				if (ip === addr.address) usable = !deny;
			}
		});
		return usable;
	})
	return usableArray;
}