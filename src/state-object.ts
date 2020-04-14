import * as http from 'http'
import * as send from 'send'
// import { url } from "inspector";
import { Stream, Writable } from 'stream'
import * as url from 'url'
import { format } from 'util'
import { RequestEvent } from './request-event'
import { Config, OptionsConfig, ServerConfig, ServerConfig_AccessOptions } from './server-config'
import {
  colors,
  ER,
  isError,
  JsonError,
  padLeft,
  ServerEventEmitter,
  StandardResponseHeaders,
  StateObjectUrl,
  StatPathResult,
  tryParseJSON,
} from './server-types'
let DEBUGLEVEL = -1
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
)
export class StateObject<STATPATH = StatPathResult, T = any> {
  static parseURL(str: string): StateObjectUrl {
    let item = url.parse(str, true)
    let { path, pathname, query, search, href } = item
    return {
      path: path || '',
      pathname: pathname || '',
      query: query || '',
      search: search || '',
      href: href || '',
    }
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
      return this.settings.authAccounts[this.authAccountsKey].permissions
    } else {
      return this.settings.bindInfo.localAddressPermissions[this.hostLevelPermissionsKey]
    }
  }

  get hostRoot() {
    return this.settings.tree[this.treeHostIndex].$mount
  }

  // req: http.IncomingMessage;
  // res: http.ServerResponse;
  startTime: [number, number]
  timestamp: string

  body: string = ''
  json: any | undefined

  /** The StatPathResult if this request resolves to a path */
  //@ts-ignore Property has no initializer and is not definitely assigned in the constructor.
  statPath: STATPATH
  /** The tree ancestors in descending order, including the final folder element. */
  //@ts-ignore Property has no initializer and is not definitely assigned in the constructor.
  ancestry: Config.MountElement[]
  /** The tree ancestors options as they apply to this request */
  //@ts-ignore Property has no initializer and is not definitely assigned in the constructor.
  treeOptions: OptionsConfig

  url: StateObjectUrl

  path: string[]

  // maxid: number;

  // where: string;
  query: any
  // errorThrown: Error;

  restrict: any

  // expressNext: ((err?: any) => void) | false;

  pathOptions: {
    noTrailingSlash: boolean
    noDataFolder: boolean
  } = {
    noTrailingSlash: false,
    noDataFolder: false,
  }

  req: http.IncomingMessage
  res: http.ServerResponse

  responseHeaders: StandardResponseHeaders = {} as any
  responseSent: boolean = false
  private _req: http.IncomingMessage
  private _res: http.ServerResponse
  public hostLevelPermissionsKey: string
  public authAccountsKey: string
  /** The HostElement array index in settings.tree */
  public treeHostIndex: number
  public username: string
  public readonly settings: Readonly<ServerConfig>
  public debugOutput: Writable
  constructor(private eventer: ServerEventEmitter, ev2: RequestEvent) {
    this.req = this._req = ev2.request
    this.res = this._res = ev2.response
    this.hostLevelPermissionsKey = ev2.localAddressPermissionsKey
    this.authAccountsKey = ev2.authAccountKey
    this.treeHostIndex = ev2.treeHostIndex
    this.username = ev2.username
    this.settings = ev2.settings
    this.debugOutput = ev2.debugOutput || RequestEvent.MakeDebugOutput(ev2.settings)
    this.startTime = process.hrtime()

    //parse the url and store in state.
    this.url = StateObject.parseURL(this.req.url as string)
    //parse the path for future use
    this.path = (this.url.pathname as string).split('/')

    let t = new Date()
    this.timestamp = format(
      '%s-%s-%s %s:%s:%s',
      t.getFullYear(),
      padLeft(t.getMonth() + 1, '00'),
      padLeft(t.getDate(), '00'),
      padLeft(t.getHours(), '00'),
      padLeft(t.getMinutes(), '00'),
      padLeft(t.getSeconds(), '00')
    )
    const interval = setInterval(() => {
      this.log(-2, 'LONG RUNNING RESPONSE')
      this.log(-2, '%s %s ', this.req.method, this.req.url)
    }, 60000)
    this._res.on('finish', () => {
      clearInterval(interval)
      if (this.hasCriticalLogs) this.eventer.emit('stateError', this)
      else this.eventer.emit('stateDebug', this)
    })
  }
  // debug(str: string, ...args: any[]) {
  //     this.debugLog('[' +
  //         this.req.socket.remoteFamily + '-' + colors.FgMagenta +
  //         this.req.socket.remoteAddress + colors.Reset + '] ' +
  //         format.apply(null, arguments)
  //     );
  // }

  loglevel: number = DEBUGLEVEL
  doneMessage: string[] = []
  hasCriticalLogs: boolean = false
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
    if (level < this.loglevel) return this
    if (level > 1) {
      this.hasCriticalLogs = true
      debugger
    }
    this.doneMessage.push(format(template, ...args))
    return this
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
  throwError<T = StateObject>(statusCode: number, error: ER, headers?: StandardResponseHeaders) {
    return this.throwReason(statusCode, this.allow.writeErrors ? error : error.reason, headers)
  }
  throwReason<T = StateObject>(
    statusCode: number,
    reason: string | ER,
    headers?: StandardResponseHeaders
  ) {
    if (!this.responseSent) {
      if (typeof reason === 'string') {
        let res = this.respond(statusCode, reason, headers)
        if (statusCode !== 204) res.string(reason)
      } else {
        let res = this.respond(statusCode, reason.reason, headers)
        if (statusCode !== 204) res.string(reason.message)
      }
    }
    // return Observable.empty<T>();
  }
  throw<T = never>(statusCode: number, headers?: StandardResponseHeaders) {
    if (!this.responseSent) {
      if (headers) this.setHeaders(headers)
      this.respond(statusCode).empty()
    }
    // return Observable.empty<T>();
  }
  setHeader(key: keyof StandardResponseHeaders, val: string) {
    this.setHeaders({ [key]: val } as any)
  }
  setHeaders(headers: StandardResponseHeaders) {
    Object.assign(
      this.responseHeaders,
      headers,
      headers['Set-Cookie']
        ? {
            'Set-Cookie': (this.responseHeaders['Set-Cookie'] || []).concat(
              headers['Set-Cookie'] || []
            ),
          }
        : {}
    )
  }
  respond(code: number, message?: string, headers?: StandardResponseHeaders) {
    if (headers) this.setHeaders(headers)
    if (!message) message = http.STATUS_CODES[code]
    if (this.settings._devmode) {
      let stack = new Error().stack
      setTimeout(() => {
        if (!this.responseSent) this.debugOutput.write('Response not sent syncly\n ' + stack)
      }, 0)
    }
    var subthis = {
      json: (data: any) => {
        this.setHeader('Content-Type', 'application/json')
        subthis.string(JSON.stringify(data))
      },
      string: (data: string) => {
        subthis.buffer(Buffer.from(data, 'utf8'))
      },
      stream: (data: Stream) => {
        this._res.writeHead(code, message, this.responseHeaders as any)
        data.pipe(this._res)
        this.responseSent = true
      },
      buffer: (data: Buffer) => {
        this.setHeader('Content-Length', data.byteLength.toString())
        this._res.writeHead(code, message, this.responseHeaders as any)
        this._res.write(data)
        this._res.end()
        this.responseSent = true
      },
      empty: () => {
        this._res.writeHead(code, message, this.responseHeaders as any)
        this._res.end()
        this.responseSent = true
      },
    }
    return subthis
  }

  redirect(redirect: string) {
    this.respond(302, '', {
      Location: redirect,
    }).empty()
  }
  send(options: {
    root: string | undefined
    filepath: string
    error?: (err: any) => void
    directory?: (filepath: string) => void
    headers?: (filepath: string) => http.OutgoingHttpHeaders
  }) {
    const { filepath, root, error, directory, headers } = options
    const sender = send(this._req, filepath, { root })
    if (error) sender.on('error', error)
    if (directory) sender.on('directory', (res: http.ServerResponse, fp) => directory(fp))
    if (headers)
      sender.on('headers', (res: http.ServerResponse, fp) => {
        const hdrs = headers(fp)
        Object.keys(hdrs).forEach(e => {
          let item = hdrs[e]
          if (item) res.setHeader(e, item.toString())
        })
      })

    sender.pipe(this._res)
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
      let chunks: Buffer[] = []
      this._req.on('data', chunk => {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk))
        } else {
          chunks.push(chunk)
        }
      })
      this._req.on('end', () => {
        this.body = Buffer.concat(chunks).toString('utf8')

        if (this.body.length === 0 || !parseJSON) return resolve()

        let catchHandler =
          errorCB === true
            ? (e: JsonError) => {
                this.respond(400, '', {
                  'Content-Type': 'text/plain',
                }).string(e.errorPosition)
                //return undefined;
              }
            : errorCB

        this.json = catchHandler
          ? tryParseJSON<any>(this.body, catchHandler)
          : tryParseJSON(this.body)
        resolve()
      })
    })
  }
  static DebugLogger(prefix: string, ignoreLevel?: boolean): typeof DebugLog {
    //if(prefix.startsWith("V:")) return function(){};
    return function(
      this: { debugOutput: Writable; settings: ServerConfig },
      msgLevel: number,
      tempString: any,
      ...args: any[]
    ) {
      if (!ignoreLevel && this.settings.logging.debugLevel > msgLevel) return
      if (isError(args[0])) {
        let err = args[0]
        args = []
        if (err.stack) args.push(err.stack)
        else args.push('Error %s: %s', err.name, err.message)
      }
      let t = new Date()
      let date = format(
        '%s-%s-%s %s:%s:%s',
        t.getFullYear(),
        padLeft(t.getMonth() + 1, '00'),
        padLeft(t.getDate(), '00'),
        padLeft(t.getHours(), '00'),
        padLeft(t.getMinutes(), '00'),
        padLeft(t.getSeconds(), '00')
      )
      this.debugOutput.write(
        ' ' +
          (msgLevel >= 3 ? colors.BgRed + colors.FgWhite : colors.FgRed) +
          prefix +
          ' ' +
          colors.FgCyan +
          date +
          colors.Reset +
          ' ' +
          format
            .apply(null, [tempString, ...args])
            .split('\n')
            .map((e, i) => {
              if (i > 0) {
                return new Array(23 + prefix.length).join(' ') + e
              } else {
                return e
              }
            })
            .join('\n'),
        'utf8'
      )
    }
  }
  // private debugLog: typeof DebugLog = StateObject.DebugLogger("STATE  ");
}
