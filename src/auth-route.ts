import { serveFile } from './server'
import { getSetCookie, validateCookie, parseAuthCookie } from './cookies'
import {
  crypto_generichash as cryptoGenericHash,
  randombytes_buf as randomBytesBuffer,
  ready as libSodiumReady,
  to_hex as toHex,
} from 'libsodium-wrappers'
import * as path from 'path'
import { StateObject } from './state-object'
import { TIDDLY_SERVER_AUTH_COOKIE } from './constants'
import { HttpResponse, LoginRequestBody, Header } from './types'

interface PkoVals {
  step: number
  cancelTimeout: NodeJS.Timer
  sender?: StateObject
  receiver?: StateObject
}

const pko: Record<string, PkoVals> = {}
const TenMinutes: number = 10 * 60 * 1000

const removePendingPinTimeout = (pin: string): NodeJS.Timeout => {
  return setTimeout(() => {
    delete pko[pin]
  }, TenMinutes)
}

export const handleTransfer = (state: StateObject): void => {
  if (!state.allow.transfer) return state.throwReason(HttpResponse.Forbidden, 'Access Denied')

  let [, , , , pin, senderOrReceiver] = state.path

  if (!pin || !pko[pin] || (senderOrReceiver !== 'sender' && senderOrReceiver !== 'receiver')) {
    return state.throwReason(HttpResponse.BadRequest, 'Invalid request parameters')
  }

  let direction: 'sender' | 'receiver' = senderOrReceiver
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

type ExpectedKeys = (string | number | symbol)[]
const expectKeys = <T extends unknown>(obj: any, keys: ExpectedKeys): obj is T => {
  return (
    keys.every(key => Object.prototype.hasOwnProperty.call(obj, key)) &&
    Object.keys(obj).every(key => keys.indexOf(key) > -1)
  )
}

export const handleHEADorGETFileServe = (state: StateObject): void => {
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

export const handleLogin = async (state: StateObject): Promise<void> => {
  await state.recieveBody(true, true)
  const { body, json, settings, hostLevelPermissionsKey } = state

  if (body.length && !json) return // receive body sent a response already

  if (!body.length) {
    return state.throwReason(HttpResponse.BadRequest, 'Empty request body')
  }

  if (!expectKeys<LoginRequestBody>(json, ['setCookie', 'publicKey']) || !json) {
    return state.throwReason(HttpResponse.BadRequest, 'Improper request body')
  }

  const cookieData = parseAuthCookie(json.setCookie, false)
  if (!cookieData) return state.throwReason(HttpResponse.BadRequest, 'Bad cookie format')

  const [userName, , timestamp, , , salt] = cookieData
  if (!cookieData || salt) {
    return state.throwReason(HttpResponse.BadRequest, 'Bad cookie format')
  }

  const { registerNotice } = settings.bindInfo.localAddressPermissions[hostLevelPermissionsKey]
  const logString =
    registerNotice &&
    `login attempted with unknown public key
    ${json.publicKey}
    username: ${userName}
    timestamp: ${timestamp}`

  const valid = validateCookie(cookieData, logString, settings)
  if (!valid) return state.throwReason(HttpResponse.BadRequest, 'INVALID_CREDENTIALS')

  state.setHeader(
    Header.SetCookie,
    getSetCookie(
      TIDDLY_SERVER_AUTH_COOKIE,
      `${json.setCookie}|${valid[2]}`,
      false,
      settings.authCookieAge
    )
  )
  state.respond(HttpResponse.Ok).empty()
}

const getRandomPin = async (): Promise<string> => {
  await libSodiumReady
  let randomPin = randomBytesBuffer(8)
  let pin = ''
  while (!pin || pko[pin]) {
    pin = toHex((randomPin = cryptoGenericHash(8, randomPin, undefined, 'uint8array')))
  }
  pko[pin] = { step: 1, cancelTimeout: removePendingPinTimeout(pin) }
  return pin
}

export const handleInitPin = (state: StateObject): void => {
  const { allow, settings } = state
  if (!allow.transfer) {
    state.throwReason(HttpResponse.Forbidden, 'Access Denied')
  } else if (Object.keys(pko).length > settings.maxTransferRequests) {
    state.throwReason(HttpResponse.TooManyRequests, 'Too many transfer requests in progress')
  } else {
    state.respond(HttpResponse.Ok).json({ initPin: getRandomPin() })
  }
  return
}

const sharedKeyList: Record<string, string> = {}
const setSharedKey = async (key: string): Promise<string> => {
  const pin = await getRandomPin()
  if (!sharedKeyList[key]) sharedKeyList[key] = pin
  return sharedKeyList[key]
}

export const handleInitShared = (state: StateObject): void => {
  const { allow, path } = state
  if (!allow.transfer) {
    state.throwReason(HttpResponse.Forbidden, 'Access Denied')
  } else if (Object.keys(pko).length > 1000) {
    state.throwReason(HttpResponse.TooManyRequests, 'Too many transfer requests in progress')
  } else {
    state.respond(HttpResponse.Ok).json({ initPin: setSharedKey(path[4]) })
  }
  return
}

export const handleLogout = (state: StateObject): void => {
  state.setHeader(Header.SetCookie, getSetCookie(TIDDLY_SERVER_AUTH_COOKIE, '', false, 0))
  state.respond(HttpResponse.Ok).empty()
  return
}
