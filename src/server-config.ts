/** @type { import("path") } */
const path: typeof import("path") = require("path")

function format(str: string, ...args: any[]) {
	while (args.length && str.indexOf("%s") !== -1)
		str = str.replace("%s", args.shift());
	args.unshift(str);
	return args.join(',');
}
const homedir = require("os").homedir();
export function normalizeTree(settingsDir: string, item: NewTreeObjectSchemaItem | NewTreeOptions | NewTreeItem, key: string | undefined, keypath): NewTreeItem {
	// let t = item as NewTreeObjectSchemaItem;
	if (typeof item === "string" || item.$element === "folder") {
		if (typeof item === "string") item = { $element: "folder", path: item } as NewTreePath;
		if (!item.path) throw new Error(format("path must be specified for folder item under '%s'", keypath.join(', ')));
		if(item.path.startsWith("~")) item.path = path.join(homedir, item.path.slice(1));
		else item.path = path.resolve(settingsDir, item.path);
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
				? tc.map(e => normalizeTree(settingsDir, e, undefined, keypath))
				: Object.keys(tc).filter(k => k !== "$children")
					.map(k => normalizeTree(settingsDir, tc[k], k, [...keypath, k]))
					.concat(tc.$children || [])
		})
	} else {
		return item;
	}
}
export function normalizeSettingsTree(settingsDir: string, tree: ServerConfigSchema["tree"]) {
	if (typeof tree === "string" && tree.endsWith(".xml")) {
		//read the xml file and parse it as the tree structure

	} else if (typeof tree === "string" && (tree.endsWith(".js") || tree.endsWith(".json"))) {
		//require the json or js file and use it directly
		let filepath = path.resolve(settingsDir, tree);
		return normalizeTree(path.dirname(filepath), require(filepath), "tree", []) as any;
	} else {
		//otherwise just assume we're using the value itself
		return normalizeTree(settingsDir, tree, "tree", []) as any;
	}
}
export function normalizeSettingsAuthAccounts(auth: ServerConfigSchema["authAccounts"]) {
	if (!auth) return {};
	let newAuth: ServerConfig["authAccounts"] = {};

	return newAuth;
}

type OptionalAny = { [K in string]: undefined };
function isObject(a): a is OptionalAny {
	return typeof a === "object";
}
function spread(a: any): ({}) {
	return typeof a === "object" ? a : {};
}
export function normalizeSettings(set: ServerConfigSchema, settingsFile) {
	const settingsDir = path.dirname(settingsFile);
	if (!set.tree) throw "tree is required in ServerConfig";
	type T = ServerConfig;
	type T1 = T["bindInfo"];
	type T3 = T["logging"];
	type T2 = T["putsaver"];
	type T21 = T["bindInfo"]["hostLevelPermissions"];
	let hostLevelPermissions = {
		...{
			"localhost": {
				writeErrors: true,
				mkdir: true,
				upload: true,
				settings: true,
				WARNING_all_settings_WARNING: false,
				websockets: true,
				registerNotice: true
			},
			"*": {
				writeErrors: true,
				mkdir: false,
				upload: false,
				settings: false,
				WARNING_all_settings_WARNING: false,
				websockets: true,
				registerNotice: false
			}
		},
		...spread(set.bindInfo && set.bindInfo.hostLevelPermissions)
	};
	let newset: ServerConfig = {
		__dirname: "",
		__filename: "",
		__assetsDir: "",
		_devmode: !!set._devmode,
		_datafoldertarget: set._datafoldertarget || "",
		tree: normalizeSettingsTree(settingsDir, set.tree as any),
		bindInfo: {
			...{
				bindAddress: [],
				bindWildcard: false,
				enableIPv6: false,
				filterBindAddress: false,
				port: 8080,

				hostLevelPermissions,
				_bindLocalhost: false,
				https: false
			},
			...spread(set.bindInfo),
			...{
				https: !!(set.bindInfo && set.bindInfo.https)
			}
		},
		logging: {
			...{
				debugLevel: 0,
				logAccess: "",
				logError: "",
				logColorsToFile: false,
				logToConsoleAlso: true,
			}
		},
		authAccounts: spread(set.authAccounts),
		putsaver: {
			...{
				etagWindow: 3,
				backupDirectory: "",
			},
			...spread(set.putsaver),
			...{
				etag: set.putsaver && set.putsaver.etag || ""
			}
		},
		directoryIndex: {
			...{
				defaultType: "html",
				icons: { "htmlfile": ["htm", "html"] },
				mixFolders: true
			},
			...spread(set.directoryIndex)
		},
		EXPERIMENTAL_clientside_datafolders: {
			...{
				enabled: false,
				alwaysRefreshCache: true,
				maxAge_tw_plugins: 0
			},
			...spread(set.EXPERIMENTAL_clientside_datafolders)
		},
		authCookieAge: set.authCookieAge || 2592000,
		$schema: "./settings.schema.json"
	}
	// set second level object defaults




	if (newset.putsaver.backupDirectory)
		newset.putsaver.backupDirectory = path.resolve(settingsDir, newset.putsaver.backupDirectory);
	if (newset.logging.logAccess)
		newset.logging.logAccess = path.resolve(settingsDir, newset.logging.logAccess);
	if (newset.logging.logError)
		newset.logging.logError = path.resolve(settingsDir, newset.logging.logError);

	newset.__dirname = settingsDir;
	newset.__filename = settingsFile;

	if (newset.putsaver.etag === "disabled" && !newset.putsaver.backupDirectory) {
		console.log("Etag checking is disabled, but a backup folder is not set. "
			+ "Changes made in multiple tabs/windows/browsers/computers can overwrite each "
			+ "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED "
			+ "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can "
			+ "also set the etagWindow setting to allow files to be modified if not newer than "
			+ "so many seconds from the copy being saved.");
	}
	return newset;
}

