import { PublicKeyCache } from "./publicKeyCache";
import {
  StateObject,
  ServerEventEmitter,
  ServerConfig,
  serveFile
} from "./server-types";
import { getSetCookie, validateCookie, parseAuthCookie } from "./cookies";
import {
  crypto_generichash,
  crypto_generichash_BYTES,
  from_base64,
  randombytes_buf,
  ready,
  to_hex
} from "libsodium-wrappers";
import * as path from "path";

const TIDDLY_SERVER_AUTH_COOKIE: string = "TiddlyServerAuth";

/** Handles the /admin/authenticate route */
export const handleAuthRoute = (state: StateObject) => {
  if (state.req.method === "GET" || state.req.method === "HEAD") {
    return handleHEADorGETFileServe(state);
  }
  if (state.req.method !== "POST") return state.throw(405);
  switch (state.path[3]) {
    case "transfer":
      return handleTransfer(state);
    case "initpin":
      return handleInitPin(state);
    case "initshared":
      return handleInitShared(state);
    case "login":
      return handleLogin(state);
    case "logout":
      return handleLogout(state);
    default:
      console.log("Case not handled for authRoute");
  }
};

export function initAuthRoute(eventer: ServerEventEmitter) {
  eventer.on("settings", serverSettings => {
    setAuth(serverSettings);
  });
}

const setAuth = (settings: ServerConfig) => {
  /** Record<hash+username, [authGroup, publicKey, suffix]> */
  let publicKeyCache = PublicKeyCache.getCache();

  Object.keys(settings.authAccounts).forEach(accountId => {
    let clientKeysAndPermissions = settings.authAccounts[accountId];
    if (clientKeysAndPermissions.clientKeys)
      Object.keys(clientKeysAndPermissions.clientKeys).forEach(user => {
        const publicKey = from_base64(
          clientKeysAndPermissions.clientKeys[user].publicKey
        );
        let publicHash = crypto_generichash(
          crypto_generichash_BYTES,
          publicKey,
          undefined,
          "base64"
        );
        if (!publicKeyCache.keyExists(publicHash + user))
          publicKeyCache.setVal(publicHash + user, [
            accountId,
            clientKeysAndPermissions.clientKeys[user].publicKey,
            clientKeysAndPermissions.clientKeys[user].cookieSalt
          ]);
        else
          throw "publicKey+username combination is used for more than one authAccount";
      });
  });
};

const pko: Record<
  string,
  {
    step: number;
    cancelTimeout: NodeJS.Timer;
    sender?: StateObject;
    reciever?: StateObject;
  }
> = {};

const removePendingPinTimeout = (pin: string) => {
  return setTimeout(() => {
    delete pko[pin];
  }, 10 * 60 * 1000);
};

const handleTransfer = (state: StateObject) => {
  if (!state.allow.transfer) return state.throwReason(403, "Access Denied");
  let pin = state.path[4];
  if (
    !state.path[4] ||
    !pko[pin] ||
    (state.path[5] !== "sender" && state.path[5] !== "reciever")
  )
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
};

const expect = function<T>(a: any, keys: (string | number | symbol)[]): a is T {
  return (
    keys.every(k => Object.prototype.hasOwnProperty.call(a, k)) &&
    Object.keys(a).every(k => keys.indexOf(k) !== -1)
  );
};

const handleHEADorGETFileServe = (state: StateObject) => {
  const pathLength = state.path.length;
  if (pathLength === 4 && state.path[3] === "login.html") {
    serveFile(
      state,
      "login.html",
      path.join(state.settings.__assetsDir, "authenticate")
    );
  } else if (pathLength === 4 && state.path[3] === "transfer.html") {
    serveFile(
      state,
      "transfer.html",
      path.join(state.settings.__assetsDir, "authenticate")
    );
  } else {
    state.throw(404);
  }
  return;
};

const handleLogin = async (state: StateObject) => {
  await state.recieveBody(true, true);
  if (state.body.length && !state.json) return; //recieve body sent a response already
  if (!state.body.length) {
    return state.throwReason(400, "Empty request body");
  }
  if (
    !expect<{ setCookie: string; publicKey: string }>(state.json, [
      "setCookie",
      "publicKey"
    ])
  ) {
    return state.throwReason(400, "Improper request body");
  }
  /** [username, type, timestamp, hash, sig] */
  let cookieData = parseAuthCookie(state.json.setCookie, false);
  if (cookieData.length !== 5) {
    return state.throwReason(400, "Bad cookie format");
  }
  let { registerNotice } = state.settings.bindInfo.localAddressPermissions[
    state.hostLevelPermissionsKey
  ];
  let valid = validateCookie(
    cookieData,
    registerNotice &&
      [
        "    login attempted with unknown public key",
        "    " + state.json.publicKey,
        "    username: " + cookieData[0],
        "    timestamp: " + cookieData[2]
      ].join("\n")
  );
  if (valid) {
    state.setHeader(
      "Set-Cookie",
      getSetCookie(
        TIDDLY_SERVER_AUTH_COOKIE,
        state.json.setCookie + "|" + valid[2],
        false,
        state.settings.authCookieAge
      )
    );
    state.respond(200).empty();
  } else {
    state.throwReason(400, "INVALID_CREDENTIALS");
  }
};

const getRandomPin = async (): Promise<string> => {
  // Wait for libsodium.ready
  await ready;
  let randomPin = randombytes_buf(8);
  let pin = "";
  while (!pin || pko[pin]) {
    pin = to_hex(
      (randomPin = crypto_generichash(8, randomPin, undefined, "uint8array"))
    );
  }
  pko[pin] = { step: 1, cancelTimeout: removePendingPinTimeout(pin) };
  return pin;
};

const handleInitPin = (state: StateObject) => {
  if (!state.allow.transfer) {
    state.throwReason(403, "Access Denied");
  } else if (Object.keys(pko).length > state.settings.maxTransferRequests) {
    state.throwReason(509, "Too many transfer requests in progress");
  } else {
    state.respond(200).json({ initPin: getRandomPin() });
  }
  return;
};

let sharedKeyList: Record<string, string> = {};
const setSharedKey = async (key: string) => {
  const pin = await getRandomPin();
  if (!sharedKeyList[key]) sharedKeyList[key] = pin;
  return sharedKeyList[key];
};

const handleInitShared = (state: StateObject) => {
  if (!state.allow.transfer) {
    state.throwReason(403, "Access Denied");
  } else if (Object.keys(pko).length > 1000) {
    state.throwReason(509, "Too many transfer requests in progress");
  } else {
    state.respond(200).json({ initPin: setSharedKey(state.path[4]) });
  }
  return;
};

const handleLogout = (state: StateObject) => {
  state.setHeader(
    "Set-Cookie",
    getSetCookie(TIDDLY_SERVER_AUTH_COOKIE, "", false, 0)
  );
  state.respond(200).empty();
  return;
};
