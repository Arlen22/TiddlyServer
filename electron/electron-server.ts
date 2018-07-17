/// <reference types="node"/>

import { initServer } from '../src/server';
import { Socket } from 'net';
import { ServerEventEmitter } from '../src/server-types';

let trustNonce = "";
let config: {
	allowed: string[];
};
let eventer: ServerEventEmitter
///@ts-ignore
process.on("message", (message: string, handle: Socket) => {
	if (message.startsWith("JSON")) {
		var json = JSON.parse(message.slice(4));
		if (json.code === "startup") {
			trustNonce = json.nonce;
			config = json.config;
			eventer = initServer({
				env: "node",
				preflightRequests: (ev) => {
					return new Promise((resolve) => {
						if (trustNonce && ev.request.headers["x-tiddlyserver-trust"] === trustNonce)
							ev.trusted = true;
						else
							ev.trusted = false;
						
						if(!ev.trusted && config.allowed.indexOf(ev.interface) === -1){
							ev.response.writeHead(403);
							ev.response.end();
							ev.handled = true;
						}
						
						resolve(ev);
					})
				}
			});
		}
	}
})

process.send("JSON" + JSON.stringify({ code: "sendTrustNonce" }));


