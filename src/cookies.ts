import { SplitCookieWithUserName } from './types'
import {
  crypto_sign_verify_detached,
  from_base64,
  crypto_generichash,
  crypto_generichash_BYTES,
} from 'libsodium-wrappers'
import * as http from 'http'
import { ServerConfig } from './server-config'

const TIDDLY_SERVER_AUTH_COOKIE: string = 'TiddlyServerAuth'
const isoDateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/

export const checkCookieAuth = (request: http.IncomingMessage, settings: ServerConfig) => {
  if (!request.headers.cookie) return false
  const cookies: { [k: string]: string } = {}

  const requestCookie = request.headers.cookie as string
  requestCookie.split(';').forEach((cookie: string) => {
    const parts: string[] = cookie.split('=')
    if (!parts || !Array.isArray(parts) || parts.length < 2) return
    const userName = parts.shift()?.trim() || ''
    cookies[userName] = decodeURI(parts.join('='))
  })

  let auth = cookies[TIDDLY_SERVER_AUTH_COOKIE]
  if (!auth) return false
  let cookieData = parseAuthCookie(auth, true)
  // We have to make sure the suffix is truthy
  if (!cookieData || cookieData.length !== 6 || !cookieData[5]) return false
  return validateCookie(cookieData, false, settings)
}

export function lookupAccount(settings: ServerConfig, hash: string, username: string) {
  return Object.keys(settings.authAccounts).find(groupID => {
    let _key = from_base64(settings.authAccounts[groupID].clientKeys[username].publicKey)
    let _hash = crypto_generichash(crypto_generichash_BYTES, _key, undefined, 'base64')
    return hash === _hash
  })
}

export const validateCookie = (
  cookieData: SplitCookieWithUserName,
  logRegisterNotice: string | false,
  settings: ServerConfig
) => {
  const authCookieAge = settings?.authCookieAge || 0
  let [username, type, timestamp, hash, sig, suffix] = cookieData
  if (type !== 'key') return false
  const account = lookupAccount(settings, hash, username)
  if (!account) {
    if (logRegisterNotice) console.log(logRegisterNotice)
    return false
  }
  try {
    let { publicKey, cookieSalt } = settings.authAccounts[account].clientKeys[username]

    //don't check suffix unless it is provided, other code checks whether it is provided or not
    //check it after the signiture to prevent brute-force suffix checking
    const valid =
      crypto_sign_verify_detached(
        from_base64(sig),
        username + type + timestamp + hash,
        from_base64(publicKey)
      ) &&
      //suffix should undefined or valid, not an empty string
      //the calling code must determine whether the subject is needed
      (suffix === undefined || suffix === cookieSalt) &&
      isoDateRegex.test(timestamp) &&
      Date.now() - new Date(timestamp).valueOf() < authCookieAge * 1000
    return valid ? [account, username, cookieSalt] : false
  } catch (e) {
    return false
  }
}

/*
  [userName, 'key' | 'pw', date, publicKey, cookie, salt]
*/
export const parseAuthCookie = (cookie: string, suffix: boolean) => {
  let splitCookie = cookie.split('|')
  const length = splitCookie.length
  const expectLength = suffix ? 6 : 5
  if (length > expectLength) {
    // This is a workaround in case the username happens to contain a pipe
    // other code still checks the signature of the cookie, so it's all good
    const nameLength = splitCookie.length - expectLength - 1
    const name: string = splitCookie.slice(0, nameLength).join('|')
    const rest = splitCookie.slice(nameLength)
    return ([name, ...rest] as unknown) as SplitCookieWithUserName
  } else if (length === expectLength) {
    return (splitCookie as unknown) as SplitCookieWithUserName
  } else {
    return false
  }
}

export const getSetCookie = (name: string, value: string, secure: boolean, age: number) => {
  // let flags = ["Secure", "HttpOnly", "Max-Age=2592000", "SameSite=Strict"];
  let flags = {
    'Secure': secure,
    'HttpOnly': true,
    'Max-Age': age.toString(),
    'SameSite': 'Strict',
    'Path': '/',
  }

  return [
    name + '=' + value,
    ...Object.keys(flags)
      .filter(k => !!flags[k])
      .map(k => k + (typeof flags[k] === 'string' ? '=' + flags[k] : '')),
  ].join('; ')
}
