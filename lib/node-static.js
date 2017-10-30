var fs = require('fs')
    , events = require('events')
    , buffer = require('buffer')
    , http = require('http')
    , url = require('url')
    , path = require('path')
    , mime = require('./mime')
    , util = require('./node-static-util')
    , stream = require('stream')
    , zlib = require('zlib');

// Current version
var version = [0, 7, 9];

var Server = function (root, options) {
    if (root && (typeof (root) === 'object')) { options = root; root = null }

    // resolve() doesn't normalize (to lowercase) drive letters on Windows
    this.root = path.normalize(path.resolve(root || '.'));
    this.options = options || {};
    this.cache = 3600;

    this.mount = this.options.mount.split('/').filter((a, i) => a || i === 0).join('/') || "";

    this.defaultHeaders = {};
    this.options.headers = this.options.headers || {};

    this.options.indexFile = this.options.indexFile || "index.html";

    if ('cache' in this.options) {
        if (typeof (this.options.cache) === 'number') {
            this.cache = this.options.cache;
        } else if (!this.options.cache) {
            this.cache = false;
        }
    }

    if ('serverInfo' in this.options) {
        this.serverInfo = this.options.serverInfo.toString();
    } else {
        this.serverInfo = 'node-static/' + version.join('.');
    }

    this.defaultHeaders['server'] = this.serverInfo;

    if (this.cache !== false) {
        this.defaultHeaders['cache-control'] = 'max-age=' + this.cache;
    }

    for (var k in this.defaultHeaders) {
        this.options.headers[k] = this.options.headers[k] ||
            this.defaultHeaders[k];
    }
};

Server.prototype.serveDir = function (pathname, req, res, finish) {
    var htmlIndex = path.join(pathname, this.options.indexFile),
        that = this;

    fs.stat(htmlIndex, function (e, stat) {
        if (!e) {
            var status = 200;
            var headers = {};
            var originalPathname = decodeURI(url.parse(req.url).pathname);
            if (originalPathname.length && originalPathname.charAt(originalPathname.length - 1) !== '/') {
                return finish(301, { 'Location': originalPathname + '/' });
            } else {
                that.respond(null, status, headers, [htmlIndex], stat, req, res, finish);
            }
        } else {
            // Stream a directory of files as a single file.
            fs.readFile(path.join(pathname, 'index.json'), function (e, contents) {
                if (e) { return finish(404, {}) }
                var index = JSON.parse(contents);
                streamFiles(index.files);
            });
        }
    });
    function streamFiles(files) {
        util.mstat(pathname, files, function (e, stat) {
            if (e) { return finish(404, {}) }
            that.respond(pathname, 200, {}, files, stat, req, res, finish);
        });
    }
};

Server.prototype.serveFile = function (pathname, status, headers, req, res) {
    var that = this;
    var promise = new (events.EventEmitter);

    pathname = this.resolve(pathname);

    fs.stat(pathname, function (e, stat) {
        if (e) {
            return promise.emit('error', e);
        }
        that.respond(null, status, headers, [pathname], stat, req, res, function (status, headers) {
            that.finish(status, headers, req, res, promise);
        });
    });
    return promise;
};

Server.prototype.finish = function (status, headers, req, res, promise, callback) {
    var result = {
        status: status,
        headers: headers,
        message: http.STATUS_CODES[status]
    };

    headers['server'] = this.serverInfo;

    if (!status || status >= 400) {
        if (callback) {
            callback(result);
        } else {
            if (promise.listeners('error').length > 0) {
                promise.emit('error', result);
            }
            else {
                res.writeHead(status, headers);
                res.end();
            }
        }
    } else {
        // Don't end the request here, if we're streaming;
        // it's taken care of in `prototype.stream`.
        if (status !== 200 || req.method !== 'GET') {
            res.writeHead(status, headers);
            res.end();
        }
        callback && callback(null, result);
        promise.emit('success', result);
    }
};

Server.prototype.servePath = function (pathname, status, headers, req, res, finish) {
    var that = this,
        promise = new (events.EventEmitter);

    if (this.mount && pathname.indexOf(this.mount) === 0)
        pathname = pathname.slice(this.mount.length);
    else if (this.mount) {
        // Forbidden, don't serve files for the wrong prefix!
        finish(403, {});
    }

    pathname = this.resolve(pathname);

    // Make sure we're not trying to access a
    // file outside of the root.
    if (pathname.indexOf(that.root) === 0) {
        fs.stat(pathname, function (e, stat) {
            if (e) {
                finish(404, {});
            } else if (stat.isFile()) {      // Stream a single file.
                that.respond(null, status, headers, [pathname], stat, req, res, finish);
            } else if (stat.isDirectory()) { // Stream a directory of files.
                that.serveDir(pathname, req, res, finish);
            } else {
                finish(400, {});
            }
        });
    } else {
        // Forbidden
        finish(403, {});
    }
    return promise;
};

