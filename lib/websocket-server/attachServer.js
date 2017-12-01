/*\
title: $:/plugins/arlen22/WebSocketServer/attachServer.js
type: application/javascript
module-type: startup

Listens to the hook `th-server-command-start` and attaches the WebSocket server to the HTTP server

Listens for the `th-websocket-broadcast` hook and sends the message to all clients except the clients
included in the ignore array.

Invokes the `th-websocket-message` hook when a message comes in from a client. 

\*/

(function () {

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";

	// Export name and synchronous status
	exports.name = "attach-websocket-server";
	exports.platforms = ["node"];
	exports.before = ["commands"];
	exports.synchronous = true;

	exports.startup = function () {
		//tiddlyserver never calls this hook because the server command execute function is never called
		$tw.hooks.addHook('th-server-command-start', function (simpleServer, nodeServer) {
			var WebSocketServer = require('./WS/ws.js').Server;
			var fs = require('fs');
			console.log('Setup server');
			var wss = new WebSocketServer({ server: nodeServer });
			//https://github.com/websockets/ws/blob/master/doc/ws.md
			// Set the onconnection function
			var connections = [];
			$tw.hooks.addHook('th-websocket-broadcast', function (message, ignore) {
				ignore = ignore || [];
				if (typeof message === 'object') message = JSON.stringify(message);
				else if (typeof message !== "string") message = message.toString();
				connections.forEach(e => {
					if(ignore.indexOf(e) > -1) return;
					e.send(message);
				})
			})
			wss.on('connection', function (client, request) {
				connections.push(client);
				console.log('New connection');
				var prefix = simpleServer.variables.pathPrefix;
				// var reqPath = new URL(request.url);
				if (request.url.pathname !== prefix) {
					client.close(404, "Path not found");
					return;
				}
				client.on('message', function (event) {
					$tw.hooks.invokeHook('th-websocket-message', event.data, client);
				})
				client.on('close', function () {
					var index = connections.findIndex(e => client === e);
					connections.splice(index, 1);
				})
			});
		});
	};
})();
