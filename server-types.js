"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const fs = require("fs");
const util_1 = require("util");
const rx_1 = require("./lib/rx");
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
function DebugLogger(prefix) {
    return function (str, ...args) {
        let t = new Date();
        let date = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.log([colors.FgGreen + prefix, date + colors.Reset, util_1.format.apply(null, arguments)].join(' '));
    };
}
exports.DebugLogger = DebugLogger;
function ErrorLogger(prefix) {
    return function (str, ...args) {
        let t = new Date();
        let date = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.error([colors.FgRed + prefix, colors.FgYellow + date + colors.Reset, util_1.format.apply(null, arguments)].join(' '));
    };
}
exports.ErrorLogger = ErrorLogger;
function sanitizeJSON(key, value) {
    // returning undefined omits the key from being serialized
    if (!key) {
        return value;
    } //This is the entire value to be serialized
    else if (key.substring(0, 1) === "$")
        return; //Remove angular tags
    else if (key.substring(0, 1) === "_")
        return; //Remove NoSQL tags, including _id
    else
        return value;
}
exports.sanitizeJSON = sanitizeJSON;
function handleProgrammersException(logger, err, message) {
}
exports.handleProgrammersException = handleProgrammersException;
exports.serveStatic = (function () {
    const staticServer = require('./lib/node-static');
    const serve = new staticServer.Server({ mount: '/' });
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
exports.obs_stat = (state) => rx_1.Observable.bindCallback(fs.stat, (err, stat) => [err, stat, state]);
exports.obs_readdir = (state) => rx_1.Observable.bindCallback(fs.readdir, (err, files) => [err, files, state]);
exports.obs_readFile = (state) => rx_1.Observable.bindCallback(fs.readFile, (err, data) => [err, data, state]);
class StateError extends Error {
    constructor(state, message) {
        super(message);
        this.state = state;
    }
}
exports.StateError = StateError;
class StateObject {
    // private debugLog: LoggerFunc;
    // private errorLog: LoggerFunc;
    constructor(req, res, debugLog, errorLog) {
        this.req = req;
        this.res = res;
        this.debugLog = debugLog;
        this.errorLog = errorLog;
        // this.req = req;
        // this.res = res;
        // this.debugLog = debugLog;
        // this.errorLog = errorLog;
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
    /*log(str: string, ...args: any[]) {
        console.log(this.timestamp + ' [' +
            this.req.socket.remoteFamily + '-' +
            this.req.socket.remoteAddress + '] ' +
            format.apply(null, arguments)
        );
    }*/
    error(str, ...args) {
        this.errorLog('[' +
            this.req.socket.remoteFamily + '-' + colors.FgMagenta +
            this.req.socket.remoteAddress + colors.Reset + '] ' +
            util_1.format.apply(null, arguments));
    }
    throw(statusCode, reason, str, ...args) {
        //throw<T>(statusCode: number, reason?, str?: string, ...args: any[]): Observable<T>
        //throw(statusCode: number, reason?, str?: string, ...args: any[]): Observable<any> {
        let headers = (typeof str === 'object') ? str : null;
        if (headers)
            str = args.shift();
        this.errorThrown = new StateError(this, util_1.format.bind(null, str || reason || 'status code ' + statusCode).apply(null, args));
        if (!this.res.headersSent) {
            this.res.writeHead(statusCode, reason && reason.toString(), headers);
            //don't write 204 reason
            if (statusCode !== 204 && reason)
                this.res.write(reason.toString());
        }
        this.res.end();
        //don't log anything if we only have a status code
        if (str || reason)
            this.error('state error ' + this.errorThrown.message);
        return rx_1.Observable.empty();
    }
    endJSON(data) {
        this.res.write(JSON.stringify(data));
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
