import { serveFile } from './server'
import { getSetCookie, validateCookie, parseAuthCookie } from './cookies'
import { crypto_generichash, randombytes_buf, ready, to_hex } from 'libsodium-wrappers'
import * as path from 'path'
import { StateObject } from './state-object'
import { TIDDLY_SERVER_AUTH_COOKIE } from './constants'
import { HttpResponse } from 'types'

interface PkoVals {
  step: number
  cancelTimeout: NodeJS.Timer
  sender?: StateObject
  receiver?: StateObject
}

const pko: Record<string, PkoVals> = {}
const SixHundredSeconds: number = 10 * 60 * 1000

const removePendingPinTimeout = (pin: string) => {
  return setTimeout(() => {
    delete pko[pin]
  }, SixHundredSeconds)
}

export const handleTransfer = (state: StateObject) => {
  if (!state.allow.transfer) return state.throwReason(HttpResponse.Forbidden, 'Access Denied')
  let pin = state.path[4]
  if (!state.path[4] || !pko[pin] || (state.path[5] !== 'sender' && state.path[5] !== 'receiver'))
    return state.throwReason(HttpResponse.BadRequest, 'Invalid request parameters')
  let direction: 'sender' | 'receiver' = state.path[5] as any
  let pkop = pko[pin]
  pkop[direction] = state
  if (!pkop.sender || !pkop.receiver) return
  clearTimeout(pkop.cancelTimeout)
  pkop.step += 1
  pkop.sender.res.writeHead(HttpResponse.Ok, undefined, {
    'x-tiddlyserver-transfer-count': pkop.step,
    'content-type': pkop.receiver.req.headers['content-type'],
    'content-length': pkop.receiver.req.headers['content-length'],
  })
  pkop.receiver.req.pipe(pkop.sender.res)
  pkop.receiver.res.writeHead(HttpResponse.Ok, undefined, {
    'x-tiddlyserver-transfer-count': pkop.step,
    'content-type': pkop.sender.req.headers['content-type'],
    'content-length': pkop.sender.req.headers['content-length'],
  })
  pkop.sender.req.pipe(pkop.receiver.res)
  pkop.cancelTimeout = removePendingPinTimeout(pin)
  pkop.receiver = undefined
  pkop.sender = undefined
}

const expect = function<T>(a: any, keys: (string | number | symbol)[]): a is T {
  return (
    keys.every(k => Object.prototype.hasOwnProperty.call(a, k)) &&
    Object.keys(a).every(k => keys.indexOf(k) !== -1)
  )
}

export const handleHEADorGETFileServe = (state: StateObject) => {
  const pathLength = state.path.length
  if (pathLength === 4 && state.path[3] === 'login.html') {
    serveFile(state, 'login.html', path.join(state.settings.__assetsDir, 'authenticate'))
  } else if (pathLength === 4 && state.path[3] === 'transfer.html') {
    serveFile(state, 'transfer.html', path.join(state.settings.__assetsDir, 'authenticate'))
  } else {
    state.throw(HttpResponse.NotFound)
  }
  return
}

export const handleLogin = async (state: StateObject) => {
  await state.recieveBody(true, true)
  if (state.body.length && !state.json) return // receive body sent a response already
  if (!state.body.length) {
    return state.throwReason(HttpResponse.BadRequest, 'Empty request body')
  }
  if (!expect<{ setCookie: string; publicKey: string }>(state.json, ['setCookie', 'publicKey'])) {
    return state.throwReason(HttpResponse.BadRequest, 'Improper request body')
  }
  let cookieData = parseAuthCookie(state.json.setCookie, false)
  if (!cookieData) return state.throwReason(HttpResponse.BadRequest, 'Bad cookie format')

  const [userName, , timestamp, , , salt] = cookieData

  if (!cookieData || !salt) {
    return state.throwReason(HttpResponse.BadRequest, 'Bad cookie format')
  }
  let { registerNotice } = state.settings.bindInfo.localAddressPermissions[
    state.hostLevelPermissionsKey
  ]
  if (!state?.json) return state.throwReason(HttpResponse.BadRequest, 'Improper request body')
  let valid = validateCookie(
    cookieData,
    registerNotice &&
      [
        '    login attempted with unknown public key',
        '    ' + state.json.publicKey,
        '    username: ' + userName,
        '    timestamp: ' + timestamp,
      ].join('\n'),
    state.settings
  )
  if (valid) {
    state.setHeader(
      'Set-Cookie',
      getSetCookie(
        TIDDLY_SERVER_AUTH_COOKIE,
        state.json.setCookie + '|' + valid[2],
        false,
        state.settings.authCookieAge
      )
    )
    state.respond(HttpResponse.Ok).empty()
  } else {
    state.throwReason(HttpResponse.BadRequest, 'INVALID_CREDENTIALS')
  }
}

const getRandomPin = async (): Promise<string> => {
  // Wait for libsodium.ready
  await ready
  let randomPin = randombytes_buf(8)
  let pin = ''
  while (!pin || pko[pin]) {
    pin = to_hex((randomPin = crypto_generichash(8, randomPin, undefined, 'uint8array')))
  }
  pko[pin] = { step: 1, cancelTimeout: removePendingPinTimeout(pin) }
  return pin
}

export const handleInitPin = (state: StateObject) => {
  if (!state.allow.transfer) {
    state.throwReason(HttpResponse.Forbidden, 'Access Denied')
  } else if (Object.keys(pko).length > state.settings.maxTransferRequests) {
    state.throwReason(HttpResponse.TooManyRequests, 'Too many transfer requests in progress')
  } else {
    state.respond(HttpResponse.Ok).json({ initPin: getRandomPin() })
  }
  return
}

let sharedKeyList: Record<string, string> = {}
const setSharedKey = async (key: string) => {
  const pin = await getRandomPin()
  if (!sharedKeyList[key]) sharedKeyList[key] = pin
  return sharedKeyList[key]
}

export const handleInitShared = (state: StateObject) => {
  if (!state.allow.transfer) {
    state.throwReason(HttpResponse.Forbidden, 'Access Denied')
  } else if (Object.keys(pko).length > 1000) {
    state.throwReason(HttpResponse.TooManyRequests, 'Too many transfer requests in progress')
  } else {
    state.respond(HttpResponse.Ok).json({ initPin: setSharedKey(state.path[4]) })
  }
  return
}

export const handleLogout = (state: StateObject) => {
  state.setHeader('Set-Cookie', getSetCookie(TIDDLY_SERVER_AUTH_COOKIE, '', false, 0))
  state.respond(HttpResponse.Ok).empty()
  return
}
