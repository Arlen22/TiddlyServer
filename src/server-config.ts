export interface ServerConfigSchema extends ServerConfigBase {
	tree: NewTreeObjectSchemaItem
	server: ServerConfigBase["server"] & {
		/** 
 		 * https-only options: a string to a JavaScript file which exports a function of type
		 * `(iface:string) => https.ServerOptions`. Note that the initServer function will 
		 * change this to a boolean value indicating whether https is in use once inside TiddlyServer.
 		 */
		https?: string;
	}
	/** 
	 * The Hashmap of accounts which may authenticate on this server.
	 * Takes either an object or a string to a `require`-able file (such as .js or .json) 
	 * which exports the object
	 */
	authAccounts?: {
		[K: string]: {
			/** credentials to use for this account, or false to create a "group" */
			credentials: ServerConfig_AuthPassword | ServerConfig_AuthClientKey | false,
			/** override hostLevelPermissions for this account (optional) */
			permissions?: ServerConfig_AccessOptions,
			/** inherit permissions from another key in authAccounts (optional)  */
			inheritPermissions?: string;
		}
	}
}

export interface ServerConfig extends ServerConfigBase {
	tree: NewTreeGroup | NewTreePath
	server: ServerConfigBase["server"] & {
		https: boolean;
	}
	authAccounts: {
		[K: string]: {
			/** credentials to use for this account, or false to create a "group" */
			credentials: ServerConfig_AuthPassword | ServerConfig_AuthClientKey
			/** override hostLevelPermissions for this account (optional) */
			permissions: ServerConfig_AccessOptions
		}
	}
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
	/** Path relative to this file or any absolute path NodeJS can stat */
	path: string;
	/** 
	 * Load data folders under this path with no trailing slash.
	 * This imitates single-file wikis and allows tiddlers with relative links
	 * to be imported directly into a data folder wiki. The source point of the 
	 * relative link becomes the data folder itself as though it is actually a file.
	 */
	noTrailingSlash?: boolean;
	$children: NewTreeOptions[];

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
	| NewTreePathOptions_Auth;

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
export interface NewTreePathOptions_Auth {
	/** 
	 * Only allow requests using these authAccounts. This affects all descendants under 
	 * this item unless another auth element is found further down. Each auth element stands alone and 
	 * completely overrides the auth elements above them, so a more restrictive auth element
	 * can be overridden by a less restrictive auth element below it. 
	 * 
	 * Anonymous requests are ALWAYS denied if an auth element applies to the requested path. 
	 * 
	 * Note that this does not change server authentication procedures. 
	 * Data folders are always given the authenticated username
	 * regardless of whether there are auth elements in the tree.
	 */
	$element: "auth";
	/** list of keys from authAccounts (that have credentials) that can access this resource */
	authList: string[];
}
export interface SecureServerOptionsSchema {

	/************************************************************************************** 
	 * All private keys in PEM format as specified in  
	 * https://nodejs.org/docs/latest-v8.x/api/tls.html#tls_tls_createsecurecontext_options
	 */
	key: (string | { path: string, passphrase: string })[];

	/**************************************************************************************
	 * The certificate chain for all private keys in PEM format as specified in 
	 * https://nodejs.org/docs/latest-v8.x/api/tls.html#tls_tls_createsecurecontext_options 
	 */
	cert: string[];

	/**************************************************************************************
	 * Private keys with their certs in a PFX or PKCS12 as specified in 
	 * https://nodejs.org/docs/latest-v8.x/api/tls.html#tls_tls_createsecurecontext_options 
	 */
	pfx: (string | { path: string, passphrase: string })[];

