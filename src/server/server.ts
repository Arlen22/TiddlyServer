import { EventEmitter } from 'events'
import { promisify } from 'util'
import { gzip } from 'zlib'
import * as http from 'http'
import { IncomingMessage, ServerResponse } from 'http'
import * as https from 'https'
import { NetworkInterfaceInfo, networkInterfaces } from 'os'
import * as path from 'path'
import { inspect } from 'util'
import * as send from 'send'
import * as libsodium from 'libsodium-wrappers'
import * as fs from 'fs'
import * as WebSocket from 'ws'
import { handler as morgan } from '../logger'
import { checkServerConfig } from '../interface-checker'
import { RequestEvent } from '../request-event'
import {
  DebugLogger,
  RequestEventFn,
  ServerEventEmitter,
  ServerRouteHandlers,
  ServerOptionsByHost,
} from './types'
import { parseHostList, tryParseJSON, keys, canAcceptGzip } from './utils'
import { colors } from '../constants'
import { normalizeSettings } from './config'
import { ServerConfig, ServerConfigSchema } from './types'
import { StateObject } from '../state-object'
import { handleTiddlyServerRoute, init as initTiddlyServer } from '../tiddlyserver'
import { handleAdminRoute, handleAssetsRoute } from './route-handlers'

export { checkServerConfig }
const { Server: WebSocketServer } = WebSocket
const assets = path.resolve(__dirname, '../assets')

/*
 * Global settings
 */
Error.stackTraceLimit = Infinity
console.debug = function() {} //noop console debug;
export const eventer = new EventEmitter() as ServerEventEmitter
/* end Global settings */

initTiddlyServer(eventer)

eventer.on('settings', set => {
  if (checkServerConfig(set)[0] !== true) throw 'ServerConfig did not pass validator'
})

export const routes: ServerRouteHandlers = {
  'admin': state => handleAdminRoute(state),
  'assets': state => handleAssetsRoute(state),
  'favicon.ico': state => serveFile(state, 'favicon.ico', state.settings.__assetsDir),
  'directory.css': state => serveFile(state, 'directory.css', state.settings.__assetsDir),
}

export const libsReady = Promise.all([libsodium.ready])

/**
 * Creates the server(s) and starts listening. The settings object is emitted
 * on the eventer and addListeners is called to add the listeners to each
 * server before it is started.
 *
 * @export
 * @param {RequestEventFn} preflighter
 * @param {SecureServerOptions | ServerOptionsByHost | undefined} settingshttps
 * @param {boolean} dryRun initializes the server(s) w/o listening
 * @returns
 */
