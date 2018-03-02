const newLineCharCode = "\n".charCodeAt(0);
const newLineArrayBuffer = new Uint8Array([newLineCharCode]).buffer;
function httpRequest(options) {
	return new Promise((resolve, reject) => {
		if (typeof options === "string") {
			options = { url: options }
		}
		options.returnProp = "response";
		options.callback = function (err, data) {
			if (err) reject(err);
			else resolve(data);
		}
		var req = $tw.utils.httpRequest(options);
		req.responseType = 'arraybuffer';
	})
}
function parseTransferFormat() {
	var res = new ArrayBuffer(16);
	var res1 = new Uint8Array(res);
	var nl1 = res1.indexOf(newLineCharCode);
	var header = res1.slice(0, nl1);
	var nl2 = res1.indexOf(newLineCharCode, nl1 + 1);
	var encoding = utf8Array2string(res1.slice(nl1 + 1, nl2));
	var text = res1.slice(nl2 + 1);
	utf8Array2string(header);
	if (encoding === "base64")
		text = encodeBase64(text);
	else
		text = utf8Array2string(text);
	header = JSON.parse(header);
	return { header, text };
}
function encodeTransferFormat() {
	var tiddler = { fields: { type: "", title: "", text: "" } };
	var fields = Object.assign({}, tiddler.fields);
	var text = fields.text;
	delete fields.text;
	var typeInfo = $tw.config.contentTypeInfo[tiddler.fields.type || "text/plain"] || { encoding: "utf8" }
	var header = string2utf8Array(JSON.stringify(fields));
	var encoding = string2utf8Array(typeinfo.encoding);
	if (encoding === "base64")
		text = decodeBase64(text);
	else //utf8 is default
		text = string2utf8Array(text);
	return concatArrayBuffer([header, newLineArrayBuffer, encoding, newLineArrayBuffer, text]);
}
/**
 * 
 * 
 * @param {ArrayBuffer[]} arrayBuffers 
 */
function concatArrayBuffer(arrayBuffers) {
	var total = arrayBuffers.reduce((n, e) => n + e.byteLength, 0);
	var out = new Uint8Array(total);
	var position = 0;
	arrayBuffers.forEach(e => {
		var t = new Uint8Array(e);
		t.forEach(e => {
			out[position] = e;
			position++;
		})
	})
	return out;
}
//https://stackoverflow.com/a/22373135/258482
function utf8Array2string(array) {
	var out, i, len, c;
	var char2, char3;

	out = "";
	len = array.length;
	i = 0;
	while (i < len) {
		c = array[i++];
		switch (c >> 4) {
			case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
				// 0xxxxxxx
				out += String.fromCharCode(c);
				break;
			case 12: case 13:
				// 110x xxxx   10xx xxxx
				char2 = array[i++];
				out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
				break;
			case 14:
				// 1110 xxxx  10xx xxxx  10xx xxxx
				char2 = array[i++];
				char3 = array[i++];
				out += String.fromCharCode(((c & 0x0F) << 12) |
					((char2 & 0x3F) << 6) |
					((char3 & 0x3F) << 0));
				break;
		}
	}

	return out;
}

function string2utf8Array(str) {
	var i, len = str.length, c, newlen = 0;
	for (i = 0; i < len; i++) {
		c = str.charCodeAt(i);
		if ((c >= 0x0001) && (c <= 0x007F))
			newlen += 1;
		else if (c > 0x07FF)
			newlen += 3;
		else
			newlen += 2;
	}
	var out = new ArrayBuffer(newlen), outi = 0;
	for (i = 0; i < len; i++) {
		c = str.charCodeAt(i);
		if ((c >= 0x0001) && (c <= 0x007F)) {
			out[i] = c
			outi += 1;
		} else if (c > 0x07FF) {
			out[i + 0] = String.fromCharCode(0xE0 | ((c >> 12) & 0x0F));
			out[i + 1] = String.fromCharCode(0x80 | ((c >> 6) & 0x3F));
			out[i + 2] = String.fromCharCode(0x80 | ((c >> 0) & 0x3F));
			outi += 3;
		} else {
			out[i + 0] = String.fromCharCode(0xC0 | ((c >> 6) & 0x1F));
			out[i + 1] = String.fromCharCode(0x80 | ((c >> 0) & 0x3F));
			outi += 2;
		}
	}
	return out;
}
function encodeBase64(arrayBuffer) {
	var base64 = ''
	var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

	var bytes = new Uint8Array(arrayBuffer)
	var byteLength = bytes.byteLength
	var byteRemainder = byteLength % 3
	var mainLength = byteLength - byteRemainder

	var a, b, c, d
	var chunk

	// Main loop deals with bytes in chunks of 3
	for (var i = 0; i < mainLength; i = i + 3) {
		// Combine the three bytes into a single integer
		chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

		// Use bitmasks to extract 6-bit segments from the triplet
		a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
		b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
		c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
		d = chunk & 63               // 63       = 2^6 - 1

		// Convert the raw binary segments to the appropriate ASCII encoding
		base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
	}

	// Deal with the remaining bytes and padding
	if (byteRemainder == 1) {
		chunk = bytes[mainLength]

		a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

		// Set the 4 least significant bits to zero
		b = (chunk & 3) << 4 // 3   = 2^2 - 1

		base64 += encodings[a] + encodings[b] + '=='
	} else if (byteRemainder == 2) {
		chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

		a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
		b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

		// Set the 2 least significant bits to zero
		c = (chunk & 15) << 2 // 15    = 2^4 - 1

		base64 += encodings[a] + encodings[b] + encodings[c] + '='
	}
	return base64;
}

function decodeBase64(input, arrayBuffer) {
	const _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
	function decodeArrayBuffer(input) {
		var bytes = (input.length / 4) * 3;
		var ab = new ArrayBuffer(bytes);
		decode(input, ab);

		return ab;
	}
	function removePaddingChars(input) {
		var lkey = _keyStr.indexOf(input.charAt(input.length - 1));
		if (lkey == 64) {
			return input.substring(0, input.length - 1);
		}
		return input;
	}
	//get last chars to see if are valid
	input = removePaddingChars(input);
	input = removePaddingChars(input);

	var bytes = parseInt((input.length / 4) * 3, 10);

	var uarray = new Uint8Array(0);
	var chr1, chr2, chr3;
	var enc1, enc2, enc3, enc4;
	var i = 0;
	var j = 0;

	if (arrayBuffer)
		uarray = new Uint8Array(arrayBuffer);
	else
		uarray = new Uint8Array(bytes);

	input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

	for (i = 0; i < bytes; i += 3) {
		//get the 3 octects in 4 ascii chars
		enc1 = _keyStr.indexOf(input.charAt(j++));
		enc2 = _keyStr.indexOf(input.charAt(j++));
		enc3 = _keyStr.indexOf(input.charAt(j++));
		enc4 = _keyStr.indexOf(input.charAt(j++));

		chr1 = (enc1 << 2) | (enc2 >> 4);
		chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
		chr3 = ((enc3 & 3) << 6) | enc4;

		uarray[i] = chr1;
		if (enc3 != 64) uarray[i + 1] = chr2;
		if (enc4 != 64) uarray[i + 2] = chr3;
	}

	return uarray.buffer;

}
