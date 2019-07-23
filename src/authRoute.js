"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const bundled_lib_1 = require("../lib/bundled-lib");
const path = require("path");
const sockets = [];
const state = [];
exports.parseAuthCookie = (cookie) => {
    let json = cookie.split("|"); //tryParseJSON<>(auth);
    if (json.length > 5) {
        let name = json.slice(0, json.length - 4);
        let rest = json.slice(json.length - 4);
        json = [name.join("|"), ...rest];
    }
    return json;
};
const setAuth = (settings) => {
    // let ca: Record<string, x509.Certificate[]> = {};
    // let up: [string, string, string][] = [] as any;
    /** Record<hash+username, [authGroup, publicKey]> */
    let publicKeyLookup = {};
    let passwordLookup = {};
    const { crypto_generichash, crypto_generichash_BYTES, crypto_generichash_BYTES_MIN, crypto_generichash_BYTES_MAX, crypto_sign_keypair, crypto_sign_verify_detached, from_base64, crypto_box_SEEDBYTES, } = bundled_lib_1.libsodium;
    console.log(crypto_box_SEEDBYTES, crypto_generichash_BYTES, crypto_generichash_BYTES_MAX, crypto_generichash_BYTES_MIN);
    // let passwordKey = crypto_sign_keypair("uint8array");
    // console.log(settings.authAccounts);
    Object.keys(settings.authAccounts).forEach(k => {
        let e = settings.authAccounts[k];
        // console.log(k, e, e.clientKeys);
        if (e.clientKeys)
            Object.keys(e.clientKeys).forEach(u => {
                console.log(k, u, e.clientKeys[u]);
                const publicKey = from_base64(e.clientKeys[u]);
                let publicHash = crypto_generichash(crypto_generichash_BYTES, publicKey, undefined, "base64");
                if (!publicKeyLookup[publicHash + u])
                    publicKeyLookup[publicHash + u] = [k, e.clientKeys[u]];
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
        let json = exports.parseAuthCookie(auth);
        if (!json)
            return false;
        return exports.validateCookie(json, false);
    };
    exports.validateCookie = (json, logRegisterNotice) => {
        let [username, type, timestamp, hash, sig] = json;
        if (type === "key" && !publicKeyLookup[hash + username]) {
            // console.log(publicKeyLookup);
            if (logRegisterNotice)
                console.log(logRegisterNotice);
            return false;
        }
        // console.log(username + timestamp + hash);
        if (type === "pw")
            return false; //passwords are currently not implemented
        let valid = crypto_sign_verify_detached(from_base64(sig), username + timestamp + hash, from_base64(publicKeyLookup[hash + username][1]));
        // console.log((valid ? "" : "in") + "valid signature")
        return valid ? [publicKeyLookup[hash + username][0], username] : false;
    };
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
        handleTransfer(state);
    }
    else if (state.path[3] === "initpin") {
        if (Object.keys(pko).length > 1000)
            return state.throwReason(509, "Too many transfer requests in progress");
        else
            state.respond(200).json({ initPin: getRandomPin() });
    }
    else if (state.path[3] === "initshared") {
        if (Object.keys(pko).length > 1000)
            return state.throwReason(509, "Too many transfer requests in progress");
        else
            state.respond(200).json({ initPin: setSharedKey(state.path[4]) });
    }
    else if (state.path[3] === "login") {
        state.recieveBody(true, true).then(() => {
            if (state.body.length && !state.json)
                return; //recieve body sent a response already
            if (!state.body.length)
                return state.throwReason(400, "Empty request body");
            /** [username, type, timestamp, hash, sig] */
            let json = exports.parseAuthCookie(state.json.setCookie);
            if (json.length !== 5)
                return state.throwReason(400, "Bad cookie format");
            let { registerNotice } = state.settings.bindInfo.localAddressPermissions[state.hostLevelPermissionsKey];
            let username = exports.validateCookie(json, registerNotice && [
                "    login attempted with unknown public key",
                "    " + state.json.publicKey,
                "    username: " + json[1],
                "    timestamp: " + json[2]
            ].join("\n"));
            if (username) {
                state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", state.json.setCookie, false, state.settings.authCookieAge));
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
    return;
    /* Create cookie for authentication. Can only be secured with HTTPS, otherwise anyone can "borrow" it */ {
        const { crypto_generichash_BYTES, crypto_sign_keypair, crypto_sign_detached, crypto_sign_verify_detached, crypto_generichash, from_base64 } = bundled_lib_1.libsodium;
        let keys = crypto_sign_keypair("uint8array");
        // Never use the public key included in a message to check its signature.
        let publicHash = crypto_generichash(crypto_generichash_BYTES, keys.publicKey, undefined, "base64");
        let cookie = ["key", "my username", new Date().toISOString(), publicHash];
        let signed = crypto_sign_detached(cookie[0] + cookie[1] + cookie[2], keys.privateKey, "base64");
        cookie.push(signed);
        let request = {
            setCookie: JSON.stringify(signed),
            publicKey: keys.publicKey
        };
        //check the cookie on the server to make sure it is valid
        let valid = crypto_sign_verify_detached(from_base64(signed), cookie[0] + cookie[1] + cookie[2], keys.publicKey);
    }
    /* create secure channel for transferring private key */ {
        const { crypto_kx_client_session_keys, crypto_kx_server_session_keys, crypto_kx_keypair, from_base64, to_base64, randombytes_buf, crypto_secretbox_easy } = bundled_lib_1.libsodium;
        let clientKeys = crypto_kx_keypair("uint8array");
        let clientPublicKey = to_base64(clientKeys.publicKey);
        let senderKeys = crypto_kx_keypair("uint8array");
        let senderPublicKey = to_base64(senderKeys.publicKey);
        //exchange the public keys here
        let clientSession = crypto_kx_client_session_keys(clientKeys.publicKey, clientKeys.privateKey, from_base64(senderPublicKey), "uint8array");
        let clientCheck = bundled_lib_1.libsodium.crypto_generichash(Math.max(bundled_lib_1.libsodium.crypto_generichash_BYTES_MIN, 8), 
        //server_to_client + client_to_server
        to_base64(clientSession.sharedRx) + to_base64(clientSession.sharedTx), undefined, "uint8array");
        let senderSession = crypto_kx_server_session_keys(senderKeys.publicKey, senderKeys.privateKey, from_base64(clientPublicKey), "uint8array");
        let senderCheck = bundled_lib_1.libsodium.crypto_generichash(Math.max(bundled_lib_1.libsodium.crypto_generichash_BYTES_MIN, 8), 
        //server_to_client + client_to_server
        to_base64(senderSession.sharedTx) + to_base64(senderSession.sharedRx), undefined, "uint8array");
        // compare the two checks, they should be exactly the same
        if (senderCheck !== clientCheck)
            throw "aghhhh!! someone messed with our key!!";
        //encrypt the auth key on the sender
        let nonce = randombytes_buf(16);
        let encryptedKey = crypto_secretbox_easy("KEY PAIR OBJECT JSON", nonce, senderSession.sharedTx, "base64");
        //decrypt on the client
        let decryptedKey = bundled_lib_1.libsodium.crypto_secretbox_open_easy(encryptedKey, nonce, clientSession.sharedRx);
    }
}
exports.handleAuthRoute = handleAuthRoute;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aFJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXV0aFJvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaURBQTRHO0FBRzVHLG9EQUFnRTtBQUdoRSw2QkFBNkI7QUFDN0IsTUFBTSxPQUFPLEdBQWdCLEVBQUUsQ0FBQztBQUNoQyxNQUFNLEtBQUssR0FBUyxFQUFFLENBQUM7QUFNWixRQUFBLGVBQWUsR0FBRyxDQUFDLE1BQWMsRUFBYyxFQUFFO0lBQzNELElBQUksSUFBSSxHQUFtRCxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBUSxDQUFDLENBQUMsdUJBQXVCO0lBQzVHLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDcEIsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMxQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBUSxDQUFDO0tBQ3hDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDLENBQUE7QUFDRCxNQUFNLE9BQU8sR0FBRyxDQUFDLFFBQXNCLEVBQUUsRUFBRTtJQUMxQyxtREFBbUQ7SUFDbkQsa0RBQWtEO0lBQ2xELG9EQUFvRDtJQUNwRCxJQUFJLGVBQWUsR0FBcUMsRUFBRSxDQUFDO0lBQzNELElBQUksY0FBYyxHQUEyQixFQUFFLENBQUM7SUFDaEQsTUFBTSxFQUNMLGtCQUFrQixFQUNsQix3QkFBd0IsRUFDeEIsNEJBQTRCLEVBQzVCLDRCQUE0QixFQUM1QixtQkFBbUIsRUFDbkIsMkJBQTJCLEVBQzNCLFdBQVcsRUFDWCxvQkFBb0IsR0FDcEIsR0FBRyx1QkFBUyxDQUFDO0lBQ2QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSx3QkFBd0IsRUFBRSw0QkFBNEIsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO0lBQ3hILHVEQUF1RDtJQUN2RCxzQ0FBc0M7SUFDdEMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQzlDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakMsbUNBQW1DO1FBQ25DLElBQUksQ0FBQyxDQUFDLFVBQVU7WUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3ZELE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25DLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRS9DLElBQUksVUFBVSxHQUFHLGtCQUFrQixDQUFDLHdCQUF3QixFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQzlGLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQztvQkFBRSxlQUFlLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7b0JBQ3hGLE1BQU0sc0VBQXNFLENBQUM7WUFDbkYsQ0FBQyxDQUFDLENBQUM7UUFDSCwyREFBMkQ7UUFDM0Qsb0NBQW9DO1FBQ3BDLCtGQUErRjtRQUMvRixrREFBa0Q7UUFDbEQsOEVBQThFO1FBQzlFLE1BQU07SUFDUCxDQUFDLENBQUMsQ0FBQztJQUVILHVCQUFlLEdBQUcsQ0FBQyxPQUE2QixFQUFFLGlCQUEwQixFQUFFLEVBQUU7UUFDL0UsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzFDLElBQUksT0FBTyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFnQixDQUFDO1FBQ3hELEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsTUFBTTtZQUNyQyxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzlCLE9BQU8sQ0FBRSxLQUFLLENBQUMsS0FBSyxFQUFhLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDNUYsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQVcsQ0FBQztRQUNqRCxJQUFJLENBQUMsSUFBSTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3hCLElBQUksSUFBSSxHQUFHLHVCQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUN4QixPQUFPLHNCQUFjLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3BDLENBQUMsQ0FBQztJQUVGLHNCQUFjLEdBQUcsQ0FBQyxJQUFvRCxFQUFFLGlCQUFrQyxFQUFFLEVBQUU7UUFDN0csSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDbEQsSUFBSSxJQUFJLEtBQUssS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsRUFBRTtZQUN4RCxnQ0FBZ0M7WUFDaEMsSUFBSSxpQkFBaUI7Z0JBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3RELE9BQU8sS0FBSyxDQUFDO1NBQ2I7UUFDRCw0Q0FBNEM7UUFDNUMsSUFBSSxJQUFJLEtBQUssSUFBSTtZQUFFLE9BQU8sS0FBSyxDQUFDLENBQUMseUNBQXlDO1FBQzFFLElBQUksS0FBSyxHQUFHLDJCQUEyQixDQUN0QyxXQUFXLENBQUMsR0FBRyxDQUFDLEVBQ2hCLFFBQVEsR0FBRyxTQUFTLEdBQUcsSUFBSSxFQUMzQixXQUFXLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUNoRCxDQUFDO1FBQ0YsdURBQXVEO1FBQ3ZELE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUN4RSxDQUFDLENBQUM7QUFFSCxDQUFDLENBQUE7QUFDRCxTQUFnQixhQUFhLENBQUMsT0FBMkI7SUFDeEQsNERBQTREO0lBQzVELGdEQUFnRDtJQUNoRCwwQkFBMEI7SUFDMUIsK0NBQStDO0lBQy9DLEtBQUs7SUFDTCxNQUFNO0lBQ04sT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDZCxDQUFDLENBQUMsQ0FBQTtBQUNILENBQUM7QUFWRCxzQ0FVQztBQUVELE1BQU0sR0FBRyxHQUFnSCxFQUFFLENBQUM7QUFFNUgsU0FBUyx1QkFBdUIsQ0FBQyxHQUFXO0lBQzNDLE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUE7QUFDN0QsQ0FBQztBQUNELFNBQVMsY0FBYyxDQUFDLEtBQWtCO0lBQ3pDLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFVBQVUsQ0FBQztRQUM5RixPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLDRCQUE0QixDQUFDLENBQUM7SUFDN0QsSUFBSSxTQUFTLEdBQTBCLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFRLENBQUM7SUFDNUQsSUFBSSxJQUFJLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BCLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxLQUFLLENBQUM7SUFDeEIsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtRQUFFLE9BQU87SUFDM0MsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQztJQUNmLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFO1FBQ3pDLCtCQUErQixFQUFFLElBQUksQ0FBQyxJQUFJO1FBQzFDLGNBQWMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDO1FBQ3pELGdCQUFnQixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztLQUM3RCxDQUFDLENBQUM7SUFDSCxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRTtRQUMzQywrQkFBK0IsRUFBRSxJQUFJLENBQUMsSUFBSTtRQUMxQyxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQztRQUN2RCxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7S0FDM0QsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEMsSUFBSSxDQUFDLGFBQWEsR0FBRyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNuRCxDQUFDO0FBQ0QsSUFBSSxTQUFTLENBQUM7QUFDZCx1QkFBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsU0FBUyxHQUFHLHVCQUFTLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekUsU0FBUyxZQUFZO0lBQ3BCLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztJQUNiLE9BQU8sQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQztRQUN0QixHQUFHLEdBQUcsdUJBQVMsQ0FBQyxNQUFNLENBQ3JCLFNBQVMsR0FBRyx1QkFBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUMvRSxDQUFDO0lBQ0gsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxhQUFhLEVBQUUsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUNwRSxPQUFPLEdBQUcsQ0FBQztBQUNaLENBQUM7QUFDRCxJQUFJLGFBQWEsR0FBMkIsRUFBRSxDQUFDO0FBQy9DLFNBQVMsWUFBWSxDQUFDLEdBQVc7SUFDaEMsNEJBQTRCO0lBQzVCLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDO1FBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFlBQVksRUFBRSxDQUFDO0lBQzdELE9BQU8sYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzNCLENBQUM7QUFDRCxNQUFNLFdBQVcsR0FBRyxTQUFTLENBQUM7QUFDOUIsU0FBZ0IsWUFBWSxDQUFDLElBQVksRUFBRSxLQUFhLEVBQUUsTUFBZSxFQUFFLEdBQVc7SUFDckYsNEVBQTRFO0lBQzVFLElBQUksS0FBSyxHQUFHO1FBQ1gsUUFBUSxFQUFFLE1BQU07UUFDaEIsVUFBVSxFQUFFLElBQUk7UUFDaEIsU0FBUyxFQUFFLEdBQUcsQ0FBQyxRQUFRLEVBQUU7UUFDekIsVUFBVSxFQUFFLFFBQVE7UUFDcEIsTUFBTSxFQUFFLEdBQUc7S0FDWCxDQUFDO0lBRUYsT0FBTztRQUNOLElBQUksR0FBRyxHQUFHLEdBQUcsS0FBSztRQUNsQixHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDaEgsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDZCxDQUFDO0FBZEQsb0NBY0M7QUFRRCw0Q0FBNEM7QUFDNUMsU0FBZ0IsZUFBZSxDQUFDLEtBQWtCO0lBQ2pELElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEtBQUssS0FBSyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxLQUFLLE1BQU0sRUFBRTtRQUM5RCxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFlBQVksRUFBRTtZQUM5RCx3QkFBUyxDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO1NBQ3RGO2FBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxlQUFlLEVBQUU7WUFDeEUsd0JBQVMsQ0FBQyxLQUFLLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztTQUN6RjthQUFNO1lBQ04sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNqQjtRQUNELE9BQU87S0FDUDtJQUNELDZFQUE2RTtJQUM3RSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxLQUFLLE1BQU07UUFDOUIsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxVQUFVLEVBQUU7UUFDakMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ3RCO1NBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFNBQVMsRUFBRTtRQUN2QyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxHQUFHLElBQUk7WUFDakMsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSx3Q0FBd0MsQ0FBQyxDQUFDOztZQUV4RSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsRUFBRSxDQUFDLENBQUM7S0FDdEQ7U0FBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssWUFBWSxFQUFFO1FBQzFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsSUFBSTtZQUNqQyxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLHdDQUF3QyxDQUFDLENBQUM7O1lBRXhFLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ25FO1NBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLE9BQU8sRUFBRTtRQUNyQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ3ZDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSTtnQkFBRSxPQUFPLENBQUMsc0NBQXNDO1lBQ3BGLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU07Z0JBQUUsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQzVFLDZDQUE2QztZQUM3QyxJQUFJLElBQUksR0FBRyx1QkFBZSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakQsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUM7Z0JBQUUsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1lBQzFFLElBQUksRUFBRSxjQUFjLEVBQUUsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUN4RyxJQUFJLFFBQVEsR0FBRyxzQkFBYyxDQUFDLElBQUksRUFBRSxjQUFjLElBQUk7Z0JBQ3JELDZDQUE2QztnQkFDN0MsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUztnQkFDN0IsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDMUIsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQzthQUMzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ2QsSUFBSSxRQUFRLEVBQUU7Z0JBQ2IsS0FBSyxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDLGtCQUFrQixFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBQzNILEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7YUFDM0I7aUJBQU07Z0JBQ04sS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUscUJBQXFCLENBQUMsQ0FBQzthQUM5QztRQUNGLENBQUMsQ0FBQyxDQUFBO0tBQ0Y7U0FBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssUUFBUSxFQUFFO1FBQ3RDLEtBQUssQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUNELE9BQU87SUFDUCx3R0FBd0csQ0FBQTtRQUN2RyxNQUFNLEVBQUUsd0JBQXdCLEVBQUUsbUJBQW1CLEVBQUUsb0JBQW9CLEVBQUUsMkJBQTJCLEVBQUUsa0JBQWtCLEVBQUUsV0FBVyxFQUFFLEdBQUcsdUJBQVMsQ0FBQztRQUN4SixJQUFJLElBQUksR0FBRyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM3Qyx5RUFBeUU7UUFDekUsSUFBSSxVQUFVLEdBQUcsa0JBQWtCLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDbkcsSUFBSSxNQUFNLEdBQUcsQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDMUUsSUFBSSxNQUFNLEdBQUcsb0JBQW9CLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNoRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BCLElBQUksT0FBTyxHQUFHO1lBQ2IsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1lBQ2pDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztTQUN6QixDQUFBO1FBQ0QseURBQXlEO1FBQ3pELElBQUksS0FBSyxHQUFHLDJCQUEyQixDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDaEg7SUFFRCx3REFBd0QsQ0FBQTtRQUN2RCxNQUFNLEVBQUUsNkJBQTZCLEVBQUUsNkJBQTZCLEVBQUUsaUJBQWlCLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQUUscUJBQXFCLEVBQUUsR0FBRyx1QkFBUyxDQUFDO1FBRXRLLElBQUksVUFBVSxHQUFHLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2pELElBQUksZUFBZSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFdEQsSUFBSSxVQUFVLEdBQUcsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDakQsSUFBSSxlQUFlLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUV0RCwrQkFBK0I7UUFFL0IsSUFBSSxhQUFhLEdBQUcsNkJBQTZCLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxlQUFlLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUMzSSxJQUFJLFdBQVcsR0FBRyx1QkFBUyxDQUFDLGtCQUFrQixDQUM3QyxJQUFJLENBQUMsR0FBRyxDQUFDLHVCQUFTLENBQUMsNEJBQTRCLEVBQUUsQ0FBQyxDQUFDO1FBQ25ELHFDQUFxQztRQUNyQyxTQUFTLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEVBQ3JFLFNBQVMsRUFBRSxZQUFZLENBQ3ZCLENBQUM7UUFFRixJQUFJLGFBQWEsR0FBRyw2QkFBNkIsQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLGVBQWUsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzNJLElBQUksV0FBVyxHQUFHLHVCQUFTLENBQUMsa0JBQWtCLENBQzdDLElBQUksQ0FBQyxHQUFHLENBQUMsdUJBQVMsQ0FBQyw0QkFBNEIsRUFBRSxDQUFDLENBQUM7UUFDbkQscUNBQXFDO1FBQ3JDLFNBQVMsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsU0FBUyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsRUFDckUsU0FBUyxFQUFFLFlBQVksQ0FDdkIsQ0FBQztRQUVGLDBEQUEwRDtRQUMxRCxJQUFJLFdBQVcsS0FBSyxXQUFXO1lBQUUsTUFBTSx3Q0FBd0MsQ0FBQztRQUVoRixvQ0FBb0M7UUFDcEMsSUFBSSxLQUFLLEdBQUcsZUFBZSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2hDLElBQUksWUFBWSxHQUFHLHFCQUFxQixDQUFDLHNCQUFzQixFQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRTFHLHVCQUF1QjtRQUN2QixJQUFJLFlBQVksR0FBRyx1QkFBUyxDQUFDLDBCQUEwQixDQUFDLFlBQVksRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQ3JHO0FBRUYsQ0FBQztBQTFHRCwwQ0EwR0MifQ==