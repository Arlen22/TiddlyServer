//@ts-check
const fs = require("fs");
const https = require('https');
const tls = require("tls");
/*

To enable HTTPS, add "https": "./https.js" to the settings.json > bindInfo object. 
The path is relative to settings.json, so change it if necessary.

I use acme.sh for managing my certificates https://github.com/Neilpang/acme.sh


This is my issuecert.sh file (The key is RSA 4096)

/root/.acme.sh/acme.sh --issue --standalone -k 4096 -d example.com

This is my installcert.sh file

/root/.acme.sh/acme.sh --install-cert -d icedteadrinker.sandsendhand.net \
--cert-file      /root/TiddlyServer/tiddlyserver-cert.pem  \
--key-file       /root/TiddlyServer/tiddlyserver-key.pem  \
--fullchain-file /root/TiddlyServer/tiddlyserver-fullchain.pem \
--reloadcmd     "pm2 restart 7" << change this to whatever your restart server command is

You should run these as the same user that your restart server command runs under, not as sudo

Change the paths to wherever you have your certificates stored. 

*/


module.exports.serverOptions = function serverOptions (iface) {
	/** @type { import("tls").TlsOptions } Server options object */
	const res = {
    //use require.resolve if you want a file relative to this file
		key: [fs.readFileSync("tiddlyserver.key")], // server key file
		cert: [fs.readFileSync("tiddlyserver.cer")], //server certificate
    // pfx: [fs.readFileSync("server.pfx")], //server pfx (key and cert)
    
		//passphrase for password protected server key and pfx files
		// passphrase: "",
	};
	return res;
}