declare var ReactDOM: any;

{
	let { salts } = window as any;
	const byID = <T extends HTMLElement>(id: string) => {
		return document.getElementById(id) as T;
	}
	(window as any).tiddlyserverLogout = async () => {
		let res = await fetch("/admin/authenticate/logout", {
			method: "POST"
		}).then(() => {
			byID<HTMLDivElement>("error-line").style.display = "none";
			byID<HTMLDivElement>("success-line").style.display = "";
			byID<HTMLDivElement>("success-line").innerHTML = "<li>" + new Date().toISOString().slice(11,19) + " - Successfully logged out, you may press Back to return to your previous page, then refresh" + "</li>";
		})
	}
	(window as any).tiddlyserverLogin = async () => {
		// debugger;
		if (!(window as any).sodium) { console.log("Sodium is not ready"); return; }

		const {
			crypto_generichash_BYTES,
			crypto_sign_keypair,
			crypto_sign_seed_keypair,
			crypto_sign_detached,
			crypto_sign_SEEDBYTES,
			crypto_sign_verify_detached,
			crypto_generichash,
			randombytes_buf,
			from_base64,
			to_base64,
			crypto_pwhash,
			crypto_pwhash_MEMLIMIT_INTERACTIVE,
			crypto_pwhash_OPSLIMIT_INTERACTIVE,
			crypto_pwhash_SALTBYTES,
			crypto_pwhash_ALG_ARGON2ID13
		} = (window as any).sodium as typeof import("libsodium-wrappers");

		// Generate private key from the password, salted with the username
		// The username and password are both salted with a known constant to keep hash lookup tables
		// from being reused.
		let username = byID<HTMLInputElement>("username").value;
		let userhash = crypto_generichash(crypto_pwhash_SALTBYTES, salts.username + username, undefined, "uint8array");
		let password = byID<HTMLInputElement>("password").value;
		let passhash = crypto_pwhash(crypto_sign_SEEDBYTES, password, userhash, crypto_pwhash_OPSLIMIT_INTERACTIVE, crypto_pwhash_MEMLIMIT_INTERACTIVE, crypto_pwhash_ALG_ARGON2ID13)
		let keys = crypto_sign_seed_keypair(passhash, "uint8array");
		// Never use the public key included in a message to check its signature,
		// so hash it once to prevent PEBKAC
		let publicHash = crypto_generichash(crypto_generichash_BYTES, keys.publicKey, undefined, "base64");
		let cookie = [username, "key", new Date().toISOString(), publicHash];
		console.log(cookie[0] + cookie[2] + cookie[3]);
		let signed = crypto_sign_detached(cookie[0] + cookie[2] + cookie[3], keys.privateKey, "base64");
		cookie.push(signed);
		let request = { setCookie: (cookie.join("|")), publicKey: to_base64(keys.publicKey) };
		let loginFailed = [to_base64(keys.publicKey), username, cookie[2]].join("\n");
		console.log(cookie);
		console.log(to_base64(keys.publicKey));
		let res = await fetch("/admin/authenticate/login", {
			method: "POST", body: JSON.stringify(request)
		});

		if (res.status >= 400) {
			if (res.statusText === "INVALID_CREDENTIALS") {
				byID<HTMLDivElement>("success-line").style.display = "none";
				byID<HTMLDivElement>("error-line").style.display = "";
				byID<HTMLDivElement>("error-line").innerHTML = "<li>" + new Date().toISOString().slice(11, 19) + " - Invalid username or password" + "</li>";
			} else {
				byID<HTMLDivElement>("success-line").style.display = "none";
				byID<HTMLDivElement>("error-line").style.display = "";
				byID<HTMLDivElement>("error-line").innerHTML = "<li>" + new Date().toISOString().slice(11, 19) + " - An unknown error occured" + "</li>";
			}
			let body = await res.text();
			console.log("Login failed for some reason", res.status, res.statusText);
			console.log(request);
			console.log(body);
			console.log(loginFailed);
		} else {
			byID<HTMLDivElement>("error-line").style.display = "none";
			byID<HTMLDivElement>("success-line").style.display = "";
			byID<HTMLDivElement>("success-line").innerHTML = "<li>" + new Date().toISOString().slice(11,19) + " - Successfully logged in, you may press Back to return to your previous page, then refresh" + "</li>";
		}
	}
}