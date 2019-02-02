"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const bundled_lib_1 = require("../lib/bundled-lib");
const sockets = [];
const state = [];
function initAuthRoute(eventer) {
    eventer.on("websocket-connection", (client, request) => {
        if (request.url === "/admin/authenticate") {
            sockets.push(client);
            client.on("message", handleSocketMessage);
        }
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
            state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", state.json.setCookie, false, state.settings.tiddlyserver.authCookieAge));
            state.redirect("/");
        });
    }
    else if (state.path[3] === "logout") {
        state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", "", false, 0));
    }
    /* Create cookie for authentication. Can only be secured with HTTPS, otherwise anyone can "borrow" it */ {
        const { crypto_generichash_BYTES, crypto_sign_keypair, crypto_sign, crypto_sign_open, crypto_generichash } = bundled_lib_1.libsodium;
        let keys = crypto_sign_keypair("uint8array");
        // Never use the public key included in a message to check its signature.
        let publicHash = crypto_generichash(crypto_generichash_BYTES, keys.publicKey, undefined, "base64");
        let message = JSON.stringify({ username: "hello world", timestamp: new Date().toISOString(), publicKey: publicHash });
        let signed = crypto_sign(message, keys.privateKey, "base64");
        let request = {
            setCookie: signed,
            publicKey: keys.publicKey
        };
        //check the cookie on the server to make sure it is valid
        let valid = crypto_sign_open(signed, keys.publicKey, "text");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aFJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXV0aFJvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaURBQW1GO0FBR25GLG9EQUFnRTtBQUdoRSxNQUFNLE9BQU8sR0FBZ0IsRUFBRSxDQUFDO0FBQ2hDLE1BQU0sS0FBSyxHQUFTLEVBQUUsQ0FBQztBQUV2Qix1QkFBOEIsT0FBMkI7SUFDeEQsT0FBTyxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBRTtRQUN0RCxJQUFJLE9BQU8sQ0FBQyxHQUFHLEtBQUsscUJBQXFCLEVBQUU7WUFDMUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyQixNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1NBQzFDO0lBQ0YsQ0FBQyxDQUFDLENBQUE7QUFDSCxDQUFDO0FBUEQsc0NBT0M7QUFDRCwyQ0FBMkM7QUFDM0MsNkJBQThDLElBQW9CO0lBQ2pFLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO1FBQzdCLElBQUksT0FBTyxHQUFHLDJCQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLE9BQU87WUFBRSxPQUFPO0tBRXJCO1NBQU07UUFDTixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBd0QsQ0FBQztRQUMvRSxJQUFJLE1BQU0sR0FBRyxVQUFVLEtBQUssYUFBYSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBYyxDQUFDO0tBRTlGO0FBRUYsQ0FBQztBQUNELE1BQU0sR0FBRyxHQUFnSCxFQUFFLENBQUM7QUFFaEQsQ0FBQztBQUU3RSxpQ0FBaUMsR0FBVztJQUMzQyxPQUFPLFVBQVUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxPQUFPLEdBQUcsQ0FBQyxHQUFHLENB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