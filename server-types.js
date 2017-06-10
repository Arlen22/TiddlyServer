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
function DebugLogger(prefix) {
    return function (str, ...args) {
        let t = new Date();
        let date = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.debug(['  ', prefix, date, util_1.format.apply(null, arguments)].join(' '));
    };
}
exports.DebugLogger = DebugLogger;
function ErrorLogger(prefix) {
    return function (str, ...args) {
        let t = new Date();
        let date = util_1.format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'), padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.error([prefix, date, util_1.format.apply(null, arguments)].join(' '));
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
        this.debugLog(' [' +
            this.req.socket.remoteFamily + '-' +
            this.req.socket.remoteAddress + '] ' +
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
        this.errorLog(' [' +
            this.req.socket.remoteFamily + '-' +
            this.req.socket.remoteAddress + '] ' +
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXR5cGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0EsMkJBQTJCO0FBQzNCLHlCQUF5QjtBQUV6QiwrQkFBOEI7QUFDOUIsaUNBQWtEO0FBQ2xELG1DQUFzQztBQXlCdEMsY0FBd0IsQ0FBSTtJQUN4QixNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQWdCLENBQUM7QUFDekMsQ0FBQztBQUZELG9CQUVDO0FBQ0QsaUJBQXdCLEdBQVEsRUFBRSxHQUFvQixFQUFFLE1BQWU7SUFDbkUsSUFBSSxJQUFJLEdBQUcsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQzFCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQztRQUM5QixNQUFNLEdBQUcsR0FBRyxDQUFDO0lBQ2pCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDMUIsR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUNELG9DQUFvQztJQUNwQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDdkUsQ0FBQztBQVRELDBCQVNDO0FBQ0Qsd0JBQWtFLEdBQWtCO0lBQ2hGLE1BQU0sQ0FBQyxVQUFVLENBQUksRUFBRSxDQUFJO1FBQ3ZCLElBQUksRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoQixJQUFJLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFaEIsRUFBRSxDQUFD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