export interface ServerConfigSchema {
	/** enables certain expensive per-request checks */
	_devmode?: boolean;
	/** 
	 * The tiddlywiki folder to use for data folder instances. Defaults to the 
	 * tiddlywiki folder in the TiddlyServer installation regardless of the 
	 * settings.json location.
	 */
	_datafoldertarget?: string;
	tree: NewTreeObjectSchemaItem
	/** bind address and port info */
	bindInfo?: Partial<ServerConfig_BindInfo & {
		/** 
 		 * https-only options: a string to a JavaScript file which exports a function of type
		 * `(iface:string) => https.ServerOptions`. Note that the initServer function will 
		 * change this to a boolean value indicating whether https is in use once inside TiddlyServer.
 		 */
		https?: string;
	}>
	/** logging  */
	logging?: Partial<ServerConfig_Logging>;
	/** directory index options */
	directoryIndex?: Partial<ServerConfig_DirectoryIndex>
	/** tiddlyserver specific options */
	putsaver?: Partial<ServerConfig_TiddlyServer>
	/** 
	 * The Hashmap of accounts which may authenticate on this server.
	 * Takes either an object or a string to a `require`-able file (such as .js or .json) 
	 * which exports the object
	 */
	authAccounts?: { [K: string]: ServerConfig_AuthAccountsValue }
	/** client-side data folder loader which loads datafolders directly into the browser */
	EXPERIMENTAL_clientside_datafolders?: Partial<ServerConfig_ClientsideDatafolders>,
	/** 
	 * Age to set for the auth cookie (default is 30 days)
	 * - 24 hours: `86400`
	 * - 7 days: `604800`
	 * - 30 days: `2592000`
	 * - 60 days: `5184000`
	 * - 90 days: `7776000`
	 * - 120 days: `10368000`
	 * - 150 days: `12950000`
	 * - 180 days: `15552000`
	 */
	authCookieAge?: number
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

export interface ServerConfig {
	/** enables certain expensive per-request checks */
	_devmode: boolean;
	/** the tiddlywiki folder to use for data folder instances */
	_datafoldertarget: string;
	tree: NewTreeGroup | NewTreePath
	/** bind address and port */
	bindInfo: ServerConfig_BindInfo & {
		https: boolean;
	}
	/** logging  */
	logging: ServerConfig_Logging;
	/** directory index */
	directoryIndex: ServerConfig_DirectoryIndex
	/** PUT saver options */
	putsaver: ServerConfig_TiddlyServer
	/** 
	 * The Hashmap of accounts which may authenticate on this server.
	 * Takes either an object or a string to a `require`-able file (such as .js or .json) 
	 * which exports the object
	 */
	authAccounts: { [K: string]: ServerConfig_AuthAccountsValue }
	/** client-side data folder loader which loads datafolders directly into the browser */
	EXPERIMENTAL_clientside_datafolders: ServerConfig_ClientsideDatafolders,
	/** 
	 * Age to set for the auth cookie (default is 30 days)
	 * - 24 hours: `86400`
	 * - 7 days: `604800`
	 * - 30 days: `2592000`
	 * - 60 days: `5184000`
	 * - 90 days: `7776000`
	 * - 120 days: `10368000`
	 * - 150 days: `12950000`
	 * - 180 days: `15552000`
	 */
	authCookieAge: number

