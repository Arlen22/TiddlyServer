"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const bundled_lib_1 = require("../lib/bundled-lib");
const sockets = [];
const state = [];
const setAuth = (settings) => {
    // let ca: Record<string, x509.Certificate[]> = {};
    // let up: [string, string, string][] = [] as any;
    let publicKeyLookup = {};
    let passwordLookup = {};
    const { crypto_generichash, crypto_generichash_BYTES, crypto_sign_SECRETKEYBYTES, crypto_sign_keypair, crypto_sign_open, from_base64, crypto_sign_verify_detached, randombytes_buf } = bundled_lib_1.libsodium;
    let passwordKey = crypto_sign_keypair("uint8array");
    Object.keys(settings.authAccounts).forEach(k => {
        let e = settings.authAccounts[k];
        if (e.clientKeys)
            Object.keys(e.clientKeys).forEach(u => {
                const publicKey = e.clientKeys[u];
                let publicHash = crypto_generichash(crypto_generichash_BYTES, publicKey, undefined, "base64");
                if (!publicKeyLookup[publicHash + u])
                    publicKeyLookup[publicHash + u] = k;
                else
                    throw "publicKey+username combination is used for more than one authAccount";
            });
        if (e.passwords)
            Object.keys(e.passwords).forEach(u => {
                const password = e.passwords[u];
                let passHash = crypto_generichash(crypto_generichash_BYTES, password, undefined, "base64");
                if (!passwordLookup[u])
                    passwordLookup[u] = k;
                else
                    throw "username is used for more than one authAccount password list";
            });
    });
    exports.checkCookieAuth = (request) => {
        if (!request.headers.cookie)
            return "";
        var cookies = {}, rc = request.headers.cookie;
        rc.split(';').forEach(function (cookie) {
            var parts = cookie.split('=');
            cookies[parts.shift().trim()] = parts.length ? decodeURI(parts.join('=')) : "";
        });
        let auth = cookies["TiddlyServerAuth"];
        if (!auth)
            return "";
        let json = server_types_1.tryParseJSON(auth);
        if (!json)
            return "";
        return exports.validateCookie(json);
    };
    exports.validateCookie = (json) => {
        let [type, username, timestamp, hash, sig] = json;
        let valid = crypto_sign_verify_detached(from_base64(sig), username + timestamp + hash, type === "key" ? from_base64(publicKeyLookup[hash + username]) : passwordKey.publicKey);
        return valid ? username : "";
    };
};
function initAuthRoute(eventer) {
    eventer.on("websocket-connection", (client, request) => {
        if (request.url === "/admin/authenticate") {
            sockets.push(client);
            client.on("message", handleSocketMessage);
        }
    });
    eventer.on("settings", (set) => {
        setAuth(set);
    });
}
exports.initAuthRoute = initAuthRoute;
// type actions = "sendKey" | "recieveKey";
function handleSocketMessage(data) {
    if (typeof data === "string") {
        let message = server_types_1.tryParseJSON(data);
        if (!message)
            return;
    }
    else {
        let binaryType = this.binaryType;
        let buffer = binaryType === "arraybuffer" ? Buffer.from(data) : data;
    }
}
const pko = {};
;
function removePendingPinTimeout(pin) {
    return setTimeout(() => { delete pko[pin]; }, 10 * 60 * 1000);
}
function handleKeyAction(state, direction) {
    state.recieveBody(true).then(() => {
        if (state.body.length && !state.json)
            return;
        else if (!state.body.length)
            return state.throwReason(400, "Empty request body");
        let { step, pendingPin: k } = state.json;
        if (pko[k].step !== step)
            return state.throwReason(400, "Wrong step specified");
        pko[k][direction] = state;
        if (step === 1) {
            let step1 = pko[k];
            if (!step1.sender || !step1.reciever)
                return;
            clearTimeout(pko[k].cancelTimeout);
            step1.sender.respond(200).json({ publicKey: step1.reciever.json.publicKey });
            step1.reciever.respond(200).json({ publicKey: step1.sender.json.publicKey });
            pko[k] = { step: 2, cancelTimeout: removePendingPinTimeout(k) };
        }
        else if (step === 2) {
            let step2 = pko[k];
            if (!step2.sender || !step2.reciever)
                return;
            clearTimeout(pko[k].cancelTimeout);
            step2.sender.respond(200).empty();
            step2.reciever.respond(200).json({ encryptedKey: step2.sender.json.encryptedKey });
            delete pko[k];
        }
    });
}
function getRandomPin() {
    const MAX = 1000000;
    let random = Math.floor(Math.random() * MAX);
    if (random === MAX)
        random = 999999;
    let key = random.toString();
    key = "000000".slice(6 - key.length) + key;
    //if it already exists we try again
    if (pko[key])
        getRandomPin();
    else
        pko[key] = { step: 1, cancelTimeout: removePendingPinTimeout(key) };
    return key;
}
const DEFAULT_AGE = "2592000";
function getSetCookie(name, value, secure, age) {
    // let flags = ["Secure", "HttpOnly", "Max-Age=2592000", "SameSite=Strict"];
    let flags = {
        "Secure": secure,
        "HttpOnly": true,
        "Max-Age": age.toString(),
        "SameSite": "Strict"
    };
    return [
        name + "=" + value,
        ...Object.keys(flags).map(k => k + typeof flags[k] === "string" ? "=" + flags[k] : "").filter(e => e)
    ].join("; ");
}
exports.getSetCookie = getSetCookie;
/** Handles the /admin/authenticate route */
function handleAuthRoute(state) {
    //state.path[3]: "sendKey" | "recieveKey" | "login" | "logout"
    if (state.req.method !== "POST")
        return state.throw(405);
    if (state.path[3] === "sendKey") {
        handleKeyAction(state, "sender");
    }
    else if (state.path[3] === "recieveKey") {
        handleKeyAction(state, "reciever");
    }
    else if (state.path[3] === "pendingPin") {
        let key = getRandomPin();
        state.respond(200).json({ pendingPin: key });
    }
    else if (state.path[3] === "login") {
        state.recieveBody(true).then(() => {
            if (state.body.length && !state.json)
                return;
            else if (!state.body.length)
                return state.throwReason(400, "Empty request body");
            let json = server_types_1.tryParseJSON(state.json.setCookie, (err) => {
                state.throwError(400, new server_types_1.ER("Invalid JSON in setCookie", err.errorPosition));
            });
            let username = exports.validateCookie(json);
            if (username) {
                state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", state.json.setCookie, false, state.settings.authCookieAge));
                state.respond(200).empty();
                // state.redirect("/");
            }
            else {
                state.throwReason(400, "Invalid cookie in setCookie");
            }
        });
    }
    else if (state.path[3] === "logout") {
        state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", "", false, 0));
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aFJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXV0aFJvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaURBQWlHO0FBR2pHLG9EQUFnRTtBQUloRSxNQUFNLE9BQU8sR0FBZ0IsRUFBRSxDQUFDO0FBQ2hDLE1BQU0sS0FBSyxHQUFTLEVBQUUsQ0FBQztBQUl2QixNQUFNLE9BQU8sR0FBRyxDQUFDLFFBQXNCLEVBQUUsRUFBRTtJQUMxQyxtREFBbUQ7SUFDbkQsa0RBQWtEO0lBQ2xELElBQUksZUFBZSxHQUEyQixFQUFFLENBQUM7SUFDakQsSUFBSSxjQUFjLEdBQTJCLEVBQUUsQ0FBQztJQUNoRCxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsd0JBQXdCLEVBQUUsMEJBQTBCLEVBQUUsbUJBQW1CLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLDJCQUEyQixFQUFFLGVBQWUsRUFBRSxHQUFHLHVCQUFTLENBQUM7SUFDak0sSUFBSSxXQUFXLEdBQUcsbUJBQW1CLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDcEQsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQzlDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakMsSUFBRyxDQUFDLENBQUMsVUFBVTtZQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDdEQsTUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbEMsSUFBSSxVQUFVLEdBQUcsa0JBQWtCLENBQUMsd0JBQXdCLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDOUYsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLEdB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