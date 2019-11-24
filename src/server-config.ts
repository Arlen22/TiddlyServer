/** @type { import("path") } */
const path: typeof import("path") = require("path")
declare const __non_webpack_require__: NodeRequire | undefined;
import { oc } from "./optional-chaining";
// type AlwaysDefined<T> = {
// 	[P in keyof T]-?: T[P] extends {} ? T[P] : () => T[P];
// };
// function oc<T extends {}>(data: T): AlwaysDefined<T> & (() => T) {

// 	return new Proxy((() => data) as any,
// 		{
// 			get: (target, key) => {
// 				return typeof target[key] === "undefined" ? oc(oc.empty)
// 					: typeof target[key] === "object" ? oc(target[key])
// 						: target[key];
// 			},
// 		},
// 	);
// 	// return new Proxy(data as any,
// 	// 	{
// 	// 		get: (target, key) => {
// 	// 			return typeof target[key] === "undefined" ? oc(oc.empty)
// 	// 				: typeof target[key] === "object" ? oc(target[key])
// 	// 					: target[key];
// 	// 		},
// 	// 	},
// 	// );
// }
// oc.empty = Object.create(null);

function format(str: string, ...args: any[]) {
  while (args.length && str.indexOf("%s") !== -1)
    str = str.replace("%s", args.shift());
  args.unshift(str);
  return args.join(',');
}
const homedir = require("os").homedir();
function pathResolveWithUser(settingsDir: string, str: string) {
  if (str.startsWith("~")) return path.join(homedir, str.slice(1));
  else return path.resolve(settingsDir, str);
}
function is<T>(test: (a: typeof b) => boolean, b: any): b is T {
  return test(b);
}
function as<T>(obj: T) {
  return obj;
}

function normalizeOptions(keypath: string[], a: OptionsSchema[keyof OptionsSchema]) {
  if (typeof a.$element !== "string") throw new Error("Missing $element property in " + keypath.join('.'));

  if (a.$element === "auth") {

  } else if (a.$element === "putsaver") {

  } else if (a.$element === "index") {

  } else {
    let { $element } = a;
    throw new Error("Invalid element " + $element + " found at " + keypath.join('.'));
  }
}

type normalizeTree_itemtype = Schema.ArrayGroupElement | Schema.GroupElement | { $element: undefined }
  | Schema.ArrayPathElement | Schema.PathElement | string
