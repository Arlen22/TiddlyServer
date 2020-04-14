import * as fs from 'fs'
import { RequestEvent } from './request-event'
import { EventEmitter } from 'events'
import { ServerConfig, Config } from './server-config'

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
  on: ServerEventsListener<this> //(event: keyof ServerEvents, listener: Function): this;
  once: ServerEventsListener<this> //(event: keyof ServerEvents, listener: Function): this;
  prependListener: ServerEventsListener<this> //(event: keyof ServerEvents, listener: Function): this;
  prependOnceListener: ServerEventsListener<this> //(event: keyof ServerEvents, listener: Function): this;
  removeListener: ServerEventsListener<this> //(event: keyof ServerEvents, listener: Function): this;
  removeAllListeners(event?: ServerEvents): this
  setMaxListeners(n: number): this
  getMaxListeners(): number
  listeners(event: ServerEvents): Function[]
  eventNames(): ServerEvents[]
  listenerCount(type: ServerEvents): number
}

export type Hashmap<T> = { [K: string]: T }

export type FolderEntryType = 'folder' | 'datafolder' | 'htmlfile' | 'other' | 'error'

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

export interface JsonErrorContainer {
  error?: JsonError
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

export interface ServeStaticResult {
  status: number
  headers: {}
  message: string
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

export class StateError extends Error {
  state: StateObject
  constructor(state: StateObject, message: string) {
    super(message)
    this.state = state
  }
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

export class URLSearchParams {
  constructor(_str: string) {}
}

export interface StateObjectUrl {
  path: string
  pathname: string
  query: Hashmap<string[] | string | undefined>
  search: string
  href: string
}
type StandardResponseHeaderValue = number | string | string[] | undefined
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

import { StateObject } from './state-object'

export class ER extends Error {
  constructor(public reason: string, message: string) {
    super(message)
  }
}
export interface ThrowFunc {
  throw: (statusCode: number, reason?: string, str?: string, ...args: any[]) => never
}

export interface AccessPathResult<T> {
  isFullpath: boolean
  type: string | NodeJS.ErrnoException
  tag: T
  end: number
  statItem: fs.Stats
  statTW?: fs.Stats
}

export interface AccessPathTag {
  state: StateObject
  item: string | {}
  treepath: string
  filepath: string
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

export type TreeObject = { [K: string]: string | TreeObject }

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
