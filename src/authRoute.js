"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const bundled_lib_1 = require("../lib/bundled-lib");
const path = require("path");
const sockets = [];
const state = [];
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
    let passwordLookup = {};
    const authCookieAge = settings.authCookieAge;
    const { crypto_generichash, crypto_generichash_BYTES, crypto_generichash_BYTES_MIN, crypto_generichash_BYTES_MAX, crypto_sign_keypair, crypto_sign_verify_detached, from_base64, crypto_box_SEEDBYTES, } = bundled_lib_1.libsodium;
    // console.log(crypto_box_SEEDBYTES, crypto_generichash_BYTES, crypto_generichash_BYTES_MAX, crypto_generichash_BYTES_MIN);
    // let passwordKey = crypto_sign_keypair("uint8array");
    // console.log(settings.authAccounts);
    Object.keys(settings.authAccounts).forEach(k => {
        let e = settings.authAccounts[k];
        // console.log(k, e, e.clientKeys);
        if (e.clientKeys)
            Object.keys(e.clientKeys).forEach(u => {
                // console.log(k, u, e.clientKeys[u]);
                const publicKey = from_base64(e.clientKeys[u].publicKey);
                // let t = e.clientKeys[u];
                let publicHash = crypto_generichash(crypto_generichash_BYTES, publicKey, undefined, "base64");
                if (!publicKeyLookup[publicHash + u])
                    publicKeyLookup[publicHash + u] = [k, e.clientKeys[u].publicKey, e.clientKeys[u].cookieSalt];
                else
                    throw "publicKey+username combination is used for more than one authAccount";
            });
        // if (e.passwords) Object.keys(e.passwords).forEach(u => {
        // 	const password = e.passwords[u];
        // 	let passHash = crypto_generichash(crypto_generichash_BYTES, password, undefined, "base64");
        // 	if (!passwordLookup[u]) passwordLookup[u] = k;
        // 	else throw "username is used for more than one authAccount password list";
        // });
    });
    exports.checkCookieAuth = (request, logRegisterNotice) => {
        if (!request.headers.cookie)
            return false;
        var cookies = {}, rc = request.headers.cookie;
        rc.split(';').forEach(function (cookie) {
            var parts = cookie.split('=');
            cookies[parts.shift().trim()] = parts.length ? decodeURI(parts.join('=')) : "";
        });
        let auth = cookies["TiddlyServerAuth"];
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
bundled_lib_1.libsodium.ready.then(() => { randomPin = bundled_lib_1.libsodium.randombytes_buf(8); });
function getRandomPin() {
    let pin = "";
    while (!pin || pko[pin])
        pin = bundled_lib_1.libsodium.to_hex(randomPin = bundled_lib_1.libsodium.crypto_generichash(8, randomPin, undefined, "uint8array"));
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
                state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", state.json.setCookie + "|" + valid[2], false, state.settings.authCookieAge));
                state.respond(200).empty();
            }
            else {
                state.throwReason(400, "INVALID_CREDENTIALS");
            }
        });
    }
    else if (state.path[3] === "logout") {
        state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", "", false, 0));
        state.respond(200).empty();
    }
}
exports.handleAuthRoute = handleAuthRoute;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aFJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXV0aFJvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaURBQTRHO0FBRzVHLG9EQUFnRTtBQUdoRSw2QkFBNkI7QUFDN0IsTUFBTSxPQUFPLEdBQWdCLEVBQUUsQ0FBQztBQUNoQyxNQUFNLEtBQUssR0FBUyxFQUFFLENBQUM7QUFVdkIsU0FBZ0IsZUFBZSxDQUFDLE1BQWMsRUFBRSxNQUFlO0lBQzdELElBQUksSUFBSSxHQUEyRCxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBUSxDQUFDLENBQUMsdUJBQXVCO0lBQ3BILElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUNsQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzFDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2QyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFRLENBQUM7S0FDekM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFSRCwwQ0FRQztBQUNELE1BQU0sT0FBTyxHQUFHLENBQUMsUUFBc0IsRUFBRSxFQUFFO0lBQ3pDLDREQUE0RDtJQUM1RCxJQUFJLGVBQWUsR0FBNkMsRUFBRSxDQUFDO0lBQ25FLElBQUksY0FBYyxHQUEyQixFQUFFLENBQUM7SUFFaEQsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQztJQUM3QyxNQUFNLEVBQ0osa0JBQWtCLEVBQ2xCLHdCQUF3QixFQUN4Qiw0QkFBNEIsRUFDNUIs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