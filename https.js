//@ts-check
const fs = require("fs");
const https = require('https');
const tls = require("tls");

// use this command to create a new self-signed certificate
// openssl req -x509 -sha256 -nodes -newkey rsa:2048 -days 365 -keyout localhost.key -out localhost.crt

module.exports = function (iface) {
	/** @type { import("tls").TlsOptions } Server options object */
	const serveroptions = {
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
	return serveroptions;
}