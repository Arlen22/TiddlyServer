/*\
title: ./Constants.js
type: application/javascript
module-type: library
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */

'use strict';

const safeBuffer = require('../safe-buffer/safeBuffer.js');

const Buffer = safeBuffer.Buffer;

exports.BINARY_TYPES = ['nodebuffer', 'arraybuffer', 'fragments'];
exports.GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
exports.EMPTY_BUFFER = Buffer.alloc(0);
exports.NOOP = () => {};

})();