export const initServer = async ({
  settings,
  preflighter,
  settingshttps,
  dryRun,
}: {
  settings: ServerConfig
  preflighter: RequestEventFn
  settingshttps: ServerOptionsByHost | undefined
  dryRun: boolean
}) => {
  const debug = StateObject.DebugLogger('STARTER').bind({
    debugOutput: RequestEvent.MakeDebugOutput(settings),
    settings,
  })

  const hosts: string[] = []
  const {
    bindWildcard,
    enableIPv6,
    filterBindAddress,
    bindAddress,
    _bindLocalhost,
    port,
    https: isHttps,
  } = settings.bindInfo
  const tester = parseHostList([...settings.bindInfo.bindAddress, '-127.0.0.0/8'])
  const localhostTester = parseHostList(['127.0.0.0/8'])

  await libsodium.ready

  send.mime.define(settings.directoryIndex.mimetypes)

  //setup the logging handler
  let log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
  if (settings.logging.logAccess !== false) {
    const logger = morgan({
      logFile: settings.logging.logAccess || undefined,
      logToConsole: !settings.logging.logAccess || settings.logging.logToConsoleAlso,
      logColorsToFile: settings.logging.logColorsToFile,
    })
    log = (req, res) => new Promise(resolve => logger(req, res, resolve))
  } else {
    log = (_req, _res) => Promise.resolve()
  }

  if (bindWildcard) {
    //bind to everything and filter elsewhere if needed
    hosts.push('0.0.0.0')
    if (enableIPv6) hosts.push('::')
  } else if (filterBindAddress) {
    //bind to all interfaces that match the specified addresses
    let ifaces = networkInterfaces()
    let addresses = Object.keys(ifaces)
      .reduce((n, k) => n.concat(ifaces[k]), [] as NetworkInterfaceInfo[])
      .filter(e => enableIPv6 || (e.family === 'IPv4' && tester(e.address).usable))
      .map(e => e.address)
    hosts.push(...addresses)
  } else {
    //bind to all specified addresses
    hosts.push(...bindAddress)
  }
  if (_bindLocalhost) hosts.push('localhost')

  if (!hosts.length) {
    console.log(
      EmptyHostsWarning(bindWildcard, filterBindAddress, _bindLocalhost, enableIPv6, bindAddress)
    )
  }
  let servers: (http.Server | https.Server)[] = []
  console.log('Creating servers as %s', typeof settingshttps === 'function' ? 'https' : 'http')
  if (!settingshttps) console.log('Remember that any login credentials are being sent in the clear')

  let success = await setupHosts(
    hosts,
    settingshttps,
    preflighter,
    settings,
    log,
    bindWildcard,
    filterBindAddress,
    tester,
    localhostTester,
    servers,
    dryRun,
    port,
    debug
  )

  if (!success) return eventer

  eventer.emit('serverOpen', servers, hosts, !!settingshttps, dryRun)
  let ifaces = networkInterfaces()
  console.log('Open your browser and type in one of the following:')
  console.log(
    (bindWildcard
      ? keys(ifaces)
          .reduce((n: NetworkInterfaceInfo[], k) => n.concat(ifaces[k]), [])
          .filter(
            e =>
              (enableIPv6 && e.family === 'IPv6') ||
              (e.family === 'IPv4' && (!filterBindAddress || tester(e.address).usable))
          )
          .map(e => e.address)
      : hosts
    )
      .map(e => (isHttps ? 'https' : 'http') + '://' + e + ':' + port)
      .join('\n')
  )

  if (dryRun) console.log('DRY RUN: No further processing is likely to happen')
  return eventer
}

const setupHosts = async (
  hosts: string[],
  settingshttps: undefined | ((host: string) => https.ServerOptions),
  preflighter: <T extends RequestEvent>(ev: T) => Promise<T>,
  settings: ServerConfig,
  log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>,
  bindWildcard: boolean,
  filterBindAddress: boolean,
  tester: (addr: string) => { usable: boolean; lastMatch: number },
  localhostTester: (addr: string) => { usable: boolean; lastMatch: number },
  servers: (http.Server | https.Server)[],
  dryRun: boolean,
  port: number,
  debug: any
) => {
  return Promise.all<void>(
    hosts.map(host => {
      let server: any
      if (typeof settingshttps === 'function') {
        try {
          server = https.createServer(settingshttps(host))
        } catch (e) {
          console.log('settingshttps function threw for host ' + host)
          console.log(e)
          throw e
        }
      } else {
        server = http.createServer()
      }
      addRequestHandlers(server, host, preflighter, settings, log, debug)
      //this one we add here because it is related to the host property rather than just listening
      if (bindWildcard && filterBindAddress) {
        server.on('connection', socket => {
          if (!tester(socket.localAddress).usable && !localhostTester(socket.localAddress).usable)
            socket.end()
        })
      }
      servers.push(server)
      return new Promise(resolve => {
        dryRun
          ? resolve()
          : server.listen(port, host, undefined, () => {
              resolve()
            })
      })
    })
  ).catch(x => {
    console.log('Error thrown while starting server')
    console.log(x)
    return false
  })
}

