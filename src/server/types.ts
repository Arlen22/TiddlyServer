import * as fs from 'fs'
import * as https from 'https'
import { StateObject } from '../state-object'
import { RequestEvent } from '../request-event'
import { EventEmitter } from 'events'
import { Config } from './config'

export type RequestEventFn = <T extends RequestEvent>(ev: T) => Promise<T>

export type ServerOptionsByHost = (host: string) => https.ServerOptions

type ServerRoutes = 'admin' | 'assets' | 'favicon.ico' | 'directory.css'
export type ServerRouteHandlers = {
  [key in ServerRoutes]: (state: StateObject) => void
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
export type DebugLogger = (level: number, format: string, ...args: string[]) => void

interface ServerEventsListener<THIS> {
  (event: 'websocket-connection', listener: (data: RequestEvent) => void): THIS
  (event: 'settingsChanged', listener: (keys: (keyof ServerConfig)[]) => void): THIS
  (event: 'settings', listener: (settings: ServerConfig) => void): THIS
  (event: 'stateError', listener: (state: StateObject) => void): THIS
  (event: 'stateDebug', listener: (state: StateObject) => void): THIS
  (
    event: 'serverOpen',
    listener: (serverList: any[], hosts: string[], https: boolean, dryRun: boolean) => void
  ): THIS
  (event: 'serverClose', listener: (iface: string) => void): THIS
}

type ServerEvents = 'websocket-connection' | 'settingsChanged' | 'settings'

export interface ServerEventEmitter extends EventEmitter {
  emit(event: 'websocket-connection', data: RequestEvent): boolean
  emit(event: 'settingsChanged', keys: (keyof ServerConfig)[]): boolean
  emit(event: 'settings', settings: ServerConfig): boolean
  emit(event: 'stateError', state: StateObject<any, any>): boolean
  emit(event: 'stateDebug', state: StateObject<any, any>): boolean
  emit(
    event: 'serverOpen',
    serverList: any[],
    hosts: string[],
    https: boolean,
    dryRun: boolean
  ): boolean
  emit(event: 'serverClose', iface: string): boolean
  addListener: ServerEventsListener<this>
  on: ServerEventsListener<this>
  once: ServerEventsListener<this>
  prependListener: ServerEventsListener<this>
  prependOnceListener: ServerEventsListener<this>
  removeListener: ServerEventsListener<this>
  removeAllListeners(event?: ServerEvents): this
  setMaxListeners(n: number): this
  getMaxListeners(): number
  listeners(event: ServerEvents): Function[]
  eventNames(): ServerEvents[]
  listenerCount(type: ServerEvents): number
}

export type Hashmap<T> = { [K: string]: T }

export interface DirectoryEntry {
  name: string
  type: string
  path: string
  size: string
}

export interface Directory {
  path: string
  entries: DirectoryEntry[]
  type: string
}

export class JsonError {
  public filePath: string = ''
  constructor(
    /** The full JSON string showing the position of the error */
    public errorPosition: string,
    /** The original error return by JSON.parse */
    public originalError: Error
  ) {}
}

export type DirectoryIndexData = {
  keys: string[]
  paths: (string | true)[]
  dirpath: string
  type: 'group' | 'folder'
}

export type DirectoryIndexOptions = {
  upload: boolean
  mkdir: boolean
  format: 'json' | 'html'
  mixFolders: boolean
  isLoggedIn: string | false
  extTypes: { [ext: string]: string }
}

export interface IStatPathResult<IT, ST, IFST, END> {
  stat: ST
  infostat: IFST
  index: number
  endStat: END
  itemtype: IT
  statpath: string
}

export type StatPathResult =
  | IStatPathResult<'error', fs.Stats | undefined, undefined, true>
  | IStatPathResult<'folder', fs.Stats, undefined, false>
  | IStatPathResult<'datafolder', fs.Stats, fs.Stats, true>
  | IStatPathResult<'file', fs.Stats, undefined, true>

export interface StateObjectUrl {
  path: string
  pathname: string
  query: Hashmap<string[] | string | undefined>
  search: string
  href: string
}

export interface StandardResponseHeaders {
  /** Specifying which web sites can participate in cross-origin resource sharing */
  'Access-Control-Allow-Origin'?: string
  /** Specifying which web sites can participate in cross-origin resource sharing */
  'Access-Control-Allow-Credentials'?: string
  /** Specifying which web sites can participate in cross-origin resource sharing */
  'Access-Control-Expose-Headers'?: string
  /** Specifying which web sites can participate in cross-origin resource sharing */
  'Access-Control-Max-Age'?: string
  /** Specifying which web sites can participate in cross-origin resource sharing */
  'Access-Control-Allow-Methods'?: string
  /** Specifying which web sites can participate in cross-origin resource sharing */
  'Access-Control-Allow-Headers'?: string
  /** Specifies which patch document formats this server supports */
  'Accept-Patch'?: string
  /** What partial content range types this server supports via byte serving */
  'Accept-Ranges'?: string
  /** The age the object has been in a proxy cachein seconds */
  'Age'?: string
  /** Valid methods for a specified resource. To be used for a 405 Method not allowed */
  'Allow'?: string
  /**
   * A server uses "Alt-Svc" header (meaning Alternative Services) to indicate that its resources can also be accessed at a different
   * When using HTTP/2, servers should instead send an ALTSVC frame. [45]
   */
  'Alt-Svc'?: string
  /** Tells all caching mechanisms from server to client whether they may cache this object. It is measured in seconds */
  'Cache-Control'?: string
  /** Control options for the current connection and list of hop-by-hop response fields.[12] Must not be used with HTTP/2.[13] */
  'Connection'?: string
  /** An opportunity to raise a "File Download" dialogue box for a known MIME type with binary format or suggest a filename for dynami */
  'Content-Disposition'?: string
  /** The type of encoding used on the data. See HTTP compression. */
  'Content-Encoding'?: string
  /** The natural language or languages of the intended audience for the enclosed content[47] */
  'Content-Language'?: string
  /** The length of the response body in octets (8-bit bytes) */
  'Content-Length'?: string
  /** An alternate location for the returned data */
  'Content-Location'?: string
  /** A Base64-encoded binary MD5 sum of the content of the response */
  'Content-MD5'?: string
  /** Where in a full body message this partial message belongs */
  'Content-Range'?: string
  /** The MIME type of this content */
  'Content-Type'?: string
  /** The date and time that the message was sent (in "HTTP-date" format as defined by RFC 7231) [48] */
  'Date'?: string
  /** Specifies the delta-encoding entity tag of the response[10]. */
  'Delta-Base'?: string
  /** An identifier for a specific version of a resource, often a message digest */
  'ETag'?: string
  /** Gives the date/time after which the response is considered stale (in "HTTP-date" format as defined by RFC 7231) */
  'Expires'?: string
  /** Instance-manipulations applied to the response[10]. */
  'IM'?: string
  /** The last modified date for the requested object (in "HTTP-date" format as defined by RFC 7231) */
  'Last-Modified'?: string
  /** Used to express a typed relationship with another resource, where the relation type is defined by RFC 5988 */
  'Link'?: string
  /** Used in redirection, or when a new resource has been created. */
  'Location'?: string
  /** This field is supposed to set P3P policy, in the form of P3P:CP="your_compact_policy". However, P3P did not take off,[50] most b*/
  'P3P'?: string
  /** Implementation-specific fields that may have various effects anywhere along the request-response chain. */
  'Pragma'?: string
  /** Request authentication to access the proxy. */
  'Proxy-Authenticate'?: string
  /** HTTP Public Key Pinning, announces hash of website's authentic TLS certificate */
  'Public-Key-Pins'?: string
  /** If an entity is temporarily unavailable, this instructs the client to try again later. Value could be a specified period of time*/
  'Retry-After'?: string
  /** A name for the server */
  'Server'?: string
  /** An HTTP cookie */
  'Set-Cookie'?: string[]
  /** A HSTS Policy informing the HTTP client how long to cache the HTTPS only policy and whether this applies to subdomains. */
  'Strict-Transport-Security'?: string
  /** The Trailer general field value indicates that the given set of header fields is present in the trailer of a message encoded wit */
  'Trailer'?: string
  /** The form of encoding used to safely transfer the entity to the user. Currently defined methods are: chunked, compress, deflate, */
  'Transfer-Encoding'?: string
  /** Tracking Status header, value suggested to be sent in response to a DNT(do-not-track), possible values: */
  'Tk'?: string
  /** Ask the client to upgrade to another protocol. */
  'Upgrade'?: string
  /** Tells downstream proxies how to match future request headers to decide whether the cached response can be used rather than reque */
  'Vary'?: string
  /** Informs the client of proxies through which the response was sent. */
  'Via'?: string
  /** A general warning about possible problems with the entity body. */
  'Warning'?: string
  /** Indicates the authentication scheme that should be used to access the requested entity. */
  'WWW-Authenticate'?: string
  /** Clickjacking protection: deny - no rendering within a frame, sameorigin - no rendering if origin mismatch, allow-from - allow fr */
  'X-Frame-Options'?: string
  'x-api-access-type'?: string
  'dav'?: string
  'etag'?: string
}

// TODO: rename this
export class ER extends Error {
  constructor(public reason: string, message: string) {
    super(message)
  }
}

export interface PathResolverResult {
  //the tree item returned from the path resolver
  item: Config.MountElement
  //the ancestors of the tree item for reference
  ancestry: Config.MountElement[]
  // client request url path
  reqpath: string[]
  // tree part of request url
  treepathPortion: string[]
  // file part of request url
  filepathPortion: string[]
  // item + filepath if item is a string
  fullfilepath: string
  // state: StateObject;
}

export type TreePathResultObject<T, U, V> = {
  item: T
  end: U
  folderPathFound: V
  /** The array of mount items in the path. Redundant, but easy to iterate quickly. */
  ancestry: T[]
}

export type TreePathResult =
  | TreePathResultObject<Config.GroupElement, number, false>
  | TreePathResultObject<Config.PathElement, number, true>

export type NormalizeTreeItem =
  | Schema.ArrayGroupElement
  | Schema.GroupElement
  | { $element: undefined }
  | Schema.ArrayPathElement
  | Schema.PathElement
  | string

export namespace Schema {
  function define(name: string, val: any) {}

  export type GroupChildElements =
    | Record<string, GroupElement | PathElement | string>
    | (ArrayGroupElement | ArrayPathElement | string)[]

  export type OptionElements = Config.OptionElements

  /** Host elements may only be specified in arrays */
  export interface HostElement {
    $element: 'host'
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
    $mount: GroupElement | PathElement | string
  }

  export interface GroupElement {
    $element: 'group'
    indexPath?: string
    $children: GroupChildElements
    $options?: OptionElements[]
  }
  export interface ArrayGroupElement extends GroupElement {
    key: string
  }

  export interface PathElement {
    $element: 'folder'
    /** Path relative to this file or any absolute path NodeJS can stat */
    path: string
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
    noTrailingSlash?: boolean
    noDataFolder?: boolean
    $options?: OptionElements[]
  }

  export interface ArrayPathElement extends PathElement {
    key: string
  }
}

type ExcludedPartial<T, NK> = {
  [P in keyof T]?: (P extends NK ? never : T[P]) | undefined
}

export interface ServerConfigSchema {
  /** enables certain expensive per-request checks */
  _devmode?: boolean
  /**
   * The tiddlywiki folder to use for data folder instances. Defaults to the
   * tiddlywiki folder in the TiddlyServer installation regardless of the
   * settings.json location.
   */
  _datafoldertarget?: string
  /**
   * The tree property accepts one of 3 formats. If it is a string ending in `.xml`, `.js`, or `.json`,
   * the tree will be loaded from the specified path. JS and JSON files must export a `tree` property
   * and XML files must specify a `tree` element as root.
   *
   * - A path element (or a string specifying the path) to mount a path as root (a single file is possible but pointless)
   * - A group element or the children of a group element (which is either an array, or an object with no $element property)
   */
  tree: any
  /** bind address and port info */
  bindInfo?: Partial<
    ServerConfig_BindInfo & {
      /**
       * https-only options: a string to a JavaScript file which exports a function of type
       * `(iface:string) => https.ServerOptions`. Note that the initServer function will
       * change this to a boolean value indicating whether https is in use once inside TiddlyServer.
       */
      https?: string
    }
  >
  /** logging  */
  logging?: Partial<ServerConfig_Logging>
  /** directory index options */
  directoryIndex?: ExcludedPartial<ServerConfig_DirectoryIndex, 'types'>
  /** tiddlyserver specific options */
  putsaver?: Partial<ServerConfig_PutSaver>
  /**
   * Options object whose properties will be passed to the tiddlywiki server instance using the spread operator.
   * If a property specifies an object instead of a string, the object will be shared between all instances.
   */
  datafolder?: Record<string, any>
  /**
   * The Hashmap of accounts which may authenticate on this server.
   * Takes either an object or a string to a `require`-able file (such as .js or .json)
   * which exports the object
   */
  authAccounts?: { [K: string]: ServerConfig_AuthAccountsValue }
  // /** client-side data folder loader which loads datafolders directly into the browser */
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
  $schema: string
}

export interface ServerConfig {
  /** enables certain expensive per-request checks */
  _devmode: boolean
  /** the tiddlywiki folder to use for data folder instances */
  _datafoldertarget: string
  tree: Config.HostElement[]
  /** bind address and port */
  bindInfo: ServerConfig_BindInfo & {
    https: boolean
  }
  /** logging  */
  logging: ServerConfig_Logging
  /** directory index */
  directoryIndex: ServerConfig_DirectoryIndex
  /** PUT saver options */
  putsaver: ServerConfig_PutSaver
  /** Variables passed directly to TiddlyWiki server instance */
  datafolder: Record<string, unknown>
  /**
   * The Hashmap of accounts which may authenticate on this server.
   * Takes either an object or a string to a `require`-able file (such as .js or .json)
   * which exports the object
   */
  authAccounts: { [K: string]: ServerConfig_AuthAccountsValue }
  // /** client-side data folder loader which loads datafolders directly into the browser */
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
  $schema: string

  __dirname: string
  __filename: string
  __assetsDir: string
  __targetTW: string
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
      publicKey: string
      /**
       * String which will be added to the cookie by the server.
       * Changing it will invalidate all current cookies for this user,
       * which requires them to login again on each device.
       * `node -e "console.log(Date.now())"` will print the current timestamp,
       * which you can use to make sure you get one that you've never used it before.
       */
      cookieSalt: string
    }
  } // Record<string, [string, string]>,
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
  websockets: boolean
  /**
   * login attempts for a public/private key pair which has not been
   * registered will be logged at debug level 2 with the full public key
   * which can be copied into an authAccounts entry.
   */
  registerNotice: boolean
  /** link to the login page when returning auth errors */
  loginlink: boolean
  /** Allows two clients to communicate through the server */
  transfer: boolean
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
  bindAddress: string[]
  /**
   * IPv4 addresses may include a subnet mask,
   * (e.g. `/24`) which matches any IP address in that range. Prefix with a minus sign (-)
   * to block requests incoming to that IP address or range.
   */
  filterBindAddress: boolean
  /**
   * Bind to the wildcard addresses `0.0.0.0` and `::` (if enabled) in that order.
   * The default is `true`. In many cases this is preferred, however
   * Android does not support this for some reason. On Android, set this to
   * `false` and set host to `["0.0.0.0/0"]` to bind to all IPv4 addresses.
   */
  bindWildcard: true | false
  /**
   * Bind to the IPv6 wildcard as well if `bindWilcard` is true and allow requests
   * incoming to IPv6 addresses if not explicitly denied.
   */
  enableIPv6: boolean
  /** port to listen on, default is 8080 for http and 8443 for https */
  port: number

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
  _bindLocalhost: boolean
}

