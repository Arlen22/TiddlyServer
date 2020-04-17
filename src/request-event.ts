import { appendFileSync } from 'fs'
import { IncomingMessage, ServerResponse } from 'http'
import { Writable } from 'stream'
import { format } from 'util'
import * as WebSocket from 'ws'
import { ServerConfig, parseHostList, testAddress } from './server'
import { checkCookieAuth } from './cookies'

export class RequestEvent {
  handled: boolean = false
  username: string = ''
  authAccountKey: string = ''
  localAddressPermissionsKey: string = ''
  treeHostIndex: number = 0
  debugOutput: Writable
  network: { iface: string; host: string | undefined; addr: string }
  client: WebSocket = undefined as any
  response: ServerResponse = undefined as any

  constructor(
    settings: ServerConfig,
    request: IncomingMessage,
    iface: string,
    type: 'client',
    response: WebSocket
  )
  constructor(
    settings: ServerConfig,
    request: IncomingMessage,
    iface: string,
    type: 'response',
    response: ServerResponse
  )
  constructor(
    public settings: ServerConfig,
    public request: IncomingMessage,
    iface: string,

    public type: 'client' | 'response',
    response: WebSocket | ServerResponse
  ) {
    let host = request.headers.host
    let addr = request.socket.localAddress
    this.network = { host, addr, iface }
    this.debugOutput = RequestEvent.MakeDebugOutput(settings)
    switch (type) {
      case 'client':
        this.client = response as WebSocket
        break
      case 'response':
        this.response = response as ServerResponse
        break
      default:
        throw new Error('Invalid response type')
    }
  }
  async requestHandlerHostLevelChecks<T extends RequestEvent>(
    preflighter?: (ev: RequestEvent) => Promise<RequestEvent>
  ): Promise<RequestEvent> {
    let ev = this
    //connections to the wrong IP address are already filtered out by the connection event listener on the server.
    //determine localAddressPermissions to be applied
    {
      let localAddress = ev.request.socket.localAddress
      let keys = Object.keys(ev.settings.bindInfo.localAddressPermissions)
      let isLocalhost = testAddress(localAddress, '127.0.0.1', 8)
      let matches = parseHostList(keys)(localAddress)
      if (isLocalhost) {
        ev.localAddressPermissionsKey = 'localhost'
      } else if (matches.lastMatch > -1) {
        ev.localAddressPermissionsKey = keys[matches.lastMatch]
      } else {
        ev.localAddressPermissionsKey = '*'
      }
    }
    // host header is currently not implemented, but could be implemented by the preflighter
    ev.treeHostIndex = 0
    // console.log(settings.bindInfo);
    let { registerNotice } = ev.settings.bindInfo.localAddressPermissions[
      ev.localAddressPermissionsKey
    ]
    let auth = checkCookieAuth(ev.request, ev.settings)
    if (auth) {
      ev.authAccountKey = auth[0]
      ev.username = auth[1]
    }

    //send the data to the preflighter
    let ev2 = await (preflighter ? preflighter(ev) : Promise.resolve(ev))

    if (ev2.handled) return ev2 as any //cancel early if it is handled
    //sanity checks after the preflighter
    // "always check all variables and sometimes check some constants too"
    //@ts-ignore
    if (!ev.response !== !ev2.response || !ev.client !== !ev2.client)
      throw new Error('DEV: Request Event types got mixed up')
    if (ev2.treeHostIndex > ev2.settings.tree.length - 1)
      throw format(
        'treeHostIndex of %s is not within array length of %s',
        ev2.treeHostIndex,
        ev2.settings.tree.length
      )
    if (!ev2.settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey])
      throw format(
        'localAddressPermissions key of %s does not exist',
        ev2.localAddressPermissionsKey
      )
    if (ev2.authAccountKey && !ev2.settings.authAccounts[ev2.authAccountKey])
      throw format('authAccounts key of %s does not exist', ev2.authAccountKey)

    // if (!ev2.debugOutput) ev2.debugOutput = MakeDebugOutput(ev2.settings);
    return ev2 as any
  }
  static MakeDebugOutput(settings: ServerConfig) {
    const colorsRegex = /\x1b\[[0-9]+m/gi
    const { logError, logColorsToFile, logToConsoleAlso } = settings.logging
    return new Writable({
      write: function(chunk, encoding, callback) {
        // if we're given a buffer, convert it to a string
        if (Buffer.isBuffer(chunk)) chunk = chunk.toString('utf8')
        // remove ending linebreaks for consistency
        chunk = chunk.slice(0, chunk.length - (chunk.endsWith('\r\n') ? 2 : +chunk.endsWith('\n')))

        if (logError) {
          appendFileSync(
            logError,
            (logColorsToFile ? chunk : chunk.replace(colorsRegex, '')) + '\r\n',
            { encoding: 'utf8' }
          )
        }
        if (!logError || logToConsoleAlso) {
          console.log(chunk)
        }
        callback && callback()
        return true
      },
    })
  }
}