Server.prototype.resolve = function (pathname) {
    return path.resolve(path.join(this.root, pathname));
};

Server.prototype.serve = function (req, res, callback) {
    var that = this,
        promise = new (events.EventEmitter),
        pathname;

    var finish = function (status, headers) {
        that.finish(status, headers, req, res, promise, callback);
    };

    try {
        pathname = decodeURI(url.parse(req.url).pathname);
    }
    catch (e) {
        return process.nextTick(function () {
            return finish(400, {});
        });
    }



    process.nextTick(function () {
        that.servePath(pathname, 200, {}, req, res, finish).on('success', function (result) {
            promise.emit('success', result);
        }).on('error', function (err) {
            promise.emit('error');
        });
    });
    if (!callback) { return promise }
};

/* Check if we should consider sending a gzip version of the file based on the
 * file content type and client's Accept-Encoding header value.
 */
Server.prototype.gzipOk = function (req, contentType) {
    var enable = this.options.gzip;
    if (enable &&
        (typeof enable === 'boolean' ||
            (contentType && (enable instanceof RegExp) && enable.test(contentType)))) {
        var acceptEncoding = req.headers['accept-encoding'];
        return acceptEncoding && acceptEncoding.indexOf("gzip") >= 0;
    }
    return false;
}

/* Send a gzipped version of the file if the options and the client indicate gzip is enabled and
 * we find a .gz file mathing the static resource requested.
 */

Server.prototype.respondGzip = function (pathname, status, contentType, _headers, files, stat, req, res, finish) {
    var that = this;
    if (files.length == 1 && this.gzipOk(req, contentType) && !_headers["range"]) {
        var gzFile = files[0];
        fs.stat(gzFile, function (e, gzStat) {
            if (!e && gzStat.isFile()) {
                const gzip = zlib.createGzip({
                    level: 9
                });
                filestream = fs.createReadStream(gzFile, {
                    flags: 'r',
                    mode: 666
                }).pipe(gzip)
                //console.log('Serving', gzFile, 'to gzip-capable client instead of', files[0], 'new size is', gzStat.size, 'uncompressed size', stat.size);
                var vary = _headers['Vary'];
                _headers['Vary'] = (vary && vary != 'Accept-Encoding' ? vary + ', ' : '') + 'Accept-Encoding';
                _headers['Content-Encoding'] = 'gzip';
                delete stat.size
                files = [filestream];
            } else {
                //console.log('gzip file not found or error finding it', gzFile, String(e), stat.isFile());
            }
            that.respondNoGzip(pathname, status, contentType, _headers, files, stat, req, res, finish);
        });
    } else {
        // Client doesn't want gzip or we're sending multiple files
        that.respondNoGzip(pathname, status, contentType, _headers, files, stat, req, res, finish);
    }
}

Server.prototype.parseByteRange = function (req, stat) {
    var byteRange = {
        from: 0,
        to: 0,
        valid: false
    }

    var rangeHeader = req.headers['range'];
    var flavor = 'bytes=';

    if (rangeHeader) {
        if (rangeHeader.indexOf(flavor) == 0 && rangeHeader.indexOf(',') == -1) {
            /* Parse */
            rangeHeader = rangeHeader.substr(flavor.length).split('-');
            byteRange.from = parseInt(rangeHeader[0]);
            byteRange.to = parseInt(rangeHeader[1]);

            /* Replace empty fields of differential requests by absolute values */
            if (isNaN(byteRange.from) && !isNaN(byteRange.to)) {
                byteRange.from = stat.size - byteRange.to;
                byteRange.to = stat.size ? stat.size - 1 : 0;
            } else if (!isNaN(byteRange.from) && isNaN(byteRange.to)) {
                byteRange.to = stat.size ? stat.size - 1 : 0;
            }

            /* General byte range validation */
            if (!isNaN(byteRange.from) && !!byteRange.to && 0 <= byteRange.from && byteRange.from < byteRange.to) {
                byteRange.valid = true;
            } else {
                console.warn("Request contains invalid range header: ", rangeHeader);
            }
        } else {
            console.warn("Request contains unsupported range header: ", rangeHeader);
        }
    }
    return byteRange;
}