export interface ServerConfig_Logging {
  /** access log file */
  logAccess: string | false
  /** error log file */
  logError: string
  /** write the console color markers to file, useful if you read the logs by printing them to a terminal */
  logColorsToFile: boolean
  /** print access and error events to the console regardless of whether they are logged to a file */
  logToConsoleAlso: boolean
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
  debugLevel: number
}

export interface ServerConfig_DirectoryIndex {
  /** sort folder and files together rather than separated */
  mixFolders: boolean
  /** default format for the directory index */
  defaultType: 'html' | 'json'
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
  /** If false, disables the put saver globally */
  enabled: boolean
  /**
   * Backup folder to store backups in. Multiple folder paths can backup to the same folder if desired.
   */
  backupFolder: string
  /**
   * GZip backup file to save disk space. Good for larger wikis. Turn this off for experimental wikis that you often need to restore from a backup because of a bad line of code (I speak from experience).
   */
  gzipBackups: boolean
  /**
   * Reject an etag with a modified time that is different than the file on disk by this many seconds.
   * Sometimes sync or antivirus sofware will "touch" a file and update the modified time without changing anything.
   * Size difference will still cause the request to be rejected.
   */
  etagAge: number
  /**
   * Whether to use the etag field -- if not specified then it will check it if presented.
   * This does not affect the backup etagAge option, as the saving mechanism will still
   * send etags back to the browser, regardless of this option.
   */
  etag: 'required' | 'disabled' | 'optional'
}

export interface OptionsSchema {
  auth: Config.Options_Auth
  backups: Config.Options_Backups
  index: Config.Options_Index
}

/** Used by the StateObject to compile the final Options object for the request */
export interface OptionsConfig {
  auth: Required<Config.Options_Auth>
  putsaver: Required<Config.Options_Backups>
  index: Required<Config.Options_Index>
}

/** The options array schema is in `settings-2-1-tree-options.schema.json` */
export type OptionsArraySchema = OptionsSchema[keyof OptionsSchema][]