const EmptyHostsWarning = (
  bindWildcard: boolean,
  filterBindAddress: boolean,
  _bindLocalhost: boolean,
  enableIPv6: boolean,
  bindAddress: string[]
): any => {
  return `"No IP addresses will be listened on. This is probably a mistake.
bindWildcard is ${bindWildcard ? 'true' : 'false'}
filterBindAddress is ${filterBindAddress ? 'true' : 'false'}
_bindLocalhost is ${_bindLocalhost ? 'true' : 'false'}
enableIPv6 is ${enableIPv6 ? 'true' : 'false'}
bindAddress is ${JSON.stringify(bindAddress, null, 2)}
`
}

/**
 * Adds all the listeners required for tiddlyserver to operate.
 *
 * @export
 * @param {(https.Server | http.Server)} server The server instance to initialize
 * @param {string} iface A marker string which is only used for certain debug messages and
 * is passed into the preflighter as `ev.iface`.
 * @param {*} preflighter A preflighter function which may modify data about the request before
 * it is handed off to the router for processing.
 */
export const addRequestHandlers = (
  server: https.Server | http.Server,
  iface: string,
  preflighter: RequestEventFn,
  settings: ServerConfig,
  log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>,
  debug: DebugLogger
) => {
  let closing = false

  server.on('request', (req, res) => {
    requestHandler(req, res, iface, preflighter, log, settings).catch(err => {
      //catches any errors that happen inside the then statements
      debug(3, 'Uncaught error in the request handler: ' + (err.message || err.toString()))
      if (err.stack) debug(3, err.stack)
    })
  })

  server.on('listening', () => {
    debug(1, 'server %s listening', iface)
  })

  server.on('error', err => {
    debug(4, 'server %s error: %s', iface, err.message)
    debug(4, 'server %s stack: %s', iface, err.stack)
    server.close()
    eventer.emit('serverClose', iface)
  })

  server.on('close', () => {
    if (!closing) eventer.emit('serverClose', iface)
    debug(4, 'server %s closed', iface)
    closing = true
  })

  const wss = new WebSocketServer({ server })
  wss.on('connection', (client, request) =>
    websocketHandler(client, request, iface, settings, preflighter)
  )
  wss.on('error', error => {
    debug(-2, 'WS-ERROR %s', inspect(error))
  })
}

const websocketHandler = async (
  client: WebSocket,
  request: http.IncomingMessage,
  iface: string,
  settings: ServerConfig,
  preflighter: (ev: RequestEvent) => Promise<RequestEvent>
) => {
  //check host level permissions and the preflighter
  let ev = new RequestEvent(settings, request, iface, 'client', client)

  let ev2 = await ev.requestHandlerHostLevelChecks(preflighter)

  if (ev2.handled) return

  //this should also be checking the username and permissions but currently it doesn't
  if (!settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey].websockets)
    client.close()
  else eventer.emit('websocket-connection', ev)
}

