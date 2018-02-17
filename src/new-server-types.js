"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const fs = require("fs");
const util_1 = require("util");
const rx_1 = require("../lib/rx");
const events_1 = require("events");
function keys(o) {
    return Object.keys(o);
}
exports.keys = keys;
function padLeft(str, pad, padStr) {
    var item = str.toString();
    if (typeof padStr === 'undefined')
        padStr = ' ';
    if (typeof pad === 'number') {
        pad = new Array(pad + 1).join(padStr);
    }
    //pad: 000000 val: 6543210 => 654321
    return pad.substr(0, Math.max(pad.length - item.length, 0)) + item;
}
exports.padLeft = padLeft;
function sortBySelector(key) {
    return function (a, b) {
        var va = key(a);
        var vb = key(b);
        if (va > vb)
            return 1;
        else if (va < vb)
            return -1;
        else
            return 0;
    };
}
exports.sortBySelector = sortBySelector;
function sortByKey(key) {
    return sortBySelector(e => e[key]);
}
exports.sortByKey = sortByKey;
var colors;
(function (colors) {
    colors.Reset = "\x1b[0m";
    colors.Bright = "\x1b[1m";
    colors.Dim = "\x1b[2m";
    colors.Underscore = "\x1b[4m";
    colors.Blink = "\x1b[5m";
    colors.Reverse = "\x1b[7m";
    colors.Hidden = "\x1b[8m";
    colors.FgBlack = "\x1b[30m";
    colors.FgRed = "\x1b[31m";
    colors.FgGreen = "\x1b[32m";
    colors.FgYellow = "\x1b[33m";
    colors.FgBlue = "\x1b[34m";
    colors.FgMagenta = "\x1b[35m";
    colors.FgCyan = "\x1b[36m";
    colors.FgWhite = "\x1b[37m";
    colors.BgBlack = "\x1b[40m";
    colors.BgRed = "\x1b[41m";
    colors.BgGreen = "\x1b[42m";
    colors.BgYellow = "\x1b[43m";
    colors.BgBlue = "\x1b[44m";
    colors.BgMagenta = "\x1b[45m";
    colors.BgCyan = "\x1b[46m";
    colors.BgWhite = "\x1b[47m";
})(colors = exports.colors || (exports.colors = {}));
const DEBUGLEVEL = -1;
function DebugLogger(prefix) {
    //if(prefix.startsWith("V:")) return function(){};
    return function (...args) {
        //this sets the default log level for the message
        var msgLevel = 0;
        if (typeof args[0] === "number") {
            if (DEBUGLEVEL > args[0])
                return;
            else
                msgLevel = args.shift();
        }
        else {
            if (DEBUGLEVEL > msgLevel)
                return;
        }
        let t = new Date();
        let date = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.log([' ', (msgLevel >= 3 ? (colors.BgRed + colors.FgWhite) : colors.FgRed) + prefix,
            colors.FgCyan, date, colors.Reset, util_1.format.apply(null, args)].join(' ').split('\n').map((e, i) => {
            if (i > 0) {
                return new Array(28 + prefix.length).join(' ') + e;
            }
            else {
                return e;
            }
        }).join('\n'));
    };
}
exports.DebugLogger = DebugLogger;
function sanitizeJSON(key, value) {
    // returning undefined omits the key from being serialized
    if (!key) {
        return value;
    } //This is the entire value to be serialized
    else if (key.substring(0, 1) === "$")
        return; //Remove angular tags
    else if (key.substring(0, 1) === "_")
        return; //Remove NoSQL tags
    else
        return value;
}
exports.sanitizeJSON = sanitizeJSON;
exports.serveStatic = (function () {
    const staticServer = require('../lib/node-static');
    const serve = new staticServer.Server({
        mount: '/'
        // gzipTransfer: true, 
        // gzip:/^(text\/html|application\/javascript|text\/css|application\/json)$/gi 
    });
    const promise = new events_1.EventEmitter();
    return function (path, state, stat) {
        const { req, res } = state;
        return rx_1.Observable.create((subs) => {
            serve.respond(null, 200, {
                'x-api-access-type': 'file'
            }, [path], stat, req, res, function (status, headers) {
                serve.finish(status, headers, req, res, promise, (err, res) => {
                    if (err) {
                        subs.next([true, err]);
                    }
                    else {
                        subs.next([false, res]);
                    }
                    subs.complete();
                });
            });
        });
    };
})();
// export function obs<S>(state?: S) {
//     return Observable.bindCallback(fs.stat, (err, stat): NodeCallback<fs.Stats, S> => [err, stat, state] as any);
// }
exports.obs_stat = (state) => rx_1.Observable.bindCallback(fs.stat, (err, stat) => [err, stat, state]);
exports.obs_readdir = (state) => rx_1.Observable.bindCallback(fs.readdir, (err, files) => [err, files, state]);
exports.obs_readFile = (state) => rx_1.Observable.bindCallback(fs.readFile, (err, data) => [err, data, state]);
exports.obs_writeFile = (state) => rx_1.Observable.bindCallback(fs.writeFile, (err, data) => [err, data, state]);
class StateError extends Error {
    constructor(state, message) {
        super(message);
        this.state = state;
    }
}
exports.StateError = StateError;
class StateObject {
    constructor(req, res, debugLog, isLocalHost = false) {
        this.req = req;
        this.res = res;
        this.debugLog = debugLog;
        this.isLocalHost = isLocalHost;
        // log(str: string, ...args: any[]) {
        //     console.log(this.timestamp + ' [' +
        //         this.req.socket.remoteFamily + '-' +
        //         this.req.socket.remoteAddress + '] ' +
        //         format.apply(null, arguments)
        //     );
        // }
        // error(str: string, ...args: any[]) {
        //     this.debugLog('[' +
        //         this.req.socket.remoteFamily + '-' + colors.FgMagenta +
        //         this.req.socket.remoteAddress + colors.Reset + '] ' +
        //         format.apply(null, arguments)
        //     );
        // }
        this.loglevel = DEBUGLEVEL;
        this.startTime = process.hrtime();
        //parse the url and store in state.
        //a server request will definitely have the required fields in the object
        this.url = url.parse(this.req.url, true);
        //parse the path for future use
        this.path = this.url.pathname.split('/');
        let t = new Date();
        this.timestamp = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
    }
    static errorRoute(status, reason) {
        return (obs) => {
            return obs.mergeMap((state) => {
                return state.throw(status, reason);
            });
        };
    }
    debug(str, ...args) {
        this.debugLog('[' +
            this.req.socket.remoteFamily + '-' + colors.FgMagenta +
            this.req.socket.remoteAddress + colors.Reset + '] ' +
            util_1.format.apply(null, arguments));
    }
    /**
     *  4 - Errors that require the process to exit for restart
     *  3 - Major errors that are handled and do not require a server restart
     *  2 - Warnings or errors that do not alter the program flow but need to be marked (minimum for status 500)
     *  1 - Info - Most startup messages
     *  0 - Normal debug messages and all software and request-side error messages
     * -1 - Detailed debug messages from high level apis
     * -2 - Response status messages and error response data
     * -3 - Request and response data for all messages (verbose)
     * -4 - Protocol details and full data dump (such as encryption steps and keys)
     */
    log(level, ...args) {
        if (level < this.loglevel)
            return this;
        this.doneMessage.push(util_1.format.apply(null, args));
        return this;
    }
    error() {
        this.errorThrown = new Error(this.doneMessage.join('\n'));
        return this;
    }
    throw(statusCode, reason, headers) {
        if (!this.res.headersSent) {
            this.res.writeHead(statusCode, reason && reason.toString(), headers);
            //don't write 204 reason
            if (statusCode !== 204 && reason)
                this.res.write(reason.toString());
        }
        this.res.end();
        return rx_1.Observable.empty();
    }
    endJSON(data) {
        this.res.write(JSON.stringify(data));
        this.res.end();
    }
    redirect(redirect) {
        this.res.writeHead(302, {
            'Location': redirect
        });
        this.res.end();
    }
}
exports.StateObject = StateObject;
;
;
function createHashmapString(keys, values) {
    if (keys.length !== values.length)
        throw 'keys and values must be the same length';
    var obj = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    });
    return obj;
}
exports.createHashmapString = createHashmapString;
function createHashmapNumber(keys, values) {
    if (keys.length !== values.length)
        throw 'keys and values must be the same length';
    var obj = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    });
    return obj;
}
exports.createHashmapNumber = createHashmapNumber;
function obsTruthy(a) {
    return !!a;
}
exports.obsTruthy = obsTruthy;
const ERRORS = {
    'PROGRAMMER_EXCEPTION': 'A programmer exception occurred: %s'
};
function getError(...args) {
    let code = args.shift();
    if (ERRORS[code])
        args.unshift(ERRORS[code]);
    //else args.unshift(code);
    return { code: code, message: util_1.format.apply(null, args) };
}
exports.getError = getError;
