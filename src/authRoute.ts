import { StateObject, ServerEventEmitter, ServerConfig, serveFile } from "./server-types";
import * as libsodium from 'libsodium-wrappers';
import * as http from "http";
import * as path from "path";
import { ThreeStringArray, AuthCookie, AuthCookieSet } from './types'

const TIDDLY_SERVER_AUTH: string = 'TiddlyServerAuth';

/** [type, username, timestamp, hash, sig] */
export let checkCookieAuth: (request: http.IncomingMessage, logRegisterNotice: boolean) => ReturnType<typeof validateCookie>;
/** if the cookie is valid it returns the username, otherwise an empty string. If the public key cannot be found, it will call logRegisterNotice then return an empty string */
export let validateCookie: (json: AuthCookie | AuthCookieSet, logRegisterNotice?: (string | false)) => ThreeStringArray | false;

export function parseAuthCookie(cookie: string, suffix: boolean): AuthCookie | AuthCookieSet {
  let json: [string, "pw" | "key", string, string, string, string] = cookie.split("|") as any; //tryParseJSON<>(auth);
  if (json.length > (suffix ? 6 : 5)) {
    let name = json.slice(0, json.length - 4);
    let rest = json.slice(json.length - 4);
    json = [name.join("|"), ...rest] as any;
  }
  return json;
}
const setAuth = (settings: ServerConfig) => {
  /** Record<hash+username, [authGroup, publicKey, suffix]> */
  let publicKeyLookup: Record<string, ThreeStringArray> = {};

  const authCookieAge = settings.authCookieAge;
  const {
    crypto_generichash,
    crypto_generichash_BYTES,
    crypto_sign_verify_detached,
    from_base64,
  } = libsodium;

  Object.keys(settings.authAccounts).forEach(k => {
    let e = settings.authAccounts[k];
    if (e.clientKeys) Object.keys(e.clientKeys).forEach(u => {
      const publicKey = from_base64(e.clientKeys[u].publicKey);
      let publicHash = crypto_generichash(crypto_generichash_BYTES, publicKey, undefined, "base64");
      if (!publicKeyLookup[publicHash + u]) publicKeyLookup[publicHash + u] = [k, e.clientKeys[u].publicKey, e.clientKeys[u].cookieSalt];
      else throw "publicKey+username combination is used for more than one authAccount";
    });
  });

  checkCookieAuth = (request: http.IncomingMessage, logRegisterNotice: boolean) => {
    if (!request.headers.cookie) return false;
    let cookies = {}, rc = request.headers.cookie as string;
    rc.split(';').forEach(function(cookie) {
      let parts = cookie.split('=');
      cookies[(parts.shift() as string).trim()] = parts.length ? decodeURI(parts.join('=')) : "";
    });
    let auth = cookies[TIDDLY_SERVER_AUTH] as string;
    if (!auth) return false;
    let json = parseAuthCookie(auth, true);
    //we have to make sure the suffix is truthy
    if (!json || json.length !== 6 || !json[5]) return false;
    return validateCookie(json, false);
  };
  const isoreg = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
  validateCookie = (json: AuthCookie | AuthCookieSet, logRegisterNotice?: string | false) => {
    let [username, type, timestamp, hash, sig, suffix] = json;
    if (type === "key" && !publicKeyLookup[hash + username]) {
      if (logRegisterNotice) console.log(logRegisterNotice);
      return false;
    }
    // console.log(username + timestamp + hash);
    if (type === "pw") return false; //passwords are currently not implemented
    let pubkey = publicKeyLookup[hash + username];
    //don't check suffix unless it is provided, other code checks whether it is provided or not
    //check it after the signiture to prevent brute-force suffix checking
    let valid = crypto_sign_verify_detached(
      from_base64(sig),
      username + timestamp + hash,
      from_base64(pubkey[1])
    )
      //json.length should be 5 if there is no suffix, don't ignore falsy suffix
      //the calling code must determine whether the subject is needed
      && (json.length === 5 || suffix === pubkey[2])
      && isoreg.test(timestamp)
      && (Date.now() - new Date(timestamp).valueOf() < authCookieAge * 1000);
    // console.log((valid ? "" : "in") + "valid signature")
    return valid ? [pubkey[0], username, pubkey[2]] : false;
  };

}
const expect = function <T>(a: any, keys: (string | number | symbol)[]): a is T {
  return keys.every(k => Object.prototype.hasOwnProperty.call(a, k))
    && Object.keys(a).every(k => keys.indexOf(k) !== -1);
}
export function initAuthRoute(eventer: ServerEventEmitter) {
  // eventer.on("websocket-connection", (client, request) => {
  // 	if (request.url === "/admin/authenticate") {
  // 		sockets.push(client);
  // 		client.on("message", handleSocketMessage);
  // 	}
  // });
  eventer.on("settings", (set) => {
    setAuth(set);
  })
}

const pko: Record<string, { step: number, cancelTimeout: NodeJS.Timer, sender?: StateObject, reciever?: StateObject }> = {};