const requestHandler = async (
  request: IncomingMessage,
  response: ServerResponse,
  iface: string,
  preflighter: undefined | RequestEventFn,
  log: { (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> },
  settings: ServerConfig
) => {
  await log(request, response)

  let ev1 = new RequestEvent(settings, request, iface, 'response', response)

  //send it to the preflighter
  let ev2 = await ev1.requestHandlerHostLevelChecks(preflighter)
  // check if the preflighter handled it
  if (ev2.handled) return
  //create the state object
  const state = new StateObject(eventer, ev2)
  //check for static routes
  const route = routes[state.path[1]]
  //if so, handle it
  if (route) route(state)
  //otherwise forward to TiddlyServer
  else handleTiddlyServerRoute(state)
}

eventer.on('stateError', state => {
  if (state.doneMessage.length > 0)
    StateObject.DebugLogger('STA-ERR').call(state, 2, state.doneMessage.join('\n'))
  debugger
})

eventer.on('stateDebug', state => {
  if (state.doneMessage.length > 0)
    StateObject.DebugLogger('STA-DBG').call(state, -2, state.doneMessage.join('\n'))
})

export const loadSettings = (settingsFile: string, routeKeys: string[]) => {
  console.log('Settings file: %s', settingsFile)

  const settingsString = fs
    .readFileSync(settingsFile, 'utf8')
    .replace(/\t/gi, '    ')
    .replace(/\r\n/gi, '\n')

  let settingsObjSource: ServerConfigSchema | undefined = tryParseJSON<ServerConfigSchema>(
    settingsString,
    e => {
      console.error(
        colors.FgRed + 'The settings file could not be parsed: %s' + colors.Reset,
        e.originalError.message
      )
      console.error(e.errorPosition)
      throw 'The settings file could not be parsed: Invalid JSON'
    }
  )

  if (!settingsObjSource) throw 'Settings file not found'

  if (!settingsObjSource.$schema)
    throw 'The settings file needs to be upgraded to v2.1, please run > node upgrade-settings.js old new'

  if (!settingsObjSource.tree) throw 'tree is not specified in the settings file'
  let settingshttps = settingsObjSource.bindInfo && settingsObjSource.bindInfo.https
  let settingsObj = normalizeSettings(settingsObjSource, settingsFile)

  settingsObj.__assetsDir = assets
  try {
    settingsObj.__targetTW = settingsObj._datafoldertarget
      ? path.resolve(settingsObj.__dirname, settingsObj._datafoldertarget)
      : path.join(require.resolve('tiddlywiki-production/boot/boot.js'), '../..')
  } catch (e) {
    console.log(e)
    throw 'Could not resolve a tiddlywiki installation directory. Please specify a valid _datafoldertarget or make sure tiddlywiki is in an accessible node_modules folder'
  }

  if (typeof settingsObj.tree === 'object') {
    let keys: string[] = []
    let conflict = keys.filter(k => routeKeys.indexOf(k) > -1)
    if (conflict.length)
      console.log(
        'The following tree items are reserved for use by TiddlyServer: %s',
        conflict.map(e => `"${e}"`).join(', ')
      )
  }
  //remove the https settings and return them separately
  return { settings: settingsObj, settingshttps }
}

export const serveFile = async (state: StateObject, file: string, root: string | undefined) => {
  promisify(fs.stat)(root ? path.join(root, file) : file).then(
    (): any => {
      state.send({
        root,
        filepath: file,
        error: err => {
          state.log(2, '%s %s', err.status, err.message).throw(500)
        },
      })
    },
    _err => {
      state.throw<StateObject>(404)
    }
  )
}

export const serveFolder = (
  state: StateObject,
  mount: string,
  root: string,
  serveIndex?: Function
) => {
  const pathname = state.url.pathname
  if (state.url.pathname.slice(0, mount.length) !== mount) {
    state.log(2, 'URL is different than the mount point %s', mount).throw(500)
  } else {
    state.send({
      root,
      filepath: pathname.slice(mount.length),
      error: err => {
        state.log(-1, '%s %s', err.status, err.message).throw(404)
      },
      directory: filepath => {
        if (serveIndex) {
          serveIndex(state, filepath)
        } else {
          state.throw(403)
        }
      },
    })
  }
}

export const sendResponse = (
  state: StateObject,
  body: Buffer | string,
  options: {
    doGzip?: boolean
    contentType?: string
  } = {}
) => {
  function _send(body: Buffer, isGzip: boolean) {
    state.setHeaders({
      'Content-Length': Buffer.isBuffer(body)
        ? body.length.toString()
        : Buffer.byteLength(body, 'utf8').toString(),
      'Content-Type': options.contentType || 'text/plain; charset=utf-8',
    })
    if (isGzip) state.setHeaders({ 'Content-Encoding': 'gzip' })
    state.respond(200).buffer(body)
  }

  body = !Buffer.isBuffer(body) ? Buffer.from(body, 'utf8') : body
  if (options.doGzip) {
    gzip(body, (err, gzBody) => {
      // @ts-ignore
      if (err) _send(body, false)
      else _send(gzBody, true)
    })
  } else _send(body, false)
}