	/** 
	 * Passphrase to use for password protected keys if none is specificed 
	 * for that key, as specified in 
	 * https://nodejs.org/docs/latest-v8.x/api/tls.html#tls_tls_createsecurecontext_options 
	 */
	passphrase: string;
	/** 
	 * @summary Request Client Certificate
	 * 
	 * EITHER: A list of file paths of self-signed certs and certificate authorities to allow for 
	 * client certificates. OR: Boolean `true` in which case the list of Mozilla CAs will be used and 
	 * self-signed certs will NOT be possible IF `rejectUnauthorizedCertificate` is ALSO true.
	 */
	requestClientCertificate: string[] | boolean;
	/** 
	 * @summary Reject Unauthorized Clients
	 * 
	 * Whether to reject connections which do not have a valid certificate. If this is set to true,
	 * then ALL requests that do not match `requestClientCertificate` will be rejected during the TLS 
	 * handshake, even if they are specified in the authAccounts hashmap.
	 */
	rejectUnauthorizedCertificate: boolean;
}
export interface SecureServerOptions {
	key: { path: string, passphrase: string, buff: Buffer }[];
	cert: { path: string, buff: Buffer }[];
	pfx: { path: string, passphrase: string, buff: Buffer }[];
	passphrase: string;
	requestClientCertificate: string[] | boolean;
	rejectUnauthorizedCertificate: boolean;
}
export interface ServerConfig_AuthPassword {
	/** basic auth or cookie */
	type: "password",
	/** Username given to TiddlyWiki data folders and anywhere else it's needed */
	username: string,
	/** password encoded in utf8 */
	password: string
}
/** Use client certificate authentication, requires HTTPS */
export interface ServerConfig_AuthClientKey {
	/** client certificate */
	type: "clientKey",
	/** 
	 * Username given to TiddlyWiki data folders and anywhere else it's needed. If true, 
	 * the user is allowed to specify the username they want to use.
	 */
	username: string | true,
	/** The public key string for this authAccount */
	publicKey: string;
}
// /** 
//  * All certificate authories and self-signed certificates to allow for this auth entry.
//  * May be any authority in the certificate chain. This does not change the server https
//  * options, so requests will only be checked here if the server accepts the connection.
//  * 
//  * If multiple authAccount entries match a certificate, the order is as follows.
//  * - First, the closer one in the chain takes priority.
//  * - Second, the one with `username` set to true takes priority.
//  * - Third (if both are string), `usernameMustMmatch` set to true takes priority.
//  * - Third (if both are true), the shortest `certificateAuthority` array takes priority.
//  * - Fourth, the first in the order returned by `Object.keys()` takes priority and 
//  *   a debug message level 2 (warning) is logged for the request.
//  */
// publicKey: string;
// /**
//  * Require the certificate common name to match the username. Default is true. Has no effect if 
//  * `username` is also true as the username is taken directly from the common name in that case.
//  */
// usernameMustMatch: boolean;
export interface ServerConfigBase {
	/** 
	 * Generic webserver options. 
	 */
	server: ServerConfig_Server
	/** directory index options */
	directoryIndex: ServerConfig_DirectoryIndex
	/** tiddlyserver specific options */
	tiddlyserver: ServerConfig_TiddlyServer

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
	/** allow websocket connections (default true) */
	websockets: boolean;
	/** 
	 * login attempts for a public/private key pair which has not been 
	 * registered will be logged at debug level 2 with the full public key
	 * which can be copied into an authAccounts entry. 
	 */
	registerNotice: boolean;
}
export interface ServerConfig_Server {
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

	/** always bind a separate server instance to 127.0.0.1 regardless of any other settings */
	_bindLocalhost: boolean;
	/** enables certain expensive per-request checks */
	_devmode: boolean;
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
	backupDirectory?: string
	/** whether to use the etag field, blank string means "if specified" */
	etag: "required" | "disabled" | ""
	/** etag does not need to be exact by this many seconds */
	etagWindow: number
	/** permissions based on host address: "localhost", "*" (all others), "192.168.0.0/16" */
	hostLevelPermissions: { [host: string]: ServerConfig_AccessOptions }
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
}