Server.prototype.respondNoGzip = function (pathname, status, contentType, _headers, files, stat, req, res, finish) {
    var mtime = stat.mtime.getTime(), // Date.parse(stat.mtime),
        key = pathname || files[0],
        headers = {},
        clientETag = req.headers['if-none-match'],
        clientMTime = Date.parse(req.headers['if-modified-since']),
        startByte = 0,
        length = stat.size,
        byteRange = this.parseByteRange(req, stat);

    /* Handle byte ranges */
    if (files.length == 1 && byteRange.valid) {
        if (byteRange.to < length) {

            // Note: HTTP Range param is inclusive
            startByte = byteRange.from;
            length = byteRange.to - byteRange.from + 1;
            status = 206;

            // Set Content-Range response header (we advertise initial resource size on server here (stat.size))
            headers['Content-Range'] = 'bytes ' + byteRange.from + '-' + byteRange.to + '/' + stat.size;

        } else {
            byteRange.valid = false;
            console.warn("Range request exceeds file boundaries, goes until byte no", byteRange.to, "against file size of", length, "bytes");
        }
    }

    /* In any case, check for unhandled byte range headers */
    if (!byteRange.valid && req.headers['range']) {
        console.error(new Error("Range request present but invalid, might serve whole file instead"));
    }

    // Copy default headers
    for (var k in this.options.headers) { headers[k] = this.options.headers[k] }
    // Copy custom headers
    for (var k in _headers) { headers[k] = _headers[k] }

    headers['Etag'] = JSON.stringify([stat.ino, stat.size, mtime].join('-'));
    headers['Date'] = new (Date)().toUTCString();
    headers['Last-Modified'] = new (Date)(stat.mtime).toUTCString();
    headers['Content-Type'] = contentType;
    if (length) headers['Content-Length'] = length;

    for (var k in _headers) { headers[k] = _headers[k] }

    // Conditional GET
    // If the "If-Modified-Since" or "If-None-Match" headers
    // match the conditions, send a 304 Not Modified.
    if ((clientMTime || clientETag) &&
        (!clientETag || clientETag === headers['Etag']) &&
        (!clientMTime || clientMTime >= mtime)) {
        // 304 response should not contain entity headers
        ['Content-Encoding',
            'Content-Language',
            'Content-Length',
            'Content-Location',
            'Content-MD5',
            'Content-Range',
            'Content-Type',
            'Expires',
            'Last-Modified'].forEach(function (entityHeader) {
                delete headers[entityHeader];
            });
        finish(304, headers);
    } else if (req.method === 'HEAD') {
        finish(status, headers);
    } else {
        // if (this.options.gzipTransfer && files.length === 1) {
        //     headers["Transfer-Encoding"] = "gzip";
        //     delete headers["Content-Length"];
        // }
        res.writeHead(status, headers);

        this.stream(key, files, length, startByte, res, function (e) {
            if (e) { return finish(500, {}) }
            finish(status, headers);
        });
    }
};

Server.prototype.respond = function (pathname, status, _headers, files, stat, req, res, finish) {
    var contentType = _headers['Content-Type'] ||
        mime.lookup(files[0]) ||
        'application/octet-stream';

    console.log(contentType)
    if (this.options.gzip) {
        this.respondGzip(pathname, status, contentType, _headers, files, stat, req, res, finish);
    } else {
        this.respondNoGzip(pathname, status, contentType, _headers, files, stat, req, res, finish);
    }
}

Server.prototype.stream = function (pathname, files, length, startByte, res, callback) {
    var self = this;
    // var useGzipTransfer = files.length === 1 && this.options.gzipTransfer;
    (function streamFile(files, offset) {
        var file = files.shift();

        if (file) {
            var filestream;
            if (typeof file === "object") {
                filestream = file;
            } else {
                file = path.resolve(file) === path.normalize(file) ? file : path.join(pathname || '.', file);
                filestream = fs.createReadStream(file, {
                    flags: 'r',
                    mode: 666
                })
            }
            // Stream the file to the client
            filestream = filestream.on('data', function (chunk) {
                // Bounds check the incoming chunk and offset, as copying
                // a buffer from an invalid offset will throw an error and crash
                if (chunk.length && offset < length && offset >= 0) {
                    offset += chunk.length;
                }
            }).on('close', function () {
                streamFile(files, offset);
            }).on('error', function (err) {
                callback(err);
                console.error(err);
            }).pipe(res, { end: false })

        } else {
            res.end();
            callback(null, offset);
        }
    })(files.slice(0), 0);
};

// Exports
exports.Server = Server;
exports.version = version;
exports.mime = mime;



