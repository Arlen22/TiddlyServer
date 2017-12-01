/*\
title: ./ws.js
type: application/javascript
module-type: library
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */


/*!
 * ws: a node.js websocket client
 * Copyright(c) 2011 Einar Otto Stangvik <einaros@gmail.com>
 * MIT Licensed
 */

'use strict';

const WebSocket = require('./WebSocket');

WebSocket.Server = require('./WebSocketServer');
WebSocket.Receiver = require('./Receiver');
WebSocket.Sender = require('./Sender');

module.exports = WebSocket;

})();