	$schema: string;

	__dirname: string;
	__filename: string;
	__assetsDir: string;
}

export interface ServerConfig_ClientsideDatafolders {
	/** temporarily disable clientside datafolders (does NOT disable the `tiddlywiki` folder) */
	enabled: boolean;
	/** how long to cache tw_plugins on the server side */
	maxAge_tw_plugins: number;
	/** refresh cache whenever ?refresh=true is called */
	alwaysRefreshCache: boolean;
}
export interface ServerConfig_AuthAccountsValue {
	// /** Record[username] = password */
	// passwords: Record<string, string>,
	/** Hashmap of [username] = public key */
	clientKeys: Record<string, string>,
	/** override hostLevelPermissions for users with this account */
	permissions: ServerConfig_AccessOptions
}
export interface ServerConfig_AccessOptions {
	writeErrors: boolean
	/** allow uploads on the directory index page */
	upload: boolean
	/** allow create directory on directory index page */
	mkdir: boolean
	// /** allow non-critical settings to be modified */
	// settings: boolean
	// /** allow critical settings to be modified */
	// WARNING_all_settings_WARNING: boolean
	/** allow websocket connections (default true) */
	websockets: boolean;
	/** 
	 * login attempts for a public/private key pair which has not been 
	 * registered will be logged at debug level 2 with the full public key
	 * which can be copied into an authAccounts entry. 
	 */
	registerNotice: boolean;
}
export interface ServerConfig_BindInfo {
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
	/** port to listen on, default is 8080 for http and 8443 for https */
	port: number;

