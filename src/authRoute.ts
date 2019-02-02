import { StateObject, ServerEventEmitter, tryParseJSON, ER } from "./server-types";
import { EventEmitter } from "events";
import * as crypto from "crypto";
import { libsodium, ws as WebSocket } from "../lib/bundled-lib";
import { TLSSocket } from "tls";

const sockets: WebSocket[] = [];
const state: {}[] = [];

export function initAuthRoute(eventer: ServerEventEmitter) {
	eventer.on("websocket-connection", (client, request) => {
		if (request.url === "/admin/authenticate") {
			sockets.push(client);
			client.on("message", handleSocketMessage);
		}
	})
}
// type actions = "sendKey" | "recieveKey";
function handleSocketMessage(this: WebSocket, data: WebSocket.Data) {
	if (typeof data === "string") {
		let message = tryParseJSON(data);
		if (!message) return;

	} else {
		let binaryType = this.binaryType as "nodebuffer" | "arraybuffer" | "fragments";
		let buffer = binaryType === "arraybuffer" ? Buffer.from(data as ArrayBuffer) : data as Buffer;

	}

}
const pko: Record<string, { step: number, cancelTimeout: NodeJS.Timer, sender?: StateObject, reciever?: StateObject }> = {};
type actions = "sendKey" | "recieveKey" | "login" | "logout"
interface keyActionStep1 { step: 1, pendingPin: string; publicKey: string; };
interface keyActionStep2 { step: 2, pendingPin: string; encryptedKey: string; }
function removePendingPinTimeout(pin: string) {
	return setTimeout(() => { delete pko[pin] }, 10 * 60 * 1000)
}
function handleKeyAction(state: StateObject, direction: "sender" | "reciever") {
	state.recieveBody(true).then(() => {
		if (state.body.length && !state.json) return;
		else if (!state.body.length) return state.throwReason(400, "Empty request body");

		let { step, pendingPin: k } = state.json as keyActionStep1 | keyActionStep2;
		if (pko[k].step !== step)
			return state.throwReason(400, "Wrong step specified");
		pko[k][direction] = state;

		if (step === 1) {
			let step1 = pko[k];
			if (!step1.sender || !step1.reciever) return;
			clearTimeout(pko[k].cancelTimeout);
			step1.sender.respond(200).json({ publicKey: step1.reciever.json.publicKey });
			step1.reciever.respond(200).json({ publicKey: step1.sender.json.publicKey });
			pko[k] = { step: 2, cancelTimeout: removePendingPinTimeout(k) }
		} else if (step === 2) {
			let step2 = pko[k];
			if (!step2.sender || !step2.reciever) return;
			clearTimeout(pko[k].cancelTimeout);
			step2.sender.respond(200).empty();
			step2.reciever.respond(200).json({ encryptedKey: step2.sender.json.encryptedKey });
			delete pko[k];
		}
	})
}
function getRandomPin() {
	const MAX = 1000000
	let random = Math.floor(Math.random() * MAX);
	if (random === MAX) random = 999999;
	let key = random.toString();
	key = "000000".slice(6 - key.length) + key;
	//if it already exists we try again
	if (pko[key]) getRandomPin();
	else pko[key] = { step: 1, cancelTimeout: removePendingPinTimeout(key) };
	return key;
}
const DEFAULT_AGE = "2592000";
export function getSetCookie(name: string, value: string, secure: boolean, age: number) {
	// let flags = ["Secure", "HttpOnly", "Max-Age=2592000", "SameSite=Strict"];
	let flags = {
		"Secure": secure,
		"HttpOnly": true,
		"Max-Age": age.toString(),
		"SameSite": "Strict"
	}

	return [
		name + "=" + value,
		...Object.keys(flags).map(k => k + typeof flags[k] === "string" ? "=" + flags[k] : "").filter(e => e)
	].join("; ");
}
/** Handles the /admin/authenticate route */
export function handleAuthRoute(state: StateObject) {
	//state.path[3]: "sendKey" | "recieveKey" | "login" | "logout"
	if (state.req.method !== "POST")
		return state.throw(405);
	if (state.path[3] === "sendKey") {
		handleKeyAction(state, "sender");
	} else if (state.path[3] === "recieveKey") {
		handleKeyAction(state, "reciever");
	} else if (state.path[3] === "pendingPin") {
		let key = getRandomPin();
		state.respond(200).json({ pendingPin: key });
	} else if (state.path[3] === "login") {
		state.recieveBody(true).then(() => {
			state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", state.json.setCookie, false, state.settings.tiddlyserver.authCookieAge));
			state.redirect("/");
		})
	} else if (state.path[3] === "logout") {
		state.setHeader("Set-Cookie", getSetCookie("TiddlyServerAuth", "", false, 0));
	}
	/* Create cookie for authentication. Can only be secured with HTTPS, otherwise anyone can "borrow" it */{
		const { crypto_generichash_BYTES, crypto_sign_keypair, crypto_sign_detached, crypto_sign_verify_detached, crypto_generichash, from_base64 } = libsodium;
		let keys = crypto_sign_keypair("uint8array");
		// Never use the public key included in a message to check its signature.
		let publicHash = crypto_generichash(crypto_generichash_BYTES, keys.publicKey, undefined, "base64");
		let cookie = ["key", "my username", new Date().toISOString(), publicHash];
		let signed = crypto_sign_detached(cookie[0] + cookie[1] + cookie[2], keys.privateKey, "base64");
		cookie.push(signed);
		let request = {
			setCookie: JSON.stringify(signed),
			publicKey: keys.publicKey
		}
		//check the cookie on the server to make sure it is valid
		let valid = crypto_sign_verify_detached(from_base64(signed), cookie[0] + cookie[1] + cookie[2], keys.publicKey);
	}

	/* create secure channel for transferring private key */{
		const { crypto_kx_client_session_keys, crypto_kx_server_session_keys, crypto_kx_keypair, from_base64, to_base64, randombytes_buf, crypto_secretbox_easy } = libsodium;

		let clientKeys = crypto_kx_keypair("uint8array");
		let clientPublicKey = to_base64(clientKeys.publicKey);

		let senderKeys = crypto_kx_keypair("uint8array");
		let senderPublicKey = to_base64(senderKeys.publicKey);

		//exchange the public keys here

		let clientSession = crypto_kx_client_session_keys(clientKeys.publicKey, clientKeys.privateKey, from_base64(senderPublicKey), "uint8array");
		let clientCheck = libsodium.crypto_generichash(
			Math.max(libsodium.crypto_generichash_BYTES_MIN, 8),
			//server_to_client + client_to_server
			to_base64(clientSession.sharedRx) + to_base64(clientSession.sharedTx),
			undefined, "uint8array"
		);

		let senderSession = crypto_kx_server_session_keys(senderKeys.publicKey, senderKeys.privateKey, from_base64(clientPublicKey), "uint8array");
		let senderCheck = libsodium.crypto_generichash(
			Math.max(libsodium.crypto_generichash_BYTES_MIN, 8),
			//server_to_client + client_to_server
			to_base64(senderSession.sharedTx) + to_base64(senderSession.sharedRx),
			undefined, "uint8array"
		);

		// compare the two checks, they should be exactly the same
		if (senderCheck !== clientCheck) throw "aghhhh!! someone messed with our key!!";

		//encrypt the auth key on the sender
		let nonce = randombytes_buf(16);
		let encryptedKey = crypto_secretbox_easy("KEY PAIR OBJECT JSON", nonce, senderSession.sharedTx, "base64");

		//decrypt on the client
		let decryptedKey = libsodium.crypto_secretbox_open_easy(encryptedKey, nonce, clientSession.sharedRx);
	}

}