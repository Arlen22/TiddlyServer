"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const bundled_lib_1 = require("../lib/bundled-lib");
const path = require("path");
const sockets = [];
const state = [];
function parseAuthCookie(cookie, suffix) {
    let splitCookie = cookie.split("|");
    const length = splitCookie.length;
    const expectLength = suffix ? 6 : 5;
    if (length > expectLength) {
        // This is a workaround in case the username happens to contain a pipe
        // other code still checks the signature of the cookie, so it's all good
        const nameLength = splitCookie.length - expectLength - 1;
        const name = splitCookie.slice(0, nameLength).join("|");
        const rest = splitCookie.slice(nameLength);
        return [name, ...rest];
    }
    else if (length === expectLength) {
        return splitCookie;
    }
    else {
        return false;
    }
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
            if (!json || json.length !== 5)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aFJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXV0aFJvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaURBQTRHO0FBRzVHLG9EQUFnRTtBQUdoRSw2QkFBNkI7QUFDN0IsTUFBTSxPQUFPLEdBQWdCLEVBQUUsQ0FBQztBQUNoQyxNQUFNLEtBQUssR0FBUyxFQUFFLENBQUM7QUFVdkIsU0FBZ0IsZUFBZSxDQUFDLE1BQWMsRUFBRSxNQUFlO0lBRTdELElBQUksV0FBVyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDcEMsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztJQUNsQyxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BDLElBQUksTUFBTSxHQUFHLFlBQVksRUFBRTtRQUN6QixzRUFBc0U7UUFDdEUsd0VBQXdFO1FBQ3hFLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsWUFBWSxHQUFHLENBQUMsQ0FBQztRQUN6RCxNQUFNLElBQUksR0FBVyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEUsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMzQyxPQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFvQixDQUFDO0tBQzVDO1NBQU0sSUFBSSxNQUFNLEtBQUssWUFBWSxFQUFFO1FBQ2xDLE9BQVEsV0FBOEIsQ0FBQztLQUN4QztTQUFNO1FBQ0wsT0FBTyxLQUFLLENBQUM7S0FDZDtBQUdILENBQUM7QUFuQkQsMENBbUJDO0FBQ0QsTUFBTSxPQUFPLEdBQUcsQ0FBQyxRQUFzQixFQUFFLEVBQUU7SUFDekMsNERBQTREO0lBQzVELElB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