"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const libsodium = require("libsodium-wrappers");
const path = require("path");
const TIDDLY_SERVER_AUTH = 'TiddlyServerAuth';
function parseAuthCookie(cookie, suffix) {
    let json = cookie.split("|"); //tryParseJSON<>(auth);
    if (json.length > (suffix ? 6 : 5)) {
        let name = json.slice(0, json.length - 4);
        let rest = json.slice(json.length - 4);
        json = [name.join("|"), ...rest];
    }
    return json;
}
exports.parseAuthCookie = parseAuthCookie;
const setAuth = (settings) => {
    /** Record<hash+username, [authGroup, publicKey, suffix]> */
    let publicKeyLookup = {};
    const authCookieAge = settings.authCookieAge;
    const { crypto_generichash, crypto_generichash_BYTES, crypto_sign_verify_detached, from_base64, } = libsodium;
    Object.keys(settings.authAccounts).forEach(k => {
        let e = settings.authAccounts[k];
        if (e.clientKeys)
            Object.keys(e.clientKeys).forEach(u => {
                const publicKey = from_base64(e.clientKeys[u].publicKey);
                let publicHash = crypto_generichash(crypto_generichash_BYTES, publicKey, undefined, "base64");
                if (!publicKeyLookup[publicHash + u])
                    publicKeyLookup[publicHash + u] = [k, e.clientKeys[u].publicKey, e.clientKeys[u].cookieSalt];
                else
                    throw "publicKey+username combination is used for more than one authAccount";
            });
    });
    exports.checkCookieAuth = (request, logRegisterNotice) => {
        if (!request.headers.cookie)
            return false;
        let cookies = {}, rc = request.headers.cookie;
        rc.split(';').forEach(function (cookie) {
            let parts = cookie.split('=');
            cookies[parts.shift().trim()] = parts.length ? decodeURI(parts.join('=')) : "";
        });
        let auth = cookies[TIDDLY_SERVER_AUTH];
        if (!auth)
            return false;
        let json = parseAuthCookie(auth, true);
        //we have to make sure the suffix is truthy
        if (!json || json.length !== 6 || !json[5])
            return false;
        return exports.validateCookie(json, false);
    };
    const isoreg = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
    exports.validateCookie = (json, logRegisterNotice) => {
        let [username, type, timestamp, hash, sig, suffix] = json;
        if (type === "key" && !publicKeyLookup[hash + username]) {
            if (logRegisterNotice)
                console.log(logRegisterNotice);
            return false;
        }
        // console.log(username + timestamp + hash);
        if (type === "pw")
            return false; //passwords are currently not implemented
        let pubkey = publicKeyLookup[hash + username];
        //don't check suffix unless it is provided, other code checks whether it is provided or not
        //check it after the signiture to prevent brute-force suffix checking
        let valid = crypto_sign_verify_detached(from_base64(sig), username + timestamp + hash, from_base64(pubkey[1]))
            //json.length should be 5 if there is no suffix, don't ignore falsy suffix
            //the calling code must determine whether the subject is needed
            && (json.length === 5 || suffix === pubkey[2])
            && isoreg.test(timestamp)
            && (Date.now() - new Date(timestamp).valueOf() < authCookieAge * 1000);
        // console.log((valid ? "" : "in") + "valid signature")
        return valid ? [pubkey[0], username, pubkey[2]] : false;
    };
};
const expect = function (a, keys) {
    return keys.every(k => Object.prototype.hasOwnProperty.call(a, k))
        && Object.keys(a).every(k => keys.indexOf(k) !== -1);
};
function initAuthRoute(eventer) {
    // eventer.on("websocket-connection", (client, request) => {
    // 	if (request.url === "/admin/authenticate") {
    // 		sockets.push(client);
    // 		client.on("message", handleSocketMessage);
    // 	}
    // });
    eventer.on("settings", (set) => {
        setAuth(set);
    });
}
exports.initAuthRoute = initAuthRoute;
const pko = {};
function removePendingPinTimeout(pin) {
    return setTimeout(() => { delete pko[pin]; }, 10 * 60 * 1000);
}
function handleTransfer(state) {
    let pin = state.path[4];
    if (!state.path[4] || !pko[pin] || (state.path[5] !== "sender" && state.path[5] !== "reciever"))
        return state.throwReason(400, "Invalid request parameters");
    let direction = state.path[5];
    let pkop = pko[pin];
    pkop[direction] = state;
    if (!pkop.sender || !pkop.reciever)
        return;
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
libsodium.ready.then(() => { randomPin = libsodium.randombytes_buf(8); });
function getRandomPin() {
    let pin = "";
    while (!pin || pko[pin])
        pin = libsodium.to_hex(randomPin = libsodium.crypto_generichash(8, randomPin, undefined, "uint8array"));
    pko[pin] = { step: 1, cancelTimeout: removePendingPinTimeout(pin) };
    return pin;
}
let sharedKeyList = {};
function setSharedKey(key) {
    // let pin = getRandomPin();
    if (!sharedKeyList[key])
        sharedKeyList[key] = getRandomPin();
    return sharedKeyList[key];
}
const DEFAULT_AGE = "2592000";
function getSetCookie(name, value, secure, age) {
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
exports.getSetCookie = getSetCookie;
/** Handles the /admin/authenticate route */
function handleAuthRoute(state) {
    if (state.req.method === "GET" || state.req.method === "HEAD") {
        if (state.path.length === 4 && state.path[3] === "login.html") {
            server_types_1.serveFile(state, "login.html", path.join(state.settings.__assetsDir, "authenticate"));
        }
        else if (state.path.length === 4 && state.path[3] === "transfer.html") {
            server_types_1.serveFile(state, "transfer.html", path.join(state.settings.__assetsDir, "authenticate"));
        }
        else {
            state.throw(404);
        }
        return;
    }
    //state.path[3]: "sendkey" | "recievekey" | "login" | "logout" | "pendingpin"
    if (state.req.method !== "POST")
        return state.throw(405);
    if (state.path[3] === "transfer") {
        if (!state.allow.transfer)
            return state.throwReason(403, "Access Denied");
        handleTransfer(state);
    }
    else if (state.path[3] === "initpin") {
        if (!state.allow.transfer)
            return state.throwReason(403, "Access Denied");
        if (Object.keys(pko).length > state.settings.maxTransferRequests)
            return state.throwReason(509, "Too many transfer requests in progress");
        else
            state.respond(200).json({ initPin: getRandomPin() });
    }
    else if (state.path[3] === "initshared") {
        if (!state.allow.transfer)
            return state.throwReason(403, "Access Denied");
        if (Object.keys(pko).length > 1000)
            return state.throwReason(509, "Too many transfer requests in progress");
        else
            state.respond(200).json({ initPin: setSharedKey(state.path[4]) });
    }
    else if (state.path[3] === "login") {
        state.recieveBody(true, true).then(() => {
            if (state.body.length && !state.json)
                return; //recieve body sent a response already
            if (!state.body.length) {
                return state.throwReason(400, "Empty request body");
            }
            if (!expect(state.json, ["setCookie", "publicKey"]))
                return state.throwReason(400, "Improper request body");
            /** [username, type, timestamp, hash, sig] */
            let json = parseAuthCookie(state.json.setCookie, false);
            if (json.length !== 5)
                return state.throwReason(400, "Bad cookie format");
            let { registerNotice } = state.settings.bindInfo.localAddressPermissions[state.hostLevelPermissionsKey];
            let valid = exports.validateCookie(json, registerNotice && [
                "    login attempted with unknown public key",
                "    " + state.json.publicKey,
                "    username: " + json[0],
                "    timestamp: " + json[2]
            ].join("\n"));
            if (valid) {
                state.setHeader("Set-Cookie", getSetCookie(TIDDLY_SERVER_AUTH, state.json.setCookie + "|" + valid[2], false, state.settings.authCookieAge));
                state.respond(200).empty();
            }
            else {
                state.throwReason(400, "INVALID_CREDENTIALS");
            }
        });
    }
    else if (state.path[3] === "logout") {
        state.setHeader("Set-Cookie", getSetCookie(TIDDLY_SERVER_AUTH, "", false, 0));
        state.respond(200).empty();
    }
}
exports.handleAuthRoute = handleAuthRoute;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aFJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F1dGhSb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGlEQUEwRjtBQUMxRixnREFBZ0Q7QUFFaEQsNkJBQTZCO0FBRzdCLE1BQU0sa0JBQWtCLEdBQVcsa0JBQWtCLENBQUM7QUFPdEQsU0FBZ0IsZUFBZSxDQUFDLE1BQWMsRUFBRSxNQUFlO0lBQzdELElBQUksSUFBSSxHQUEyRCxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBUSxDQUFDLENBQUMsdUJBQXVCO0lBQ3BILElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUNsQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzFDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2QyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFRLENBQUM7S0FDekM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFSRCwwQ0FRQztBQUNELE1BQU0sT0FBTyxHQUFHLENBQUMsUUFBc0IsRUFBRSxFQUFFO0lBQ3pDLDREQUE0RDtJQUM1RCxJQUFJLGVBQWUsR0FBcUMsRUFBRSxDQUFDO0lBRTNELE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUM7SUFDN0MsTUFBTSxFQUNKLGtCQUFrQixFQUNsQix3QkFBd0IsRUFDeEIsMkJBQTJCLEVBQzNCLFdBQVcsR0FDWixHQUFHLFNBQVMsQ0FBQztJQUVkLE1BQU0sQ0FBQyxJQUFJLENBQUMs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