	/** permissions based on host address: "localhost", "*" (all others), "192.168.0.0/16" */
	hostLevelPermissions: { [host: string]: ServerConfig_AccessOptions }
	/** always bind a separate server instance to 127.0.0.1 regardless of any other settings */
	_bindLocalhost: boolean;


}
export interface ServerConfig_Logging {
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

}
export interface ServerConfig_DirectoryIndex {
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
export interface ServerConfig_TiddlyServer {
	/** backup directory for saving SINGLE-FILE wikis only */
	backupDirectory: string
	/** 
	 * Whether to use the etag field -- if not specified then it will check it if presented.
	 * This does not affect the backup etagAge option, as the saving mechanism will still 
	 * send etags back to the browser, regardless of this option.
	 */
	etag: "required" | "disabled" | ""
	/** etag does not need to be exact by this many seconds */
	etagWindow: number


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
export interface NewTreeMountArgs{ 


}
export interface NewTreeGroup extends NewTreeMountArgs {
	$element: "group";
	key: string;
	/**
	 * Path to an index file to be served instead of an autogenerated index
	 */
	indexPath?: string;
	$children: (NewTreeItem | NewTreeOptions)[];
}
export interface NewTreeHashmapPath extends NewTreeMountArgs {
	$element: "folder";
	/** Path relative to this file or any absolute path NodeJS can stat */
	path: string;
	/**
	 * Load data folders under this path with no trailing slash.
	 * This imitates single-file wikis and allows tiddlers with relative links
	 * to be imported directly into a data folder wiki. The source point of the 
	 * relative link becomes the data folder itself as though it is actually a file.
	 * However, this breaks relative links to resources served by the datafolder instance
	 * itself, such as the files directory introduced in 5.1.19 and requires the relative
	 * link to include the data folder name in the relative link. For this reason, 
	 * it is better to convert single-file wikis to the datafolder format by putting each
	 * wiki inside its own folder as index.html, putting a "files" folder beside the 
	 * index.html file, and adding an index option to this element.
	 */
	noTrailingSlash?: boolean;
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
	| NewTreePathOptions_Auth
	| NewTreePathOptions_Backup;

export interface NewTreePathOptions_Index {
	/**
	 * Options related to the directory index (request paths that resolve to a folder
	 * which is not a data folder). Option elements affect the group
	 * they belong to and all children under that. Each property in an option element 
	 * replaces the key from parent option elements.
	 */
	$element: "index",
	/** 
	 * The format of the index generated if no index file is found, or "403" to 
	 * return a 403 Access Denied, or "404" to return a 404 Not Found. 403 is the 
	 * error code used by Apache and Nginx. 
	 */
	defaultType: "html" | "json" | "403" | "404",
	/** 
	 * Look for index files named exactly this or with one of the defaultExts added. 
	 * For example, a defaultFile of ["index"] and a defaultExts of ["htm","html"] would 
	 * look for ["index.htm","index.html","index"] in that order. 
	 * 
	 * Only applies to folder elements, but may be set on a group element. An empty array disables this feature.
	 * To use a .hidden file, put the full filename here, and set indexExts to `[""]`. 
	 */
	indexFile: string[],
	/** 
	 * Extensions to add when looking for an index file. A blank string will set the order 
	 * to search for the exact indexFile name. The extensions are searched in the order specified. 
	 * 
	 * Only applies to folder elements, but may be set on a group element. An empty array disables this feature.
	 * To search for an exact indexFile, specify a blank string inside an array `[""]`.
	 */
	indexExts: string[]
}
export interface NewTreePathOptions_Auth {
	/** 
	 * Only allow requests using these authAccounts. Option elements affect the group
	 * they belong to and all children under that. Each property in an option element 
	 * replaces the key from parent option elements.
	 * 
	 * Anonymous requests are ALWAYS denied if an auth element applies to the requested path. 
	 * 
	 * Note that this does not change server authentication procedures. 
	 * Data folders are always given the authenticated username
	 * regardless of whether there are auth elements in the tree.
	 */
	$element: "auth";
	/** list of keys from authAccounts object that can access this resource */
	authList: string[] | null;
	/** 
	 * Which error code to return for unauthorized (or anonymous) requests
	 * - 403 Access Denied: Client is not granted permission to access this resouce.
	 * - 404 Not Found: Client is told that the resource does not exist.
	 */
	authError: "403" | "404";
}
export interface NewTreePathOptions_Backup {
	/** Options related to backups for single-file wikis. Option elements affect the group
	 * they belong to and all children under that. Each property in an option element 
	 * replaces the key from parent option elements. */
	$element: "backups",
	/** 
	 * Backup folder to store backups in. Multiple folder paths 
	 * can backup to the same folder if desired. 
	 */
	backupFolder: string,
	/** 
	 * GZip backup file to save disk space. Good for larger wikis. Turn this off
	 * for experimental wikis that you often need to restore from a backup because
	 * of a bad line of code (I speak from experience).
	 */
	gzip: boolean,
	/** 
	 * Save a backup only if the disk copy is older than this many seconds. 
	 * If the file on disk is only a few minutes old it can be assumed that 
	 * very little has changed since the last save. So if this is set to 10 minutes,
	 * and your wiki gets saved every 9 minutes, only the first save will trigger a backup.
	 * This is a useful option for large wikis that see a lot of daily work but not 
	 * useful for experimental wikis which might crash at any time and need to be 
	 * reloaded from the last backup. 
	 */
	etagAge: number,
}

export interface ServerConfigBase {

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
export interface OldServerConfigSchema extends OldServerConfigBase {
	tree: NewTreeObjectSchemaItem
}
export interface OldServerConfig extends OldServerConfigBase {
	tree: NewTreeGroup | NewTreePath
	__dirname: string;
	__filename: string;
	__assetsDir: string;
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
	type T1 = T["bindInfo"];
	type T3 = T["logging"];
	type T2 = T["putsaver"];
	type T21 = T["bindInfo"]["hostLevelPermissions"];
	return {
		__assetsDir: set.__assetsDir,
		__dirname: set.__dirname,
		__filename: set.__filename,
		_devmode: set._devmode,
		_datafoldertarget: "",
		tree: set.tree,
		bindInfo: {
			bindAddress: (set.host === "0.0.0.0" || set.host === "::") ? [] : [set.host],
			filterBindAddress: false,
			enableIPv6: set.host === "::",
			port: set.port,
			bindWildcard: set.host === "0.0.0.0" || set.host === "::",
			hostLevelPermissions: {
				"localhost": set.allowLocalhost,
				"*": set.allowNetwork
			},
			https: false,
			_bindLocalhost: set._disableLocalHost === false,
		},
		logging: {
			logAccess: set.logAccess,
			logError: set.logError,
			logColorsToFile: set.logColorsToFile,
			logToConsoleAlso: set.logToConsoleAlso,
			debugLevel: set.debugLevel,
		},
		putsaver: {
			etag: set.etag,
			etagWindow: set.etagWindow,
			backupDirectory: ""
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
		authCookieAge: 2592000,
		$schema: "./settings.schema.json"
	}
}