function removePendingPinTimeout(pin: string) {
  return setTimeout(() => { delete pko[pin] }, 10 * 60 * 1000)
}
function handleTransfer(state: StateObject) {
  let pin = state.path[4];
  if (!state.path[4] || !pko[pin] || (state.path[5] !== "sender" && state.path[5] !== "reciever"))
    return state.throwReason(400, "Invalid request parameters");
  let direction: "sender" | "reciever" = state.path[5] as any;
  let pkop = pko[pin];
  pkop[direction] = state;
  if (!pkop.sender || !pkop.reciever) return;
  clearTimeout(pkop.cancelTimeout);
  pkop.step += 1;
  pkop.sender.res.writeHead(200, undefined, {
    "x-tiddlyserver-transfer-count": pkop.step,
    "content-type": pkop.reciever.req.headers["content-type"],
    "content-length": pkop.reciever.req.headers["content-length"]
  });
  pkop.reciever.req.pipe(pkop.sender.res);
  pkop.reciever.res.writeHead(200, undefined, {
    "x-tiddlyserver-transfer-count": pkop.step,
    "content-type": pkop.sender.req.headers["content-type"],
    "content-length": pkop.sender.req.headers["content-length"]
  });
  pkop.sender.req.pipe(pkop.reciever.res);
  pkop.cancelTimeout = removePendingPinTimeout(pin);
  pkop.reciever = undefined;
  pkop.sender = undefined;
}
let randomPin;
libsodium.ready.then(() => { randomPin = libsodium.randombytes_buf(8) });
function getRandomPin() {
  let pin = "";
  while (!pin || pko[pin])
    pin = libsodium.to_hex(
      randomPin = libsodium.crypto_generichash(8, randomPin, undefined, "uint8array")
    );
  pko[pin] = { step: 1, cancelTimeout: removePendingPinTimeout(pin) };
  return pin;
}
let sharedKeyList: Record<string, string> = {};
function setSharedKey(key: string) {
  // let pin = getRandomPin();
  if (!sharedKeyList[key]) sharedKeyList[key] = getRandomPin();
  return sharedKeyList[key];
}
const DEFAULT_AGE = "2592000";
export function getSetCookie(name: string, value: string, secure: boolean, age: number) {
  // let flags = ["Secure", "HttpOnly", "Max-Age=2592000", "SameSite=Strict"];
  let flags = {
    "Secure": secure,
    "HttpOnly": true,
    "Max-Age": age.toString(),
    "SameSite": "Strict",
    "Path": "/"
  };

  return [
    name + "=" + value,
    ...Object.keys(flags).filter(k => !!flags[k]).map(k => k + (typeof flags[k] === "string" ? "=" + flags[k] : ""))
  ].join("; ");
}
interface TiddlyServerResponses {
  "POST /admin/authenticate/initPin": { initPin: string },
  "POST /admin/authenticate/initShared/{shared}": { initPin: string },
  "POST /admin/authenticate/login": undefined,
  "POST /admin/authenticate/logout": undefined,
  "POST /admin/authenticate/transfer": any
}
/** Handles the /admin/authenticate route */
export function handleAuthRoute(state: StateObject) {
  if (state.req.method === "GET" || state.req.method === "HEAD") {
    if (state.path.length === 4 && state.path[3] === "login.html") {
      serveFile(state, "login.html", path.join(state.settings.__assetsDir, "authenticate"));
    } else if (state.path.length === 4 && state.path[3] === "transfer.html") {
      serveFile(state, "transfer.html", path.join(state.settings.__assetsDir, "authenticate"));
    } else {
      state.throw(404);
    }
    return;
  }
  //state.path[3]: "sendkey" | "recievekey" | "login" | "logout" | "pendingpin"
  if (state.req.method !== "POST")
    return state.throw(405);
  if (state.path[3] === "transfer") {
    if (!state.allow.transfer) return state.throwReason(403, "Access Denied");
    handleTransfer(state);
  } else if (state.path[3] === "initpin") {
    if (!state.allow.transfer) return state.throwReason(403, "Access Denied");
    if (Object.keys(pko).length > state.settings.maxTransferRequests)
      return state.throwReason(509, "Too many transfer requests in progress");
    else
      state.respond(200).json({ initPin: getRandomPin() });
  } else if (state.path[3] === "initshared") {
    if (!state.allow.transfer) return state.throwReason(403, "Access Denied");
    if (Object.keys(pko).length > 1000)
      return state.throwReason(509, "Too many transfer requests in progress");
    else
      state.respond(200).json({ initPin: setSharedKey(state.path[4]) });
  } else if (state.path[3] === "login") {
    state.recieveBody(true, true).then(() => {
      if (state.body.length && !state.json)
        return; //recieve body sent a response already
      if (!state.body.length) {
        return state.throwReason(400, "Empty request body");
      }
      if (!expect<{ setCookie: string, publicKey: string }>(state.json, ["setCookie", "publicKey"]))
        return state.throwReason(400, "Improper request body");
      /** [username, type, timestamp, hash, sig] */
      let json = parseAuthCookie(state.json.setCookie, false);
      if (json.length !== 5) return state.throwReason(400, "Bad cookie format");
      let { registerNotice } = state.settings.bindInfo.localAddressPermissions[state.hostLevelPermissionsKey];
      let valid = validateCookie(json, registerNotice && [
        "    login attempted with unknown public key",
        "    " + state.json.publicKey,
        "    username: " + json[0],
        "    timestamp: " + json[2]
      ].join("\n"));
      if (valid) {
        state.setHeader("Set-Cookie", getSetCookie(TIDDLY_SERVER_AUTH, state.json.setCookie + "|" + valid[2], false, state.settings.authCookieAge));
        state.respond(200).empty();
      } else {
        state.throwReason(400, "INVALID_CREDENTIALS");
      }
    })
  } else if (state.path[3] === "logout") {
    state.setHeader("Set-Cookie", getSetCookie(TIDDLY_SERVER_AUTH, "", false, 0));
    state.respond(200).empty();
  }
}
