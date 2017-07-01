"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("./lib/rx");
const server_types_1 = require("./server-types");
const http = require("http");
const fs = require("fs");
const path = require("path");
const events_1 = require("events");
Error.stackTraceLimit = Infinity;
console.debug = function () { }; //noop console debug;
//setup global objects
const eventer = new events_1.EventEmitter();
const debug = server_types_1.DebugLogger('APP');
const error = server_types_1.ErrorLogger('APP');
const logger = require('./lib/morgan.js').handler;
const settingsFile = path.resolve(process.argv[2] || 'settings.json');
console.log("Settings file: %s", settingsFile);
var settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
(function normalizeTree(item) {
    server_types_1.keys(item).forEach(e => {
        if (typeof item[e] === 'string')
            item[e] = path.resolve(__dirname, item[e]);
        else if (typeof item[e] === 'object')
            normalizeTree(item[e]);
        else
            throw 'Invalid item: ' + e + ': ' + item[e];
    });
})(settings.tree);
if (!settings.port)
    settings.port = 8080;
if (!settings.host)
    settings.host = "127.0.0.1";
//import and init api-access
const api_access_1 = require("./api-access");
api_access_1.init(eventer);
//emit settings to everyone (I know, this could be an observable)
eventer.emit('settings', settings);
const serveIcons = (function () {
    const nodeStatic = require('./lib/node-static');
    var serve = new nodeStatic.Server(path.join(__dirname, 'icons'), { mount: '/icons' });
    return rx_1.Observable.bindCallback(function () {
        return serve.serve.apply(serve, arguments);
    }, (err, res) => [err, res]);
})();
const favicon = path.resolve(__dirname, 'assets', 'favicon.ico');
const stylesheet = path.resolve(__dirname, 'assets', 'directory.css');
const server = http.createServer();
const un = settings.username;
const pw = settings.password;
const log = rx_1.Observable.bindNodeCallback(logger);
const serverClose = rx_1.Observable.fromEvent(server, 'close').take(1).multicast(new rx_1.Subject()).refCount();
rx_1.Observable.fromEvent(server, 'request', (req, res) => {
    if (!req || !res)
        console.log('blank req or res');
    return new server_types_1.StateObject(req, res, debug, error);
}).takeUntil(serverClose).concatMap(state => {
    return log(state.req, state.res).mapTo(state);
}).map(state => {
    //check authentication and do sanity/security checks
    //https://github.com/hueniverse/iron
    //auth headers =====================
    if (!un && !pw)
        return state;
    if (!state.req.headers['authorization']) {
        debug('authorization required');
        state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Protocol App"', 'Content-Type': 'text/plain' });
        state.res.end();
        return;
    }
    debug('authorization requested');
    var header = state.req.headers['authorization'] || '', // get the header
    token = header.split(/\s+/).pop() || '', // and the encoded auth token
    auth = new Buffer(token, 'base64').toString(), // convert from base64
    parts = auth.split(/:/), // split on colon
    username = parts[0], password = parts[1];
    if (username != un || password != pw) {
        debug('authorization invalid - UN:%s - PW:%s', username, password);
        state.throw(401, 'Invalid username or password');
        return;
    }
    debug('authorization successful');
    // securityChecks =====================
    return state;
}).filter(state => !!state).routeCase(state => {
    return state.path[1];
}, {
    'favicon.ico': doFaviconRoute,
    'directory.css': doStylesheetRoute,
    'icons': doIconRoute,
    'admin': server_types_1.StateObject.errorRoute(404, 'Reserved for future use')
}, api_access_1.doAPIAccessRoute).subscribe((state) => {
    if (!state)
        return console.log('blank item');
    if (!state.res.finished) {
        const timeout = setTimeout(function () {
            state.error('RESPONSE FINISH TIMED OUT');
            state.error('%s %s ', state.req.method, state.req.url);
            state.throw(500, "Response timed out");
        }, 60000);
        rx_1.Observable.fromEvent(state.res, 'finish').take(1).subscribe(() => clearTimeout(timeout));
    }
}, err => {
    console.error('Uncaught error in the processing stack: ' + err.message);
    console.error(err.stack);
    server.close();
}, () => {
    //theoretically we could rebind the listening port without restarting the process, 
    //but I don't know what would be the point of that. If this actually happens, 
    //there will be no more listeners so the process will probably exit.
    //In practice, the only reason this should happen is if the server close event fires.
    console.log('finished processing for some reason');
});
function doFaviconRoute(obs) {
    return obs.mergeMap((state) => {
        return server_types_1.obs_stat(state)(favicon).mergeMap(([err, stat]) => {
            if (err)
                return state.throw(404);
            return server_types_1.serveStatic(favicon, state, stat).map(([isErr, res]) => {
                if (isErr)
                    state.throw(res.status, res.message, res.headers);
            }).ignoreElements();
        });
    });
}
function doStylesheetRoute(obs) {
    return obs.mergeMap(state => {
        return server_types_1.obs_stat(state)(stylesheet).mergeMap(([err, stat]) => {
            if (err)
                return state.throw(404);
            return server_types_1.serveStatic(stylesheet, state, stat).map(([isErr, res]) => {
                if (isErr)
                    state.throw(res.status, res.message, res.headers);
            }).ignoreElements();
        });
    });
}
function doIconRoute(obs) {
    return obs.mergeMap(state => {
        return serveIcons(state.req, state.res).do(([err, res]) => {
            if (err)
                state.throw(err.status, err.message);
        }).mapTo(state);
    });
}
server.listen(settings.port, settings.host, function (err, res) {
    if (err) {
        console.error('error on app.listen', err);
        return;
    }
    console.log('Open you browswer and type in one of the following:');
    if (!settings.host || settings.host === '0.0.0.0') {
        var os = require('os');
        var ifaces = os.networkInterfaces();
        for (var dev in ifaces) {
            var alias = 0;
            ifaces[dev].forEach(function (details) {
                if (details.family == 'IPv4' && details.internal === false) {
                    console.log(details.address + (settings.port !== 80 ? ':' + settings.port : ''));
                    ++alias;
                }
            });
        }
    }
    else {
        console.log(settings.host + (settings.port !== 80 ? ':' + settings.port : ''));
    }
});
/**
 * to be used with concatMap, mergeMap, etc.
 * @param state
 */
function recieveBody(state) {
    //get the data from the request
    return rx_1.Observable.fromEvent(state.req, 'data')
        .takeUntil(rx_1.Observable.fromEvent(state.req, 'end').take(1))
        .reduce((n, e) => { n.push(e); return n; }, [])
        .map(e => {
        state.body = Buffer.concat(e).toString('utf8');
        //console.log(state.body);
        if (state.body.length === 0)
            return state;
        try {
            state.json = JSON.parse(state.body);
        }
        catch (e) {
            //state.json = buf;
        }
        return state;
    });
}
exports.recieveBody = recieveBody;
