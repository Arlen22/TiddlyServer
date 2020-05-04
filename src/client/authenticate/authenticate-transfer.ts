declare var ReactDOM: any;
{
	let libsodium: typeof import("libsodium-wrappers");

	const byID = <T extends HTMLElement>(id: string) => {
		return document.getElementById(id) as T;
	}

	async function handleSecureTransfer(sender: boolean) {
		const { 
			crypto_kx_client_session_keys, 
			crypto_kx_server_session_keys, 
			crypto_kx_keypair, 
			crypto_secretbox_easy, 
			crypto_secretbox_open_easy,
			crypto_generichash,
			from_base64, 
			to_base64, 
			randombytes_buf, 
			increment,
			memzero
		} = libsodium;
		function getPendingPin(sender: boolean) {
			if (sender) return fetch("/admin/authenticate/pendingpin", { method: "POST" })
				.then(res => res.json())
				.then((json: { pendingPin: string }) => json.pendingPin);
			else return byID<HTMLInputElement>("pendingpin").value;
		}
		function exchangeData(pin: string, sender: boolean, body: BodyInit) {
			return fetch("/admin/authenticate/transfer/" + pin + "/" + (sender ? "sender" : "reciever"), { method: "POST", body })
		}
		let pin = await getPendingPin(sender);
		let thisKey = crypto_kx_keypair("uint8array");
		let thisPublicKey = to_base64(thisKey.publicKey);
		let thatPublicKey = await exchangeData(pin, sender, thisPublicKey).then(res => res.text());
		let session = crypto_kx_client_session_keys(thisKey.publicKey, thisKey.privateKey, from_base64(thatPublicKey), "uint8array");
		let check = libsodium.crypto_generichash(
			Math.max(libsodium.crypto_generichash_BYTES_MIN, 8),
			sender
				? to_base64(session.sharedTx) + to_base64(session.sharedRx) + pin
				: to_base64(session.sharedRx) + to_base64(session.sharedTx) + pin,
			undefined,
			"uint8array"
		);
		let sendNonce = new Uint8Array(8);
		let recvNonce = new Uint8Array(8);
		memzero(sendNonce);
		memzero(recvNonce);
		let encrypt = (data: string | Uint8Array) => {
			increment(sendNonce);
			return crypto_secretbox_easy(data, sendNonce, session.sharedTx, "base64");
		}
		let decrypt = (data: string | Uint8Array) => {
			increment(recvNonce);
			return crypto_secretbox_open_easy(data, recvNonce, session.sharedRx);
		}
		return { encrypt, decrypt };
	}


}