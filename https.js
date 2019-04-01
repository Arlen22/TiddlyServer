//@ts-check
const fs = require("fs");
const https = require('https');
const tls = require("tls");
/*

To enable HTTPS, add "https": "./https.js" to the settings.json > bindInfo object. 
The path is relative to settings.json, so change it if necessary.

To generate a key and cert, use the following command on linux or mac 
(sorry, not sure how to get openssl for windows yet).

openssl req -x509 -sha256 -nodes -newkey rsa:2048 -days 365 -keyout tiddlyserver.key -out tiddlyserver.cer

openssl req -x509 -out localhost.cer -keyout localhost.key -days 365 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -extensions EXT -config <( printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")

https://letsencrypt.org/docs/certificates-for-localhost/

Don't forget to set port 443 in bindInfo instead of port 80, otherwise you need to specify which port to connect to.

*/


module.exports.serverOptions = function serverOptions (iface) {
	/** @type { import("tls").TlsOptions } Server options object */
	const res = {
		key: [fs.readFileSync("tiddlyserver.key")], // server key file
		cert: [fs.readFileSync("tiddlyserver.cer")], //server certificate
		// pfx: [fs.readFileSync("server.pfx")], //server pfx (key and cert)
		//passphrase for password protected server key and pfx files
		// passphrase: "",
		//list of certificate authorities for client certificates
		// ca: [fs.readFileSync("clients-laptop.cer")],
		//request client certificate
		// requestCert: true,
		//reject connections from clients that cannot present a certificate signed by one of the ca certificates
		// rejectUnauthorized: false,
	};
	return res;
}