export function normalizeTree(settingsDir: string,
  item: Schema.ArrayGroupElement | Schema.GroupElement,
  key: string | undefined, keypath
): Config.GroupElement;
export function normalizeTree(settingsDir: string,
  item: Schema.ArrayPathElement | Schema.ArrayGroupElement | string,
  key: undefined, keypath
): Config.PathElement | Config.GroupElement;
export function normalizeTree(settingsDir: string,
  item: Schema.PathElement | Schema.GroupElement | string,
  key: string, keypath
): Config.PathElement | Config.GroupElement;
export function normalizeTree(settingsDir: string,
  item: Schema.ArrayPathElement | Schema.PathElement | string,
  key: string | undefined, keypath
): Config.PathElement;
export function normalizeTree(settingsDir, item: normalizeTree_itemtype, key, keypath: string[]): any {
  // type k<T> = T extends "options" ? never : T;
  if (typeof item === "object" && !item.$element) {
    //@ts-ignore
    if (Object.keys(item).findIndex(e => e.startsWith("$")) !== -1)
      console.log("Is this a mistake? Found keys starting with the dollar sign under /" + keypath.join('/'));
    item = as<Schema.GroupElement>({
      $element: "group",
      $children: item as any
    });
  }
  if (typeof item === "string" || item.$element === "folder") {
    if (typeof item === "string") item = { $element: "folder", path: item } as Config.PathElement;
    if (!item.path) throw new Error(format("path must be specified for folder item under '%s'", keypath.join(', ')));
    item.path = pathResolveWithUser(settingsDir, item.path);
    key = key || path.basename(item.path);
    let $options = item.$options || [];
    $options.forEach(e => normalizeOptions(keypath, e));
    return as<Config.PathElement>({
      $element: item.$element,
      $options,
      path: item.path,
      key,
      noTrailingSlash: !!item.noTrailingSlash
    });
  } else if (item.$element === "group") {
    if (!key) key = (item as Schema.ArrayGroupElement).key;
    if (!key) throw "key not provided for group element at /" + keypath.join('/');
    let tc = item.$children;
    let $options: Config.OptionElements[] = [];
    let $children: (Config.PathElement | Config.GroupElement)[] = [];
    if (Array.isArray(item.$children)) {
      $children = item.$children.filter((e: any): e is Schema.ArrayGroupElement | Schema.ArrayPathElement => {
        if (Config.isOption(e)) {
          throw "specifying options in $children is unsupported at " + keypath.join('.');
        } else {
          return true;
        }
      }).map(e => normalizeTree(settingsDir, e, undefined, [...keypath, key]));
      item.$options && $options.push(...item.$options);
    } else {
      // let tc: Record<string, Schema.GroupElement | Schema.PathElement> = item.$children;
      if (item.$children.$options) throw "specifying options in $children is unsupported at " + keypath.join('.');
      $children = Object.keys(tc).map(k => k === "$options" ? undefined : normalizeTree(settingsDir, tc[k], k, [...keypath, k]))
        .filter((e): e is NonNullable<typeof e> => !!e);
      $options = (e => {
        if (typeof e !== "undefined" && !Array.isArray(e))
          throw "$options is not an array at " + keypath.join('.');
        return e || [];
      })(item.$options);
    }
    key = is<Schema.ArrayGroupElement>(a => !!a.key, item) ? item.key : key;
    $options.forEach(e => normalizeOptions(keypath, e));
    return as<Config.GroupElement>({
      $element: "group", key, $children, $options,
      indexPath: item.indexPath ? pathResolveWithUser(settingsDir, item.indexPath) : false
    });
  } else {
    return item;
  }
}
export function normalizeTreeHost(settingsDir: string, host: Schema.HostElement) {
  if (host.$element !== "host") throw "Tree array must not mix host elements with other elements";
  return { ...host, $mount: normalizeTree(settingsDir, host.$mount as any, "$mount", []) };
}
export function normalizeSettingsTree(settingsDir: string, tree: ServerConfigSchema["tree"]) {
  let defaultHost = (tree2: any): Config.HostElement => ({
    $element: "host",
    // patterns: {
    // 	"ipv4": ["0.0.0.0/0"],
    // 	"domain": ["*"]
    // },
    // includeSubdomains: true,
    $mount: normalizeTree(settingsDir, tree2, "$mount", [])
  });
  if (typeof tree === "string" && tree.endsWith(".xml")) {
    //read the xml file and parse it as the tree structure

  } else if (typeof tree === "string" && (tree.endsWith(".js") || tree.endsWith(".json"))) {
    //require the json or js file and use it directly
    let filepath = pathResolveWithUser(settingsDir, tree);
    let nodeRequire = __non_webpack_require__ ? __non_webpack_require__ : require;
    tree = nodeRequire(filepath).tree;
  }
  //otherwise just assume we're using the value itself.
  //we are not implementing host-based routing yet. If TiddlyServer is 
  //loaded as a module, the tree may be added to after the settings file
  //has been normalized and the preflighter may specify any index in the 
  //host array.
  return [defaultHost(tree)];

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
export function normalizeSettings(_set: ServerConfigSchema, settingsFile) {
  const settingsDir = path.dirname(settingsFile);
  let set = oc(_set);
  // proxset.bindInfo
  if (!set.tree) throw "tree is required in ServerConfig";
  let lap = {
    "localhost": {
      ...as<ServerConfig_AccessOptions>({
        writeErrors: true,
        mkdir: true,
        upload: true,
        websockets: true,
        registerNotice: true,
        putsaver: true,
        loginlink: true,
        transfer: false
      }),
      ...set.bindInfo.localAddressPermissions["localhost"]({} as any)
    },
    "*": {
      ...as<ServerConfig_AccessOptions>({
        writeErrors: true,
        mkdir: false,
        upload: false,
        websockets: true,
        registerNotice: false,
        putsaver: true,
        loginlink: true,
        transfer: false
      }),
      ...set.bindInfo.localAddressPermissions["*"]({} as any)
    }
  };

  Object.keys(set.bindInfo.localAddressPermissions({})).forEach(k => {
    if (k === "localhost" || k === "*") return;
    lap[k] = set.bindInfo.localAddressPermissions[k](lap["*"]);
    Object.keys(lap["*"]).forEach(k2 => {
      if (lap[k][k2] === undefined) lap[k][k2] = lap["*"][k2];
    });
  });
  let newset: ServerConfig = {
    __dirname: "",
    __filename: "",
    __assetsDir: "",
    __targetTW: "",
    _devmode: !!set._devmode(),
    _datafoldertarget: set._datafoldertarget() || "",
    tree: normalizeSettingsTree(settingsDir, set.tree() as any),
    bindInfo: {
      // ...{
      bindAddress: set.bindInfo.bindAddress([]),
      bindWildcard: set.bindInfo.bindWildcard(false),
      enableIPv6: set.bindInfo.enableIPv6(false),
      filterBindAddress: set.bindInfo.filterBindAddress(false),
      port: set.bindInfo.port(8080),
      localAddressPermissions: lap,
      _bindLocalhost: set.bindInfo._bindLocalhost(false),
      https: !!set.bindInfo.https("")
      // },
      // ...spread(set.bindInfo),
      // ...{
      // 	https: !!(set.bindInfo && set.bindInfo.https)
      // }
    },
    logging: {
      // ...{
      debugLevel: set.logging.debugLevel(0),
      logAccess: set.logging.logAccess(""),
      logError: set.logging.logError(""),
      logColorsToFile: set.logging.logColorsToFile(false),
      logToConsoleAlso: set.logging.logToConsoleAlso(true),
      // }
    },
    authAccounts: set.authAccounts({}),
    putsaver: {
      // ...{
      etagAge: set.putsaver.etagAge(3),
      backupFolder: set.putsaver.backupFolder(""),
      etag: set.putsaver.etag("optional")
    },
    datafolder: set.datafolder({}),
    directoryIndex: {
      // ...{
      defaultType: set.directoryIndex.defaultType("html"),
      icons: {
        ...set.directoryIndex.icons({}),
        "htmlfile": set.directoryIndex.icons["htmlfile"](["htm", "html"]),
      },
      types: {},
      mixFolders: set.directoryIndex.mixFolders(true),
      mimetypes: {}
      // },
      // ...spread(set.directoryIndex)
    },
    EXPERIMENTAL_clientside_datafolders: {
      // ...{
      enabled: set.EXPERIMENTAL_clientside_datafolders.enabled(false),
      alwaysRefreshCache: set.EXPERIMENTAL_clientside_datafolders.alwaysRefreshCache(true),
      maxAge_tw_plugins: set.EXPERIMENTAL_clientside_datafolders.maxAge_tw_plugins(0)
      // },
      // ...spread(set.EXPERIMENTAL_clientside_datafolders)
    },
    authCookieAge: set.authCookieAge(2592000),
    maxTransferRequests: set.maxTransferRequests(0),
    $schema: "./settings.schema.json"
  }

  Object.keys(newset.directoryIndex.icons).forEach(type => {
    newset.directoryIndex.icons[type].forEach(ext => {
      if (!newset.directoryIndex.types[ext]) {
        newset.directoryIndex.types[ext] = type;
      } else {
        throw format('Multiple types for extension %s: %s', ext, newset.directoryIndex.types[ext], type);
      }
    })
  });


  if (newset.putsaver && newset.putsaver.backupFolder)
    newset.putsaver.backupFolder = pathResolveWithUser(settingsDir, newset.putsaver.backupFolder);
  if (newset.logging.logAccess)
    newset.logging.logAccess = pathResolveWithUser(settingsDir, newset.logging.logAccess);
  if (newset.logging.logError)
    newset.logging.logError = pathResolveWithUser(settingsDir, newset.logging.logError);

  newset.__dirname = settingsDir;
  newset.__filename = settingsFile;

  if (newset.putsaver && newset.putsaver.etag === "disabled" && !newset.putsaver.backupFolder) {
    console.log("Etag checking is disabled, but a backup folder is not set. "
      + "Changes made in multiple tabs/windows/browsers/computers can overwrite each "
      + "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED "
      + "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can "
      + "also set the etagWindow setting to allow files to be modified if not newer than "
      + "so many seconds from the copy being saved.");
  }
  return newset;
}
// T extends U ? never : T
type ExcludedPartial<T, NK> = { [P in keyof T]?: (P extends NK ? never : T[P]) | undefined; };  //Partial<ServerConfig_DirectoryIndex>
export interface ServerConfigSchema {
  /** enables certain expensive per-request checks */
  _devmode?: boolean;
	/** 
	 * The tiddlywiki folder to use for data folder instances. Defaults to the 
	 * tiddlywiki folder in the TiddlyServer installation regardless of the 
	 * settings.json location.
	 */
  _datafoldertarget?: string;
	/**
	 * The tree property accepts one of 3 formats. If it is a string ending in `.xml`, `.js`, or `.json`, 
	 * the tree will be loaded from the specified path. JS and JSON files must export a `tree` property 
	 * and XML files must specify a `tree` element as root.
	 * 
	 * - A path element (or a string specifying the path) to mount a path as root (a single file is possible but pointless)
	 * - A group element or the children of a group element (which is either an array, or an object with no $element property)
	 */
  tree: any;
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
  directoryIndex?: ExcludedPartial<ServerConfig_DirectoryIndex, "types">;
  /** tiddlyserver specific options */
  putsaver?: Partial<ServerConfig_PutSaver>,
  /** 
   * Options object whose properties will be passed to the tiddlywiki server instance using the spread operator.
   * If a property specifies an object instead of a string, the object will be shared between all instances. 
   */
  datafolder?: Record<string, any>,
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
  /** Max concurrent transfer requests */
  maxTransferRequests?: number
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
  tree: Config.HostElement[];
  /** bind address and port */
  bindInfo: ServerConfig_BindInfo & {
    https: boolean;
  }
  /** logging  */
  logging: ServerConfig_Logging;
  /** directory index */
  directoryIndex: ServerConfig_DirectoryIndex
  /** PUT saver options */
  putsaver: ServerConfig_PutSaver | false,
  /** Variables passed directly to TiddlyWiki server instance */
  datafolder: Record<string, unknown>,
	/** 
	 * The Hashmap of accounts which may authenticate on this server.
	 * Takes either an object or a string to a `require`-able file (such as .js or .json) 
	 * which exports the object
	 */
  authAccounts: { [K: string]: ServerConfig_AuthAccountsValue }
  /** client-side data folder loader which loads datafolders directly into the browser */
  EXPERIMENTAL_clientside_datafolders: ServerConfig_ClientsideDatafolders,
	/** 
	 * Age in seconds to set for the auth cookie (default is 30 days)
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
  /** Max concurrent transfer requests */
  maxTransferRequests: number
  $schema: string;

  __dirname: string;
  __filename: string;
  __assetsDir: string;
  __targetTW: string;
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
	/** 
	 * @default {"username":{"publicKey":"","cookieSalt":""}}
	 */
  clientKeys: {
		/**
		 * Changing the public key or cookie suffix will require the user to log in again. 
		 */
    [P: string]: {
      /** public key */
      publicKey: string,
			/** 
			 * String which will be added to the cookie by the server.
			 * Changing it will invalidate all current cookies for this user,
			 * which requires them to login again on each device. 
			 * `node -e "console.log(Date.now())"` will print the current timestamp,
			 * which you can use to make sure you get one that you've never used it before. 
			 */
      cookieSalt: string
    }
  }; // Record<string, [string, string]>,
	/** 
	 * override hostLevelPermissions for users with this account 
	 * 
	 * @default {"mkdir":true,"upload":true,"registerNotice":true,"websockets":true,"writeErrors":true,"putsaver":true,"loginlink":true}
	 */
  permissions: ServerConfig_AccessOptions
}
/**
 * @default {"mkdir":true,"upload":true,"registerNotice":true,"websockets":true,"writeErrors":true,"putsaver":true}
 */
export interface ServerConfig_AccessOptions {
  /** allow the putsaver to be used */
  putsaver: boolean
  /** write error messages to the browser */
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
  /** link to the login page when returning auth errors */
  loginlink: boolean;
  /** Allows two clients to communicate through the server */
  transfer: boolean;
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

	/** 
	 * Permissions based on local address: "localhost", "*" (all others), "192.168.0.0/16", etc. 
	 * This checks the IP address each client connects to (socket.localAddress), 
	 * not the bind address of the server instance that accepted the request.
	 * @default {"localhost":{"mkdir":true,"upload":true,"registerNotice":true,"websockets":true,"writeErrors":true,"putsaver":true}}
	 */
  localAddressPermissions: {
		/** 
		 */
    [host: string]: ServerConfig_AccessOptions
  }
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
	 * Hashmap of type { "icon_name": [".ext", "mime/type"]} where ext represents the extensions to use this icon for. 
	 * Icons are in the TiddlyServer/assets/icons folder.
	 */
  icons: { [iconName: string]: string[] }
  types: { [ext: string]: string }
  /** additional extensions to apply to mime types ["mime/type"]: ["htm", "html"] */
  mimetypes: { [type: string]: string[] }
}
export interface ServerConfig_PutSaver {
	/** 
	 * Backup folder to store backups in. Multiple folder paths can backup to the same folder if desired. 
	 */
  backupFolder?: string,
	/** 
	 * GZip backup file to save disk space. Good for larger wikis. Turn this off for experimental wikis that you often need to restore from a backup because of a bad line of code (I speak from experience).
	 */
  gzipBackups?: boolean,
	/** 
	 * Reject an etag with a modified time that is different than the file on disk by this many seconds. 
   * Sometimes sync or antivirus sofware will "touch" a file and update the modified time without changing anything.
   * Size difference will still cause the request to be rejected.
	 */
  etagAge?: number,
	/** 
	 * Whether to use the etag field -- if not specified then it will check it if presented.
	 * This does not affect the backup etagAge option, as the saving mechanism will still 
	 * send etags back to the browser, regardless of this option.
	 */
  etag?: "required" | "disabled" | "optional"
}

// export interface NewTreeGroupSchema extends NewTreeGroupSchemaHashmap {
// 	key: string;
// }
// /** @default { "$element": {}} */
// /**
//  * 
//  * @description A hashmap of `group` elements, `folder` elements, and folder paths
//  */
// export interface NewTreeObjectSchema {
// 	/**
// 	 * The children of a hashmap `group` element which are not
// 	 * `group` or `folder` elements
// 	 */
// 	//@ts-ignore
// 	$children?: NewTreeOptions[]
// 	/** 
// 	 * @description A hashmap tree element: either a string or a group/folder element without the `key` attribute
// 	 * @default { "$element": {}}
// 	 * @pattern ^([^$]+)+$ 
// 	 */
// 	[K: string]: NewTreeObjectSchemaItem
// }
// export type NewTreeObjectSchemaItem = NewTreeGroupSchemaHashmap | NewTreePathHashmap | string
// /**
//  * @default {"$element": ""} 
//  */
// export type NewTreeItemSchema = NewTreeGroupSchema | NewTreePathSchema | string;
// export type NewTreeItem = NewTreeGroup | NewTreePath | NewTreeOptions;
export interface NewTreeMountArgs {


}
type PartialExcept<T extends {}, REQUIRED extends keyof T> = {
  [KEY in Extract<keyof T, REQUIRED>]-?: T[KEY];
} & {
    [KEY in Exclude<keyof T, REQUIRED>]?: T[KEY];
  }
// type OptionElementsSchema = ;
export interface OptionsSchema {
  auth: Config.Options_Auth,
  backups: Config.Options_Backups,
  index: Config.Options_Index,
}
/** Used by the StateObject to compile the final Options object for the request */
export interface OptionsConfig {
  auth: Required<Config.Options_Auth>,
  putsaver: Required<Config.Options_Backups>,
  index: Required<Config.Options_Index>
}
/** The options array schema is in `settings-2-1-tree-options.schema.json` */
export type OptionsArraySchema = (OptionsSchema[keyof OptionsSchema])[];

export namespace Config {
  export type OptionElements = OptionsSchema[keyof OptionsSchema];

  export interface Options_Index {
		/**
		 * Options related to the directory index (request paths that resolve to a folder
		 * which is not a data folder). Option elements affect the group
		 * they belong to and all children under that. Each property in an option element 
		 * replaces the key from parent option elements.
		 */
    $element: "index",
		/** 
		 * The format of the index generated if no index file is found, or "403" to 
		 * return a 403 Access Denied, or 404 to return a 404 Not Found. 403 is the 
		 * error code used by Apache and Nginx. 
		 */
    defaultType?: "html" | "json" | 403 | 404,
		/** 
		 * Look for index files named exactly this or with one of the defaultExts added. 
		 * For example, a defaultFile of ["index"] and a defaultExts of ["htm","",html"] would 
		 * look for ["index.htm","index","index.html"] in that order. 
		 * 
		 * Only applies to folder elements, but may be set on a group element. An empty array disables this feature.
		 * To use a .hidden file, put the full filename here, and set indexExts to `[""]`. 
		 */
    indexFile?: string[],
		/** 
		 * Extensions to add when looking for an index file. A blank string will set the order 
		 * to search for the exact indexFile name. The extensions are searched in the order specified. 
		 * 
		 * Only applies to folder elements, but may be set on a group element. An empty array disables this feature.
		 * The default is `[""]`, which will search for an exact indexFile. 
		 */
    indexExts?: string[]
  }
  export interface Options_Auth {
		/** 
		 * Only allow requests using these authAccounts. Option elements affect the group they belong to and all children under that. Each property in an auth element replaces the key from parent auth elements.
		 * 
		 * Anonymous requests are ALWAYS denied if an auth list applies to the requested path. 
		 * 
		 * Note that this does not change server authentication procedures. Data folders are always given the authenticated username regardless of whether there are auth elements in the tree.
		 */
    $element: "auth";
    /** Array of keys from authAccounts object that can access this resource. Null allows all, including anonymous. */
    authList?: string[] | null;
		/** 
		 * Which error code to return for unauthorized (or anonymous) requests
		 * - 403 Access Denied: Client is not granted permission to access this resouce.
		 * - 404 Not Found: Client is told that the resource does not exist.
		 */
    authError?: 403 | 404;
  }
  export interface Options_Backups extends ServerConfig_PutSaver {
    /** Options related to backups for single-file wikis. Option elements affect the group they belong to and all children under that. Each property in a backups element replaces the key from parent backups elements. */
    $element: "putsaver",

  }

  export function isOption(a: any): a is OptionElements {
    return !!a.$element && ["auth", "backups", "index"].indexOf(a.$element) !== -1;
  }
  export function isElement(a: any): a is GroupElement | PathElement | HostElement | OptionElements {
    return (typeof a === "object" && typeof a["$element"] === "string");
  }
  export function isGroup(a: any): a is GroupElement {
    return isElement(a) && a.$element === "group";
  }
  export function isPath(a: any): a is PathElement {
    return isElement(a) && a.$element === "folder";
  }
  export type MountElement = GroupElement | PathElement;
  // export type HostElement = Schema.HostElement;
  export interface HostElement {
    $element: "host",
    //Commenting these out for now. They may be added later.
    // patterns: {
    // 	"ipv4": string[],
    // 	"domain": string[]
    // },
    // includeSubdomains: boolean,
    $mount: GroupElement | PathElement;
  }
  export interface GroupElement {
    $element: "group";
    key: string;
    indexPath: string | false;
    $children: MountElement[];
    $options: OptionElements[];
  }
  export interface PathElement {
    $element: "folder";
    key: string;
    path: string;
    noTrailingSlash: boolean;
    // $children: never;
    $options: OptionElements[];
  }
}
export namespace Schema {
  interface SchemaObjectDefinition {
    "type": "object";
    "additionalProperties": boolean;
    "properties": {};
    "required": string[];
    "title": string;
    "description": string;
  }
  function define(name: string, val: any) {

  }
  function defstring(enumArr?: string[]) {
    return {
      "type": "string",
      "enum": ["group"]
    }
  }
  export type GroupChildElements = (Record<string, GroupElement | PathElement | string>) | (ArrayGroupElement | ArrayPathElement | string)[];
  export type OptionElements = Config.OptionElements;
  export type TreeElement = HostElement[] | GroupChildElements | string;
  /** Host elements may only be specified in arrays */
  export interface HostElement {
    $element: "host",
    // /** 
    //  * The pattern to match Host header to. 
    //  * 
    //  * For domains, an asterisk will not match a period, but may be placed anywhere in the string. 
    //  * (so `example.*` would match `example.com` and `example.net`, etc.) 
    //  * 
    //  * IPv4 address may include the CIDR notation (0.0.0.0/0 matches all IPv4 addresses), 
    //  * and trailing 0's imply subnet mask accordingly. (so `127.0.0.0` would be `127.0.0.0/8`)
    //  * 
    //  * IPv6 is not supported but may be added using the preflighter (an advanced feature)
    //  * */
    // patterns: {
    // 	"ipv4": string[],
    // 	"domain": string[]
    // }
    // /** Whether the pattern should match subdomains of the host name (e.g. example.com would include server2.apis.example.com) */
    // includeSubdomains: boolean,
    /** The HostElement child may be one group or folder element. A string may be used in place of a folder element. */
    $mount: GroupElement | PathElement | string;
  }


  export interface GroupElement {
    $element: "group";
    indexPath?: string,
    $children: GroupChildElements;
    $options?: OptionElements[]
  }
  export interface ArrayGroupElement extends GroupElement {
    key: string;
  }
  export interface PathElement {
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
    $options?: OptionElements[];
  }
  export interface ArrayPathElement extends PathElement {
    key: string;
  }
}
namespace Test {
  type Test<A, T extends { [K in keyof A]-?: any }> = T;
  //make sure that all keys in the schema are included in the config
  type Host = Test<Schema.HostElement, Config.HostElement>;
  type Group = Test<Schema.ArrayGroupElement, Config.GroupElement>;
  type Path = Test<Schema.ArrayPathElement, Config.PathElement>;
  type Root1 = Test<ServerConfigSchema, ServerConfig>;
}


/** @default { "$element": "" } */
export type NewTreeOptions = Config.OptionElements

export type NewTreeOptionsObject = OptionsSchema

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
	 * return a 403 Access Denied, or 404 to return a 404 Not Found. 403 is the 
	 * error code used by Apache and Nginx. 
	 */
  defaultType: "html" | "json" | 403 | 404,
	/** 
	 * Look for index files named exactly this or with one of the defaultExts added. 
	 * For example, a defaultFile of ["index"] and a defaultExts of ["htm","",html"] would 
	 * look for ["index.htm","index","index.html"] in that order. 
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
	 * The default is `[""]`, which will search for an exact indexFile. 
	 */
  indexExts: string[]
}
export interface NewTreePathOptions_Auth {
	/** 
	 * Only allow requests using these authAccounts. Option elements affect the group
	 * they belong to and all children under that. Each property in an auth element 
	 * replaces the key from parent auth elements.
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
  authError: 403 | 404;
}
export interface NewTreePathOptions_Backup {
	/** Options related to backups for single-file wikis. Option elements affect the group
	 * they belong to and all children under that. Each property in a backups element 
	 * replaces the key from parent backups elements. */
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
  // tree: any,
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
  tree: any
}
export interface OldServerConfig extends OldServerConfigBase {
  tree: any,
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

export function ConvertSettings(set: OldServerConfig): ServerConfigSchema {
  return {
    // __assetsDir: set.__assetsDir,
    // __dirname: set.__dirname,
    // __filename: set.__filename,
    _devmode: set._devmode,
    _datafoldertarget: undefined,
    tree: set.tree,
    bindInfo: {
      bindAddress: (set.host === "0.0.0.0" || set.host === "::") ? undefined : [set.host],
      filterBindAddress: undefined,
      enableIPv6: set.host === "::",
      port: set.port,
      bindWildcard: set.host === "0.0.0.0" || set.host === "::",
      localAddressPermissions: {
        "localhost": set.allowLocalhost,
        "*": set.allowNetwork
      },
      https: undefined,
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
      etag: set.etag || "optional",
      etagAge: set.etagWindow,
      backupFolder: "",
    },
    datafolder: {},
    authAccounts: {},
    directoryIndex: {
      defaultType: "html",
      icons: set.types,
      mixFolders: set.mixFolders,
      // types: {}
    },
    EXPERIMENTAL_clientside_datafolders: (typeof set.tsa === "object" || typeof set.maxAge === "object") ? {
      enabled: false,
      alwaysRefreshCache: typeof set.tsa === "object" ? set.tsa.alwaysRefreshCache : true,
      maxAge_tw_plugins: typeof set.maxAge === "object" ? set.maxAge.tw_plugins : 0
    } : undefined,
    authCookieAge: 2592000,
    $schema: "./settings-2-1.schema.json"
  }
}
