var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
{
    let libsodium;
    const byID = (id) => {
        return document.getElementById(id);
    };
    function handleSecureTransfer(sender) {
        return __awaiter(this, void 0, void 0, function* () {
            const { crypto_kx_client_session_keys, crypto_kx_server_session_keys, crypto_kx_keypair, crypto_secretbox_easy, crypto_secretbox_open_easy, crypto_generichash, from_base64, to_base64, randombytes_buf, increment, memzero } = libsodium;
            function getPendingPin(sender) {
                if (sender)
                    return fetch("/admin/authenticate/pendingpin", { method: "POST" })
                        .then(res => res.json())
                        .then((json) => json.pendingPin);
                else
                    return byID("pendingpin").value;
            }
            function exchangeData(pin, sender, body) {
                return fetch("/admin/authenticate/transfer/" + pin + "/" + (sender ? "sender" : "reciever"), { method: "POST", body });
            }
            let pin = yield getPendingPin(sender);
            let thisKey = crypto_kx_keypair("uint8array");
            let thisPublicKey = to_base64(thisKey.publicKey);
            let thatPublicKey = yield exchangeData(pin, sender, thisPublicKey).then(res => res.text());
            let session = crypto_kx_client_session_keys(thisKey.publicKey, thisKey.privateKey, from_base64(thatPublicKey), "uint8array");
            let check = libsodium.crypto_generichash(Math.max(libsodium.crypto_generichash_BYTES_MIN, 8), sender
                ? to_base64(session.sharedTx) + to_base64(session.sharedRx) + pin
                : to_base64(session.sharedRx) + to_base64(session.sharedTx) + pin, undefined, "uint8array");
            let sendNonce = new Uint8Array(8);
            let recvNonce = new Uint8Array(8);
            memzero(sendNonce);
            memzero(recvNonce);
            let encrypt = (data) => {
                increment(sendNonce);
                return crypto_secretbox_easy(data, sendNonce, session.sharedTx, "base64");
            };
            let decrypt = (data) => {
                increment(recvNonce);
                return crypto_secretbox_open_easy(data, recvNonce, session.sharedRx);
            };
            return { encrypt, decrypt };
        });
    }
}
