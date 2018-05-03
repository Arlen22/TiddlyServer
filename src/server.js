"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("../lib/source-map-support-lib");
const bundled_lib_1 = require("../lib/bundled-lib");
const sendOptions = {};
const rx_1 = require("../lib/rx");
const server_types_1 = require("./server-types");
const http = require("http");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const events_1 = require("events");
// import send = require('../lib/send-lib');
const { Server: WebSocketServer } = bundled_lib_1.ws;
__dirname = path.dirname(module.filename || process.execPath);
Error.stackTraceLimit = Infinity;
process.on('uncaughtException', err => {
    console.error(util_1.inspect(err));
    console.error("caught process uncaughtException");
    fs.appendFile(path.join(__dirname, 'uncaughtException.log'), new Date().toISOString() + "\r\n" + util_1.inspect(err) + "\r\n\r\n", (err) => {
        if (err)
            console.log('Could not write to uncaughtException.log');
    });
    if (process.argv[2] !== "--close-on-error" && process.argv[3] !== "--close-on-error")
        setInterval(function () { }, 1000); //hold it open because all other listeners should close
});
console.debug = function () { }; //noop console debug;
//setup global objects
const eventer = new events_1.EventEmitter();
const debug = server_types_1.DebugLogger('APP');
const settingsFile = path.normalize(process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../settings.json'));
console.log("Settings file: %s", settingsFile);
var settings;
const settingsString = fs.readFileSync(settingsFile, 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
settings = server_types_1.tryParseJSON(settingsString, (e) => {
    console.error(/*colors.BgWhite + */ server_types_1.colors.FgRed + "The settings file could not be parsed: %s" + server_types_1.colors.Reset, e.originalError.message);
    console.error(e.errorPosition);
    throw "The settings file could not be parsed: Invalid JSON";
});
if (!settings.tree)
    throw "tree is not specified in the settings file";
server_types_1.normalizeSettings(settings, settingsFile);
if (["string", "undefined"].indexOf(typeof settings.username) === -1)
    throw "username must be a JSON string if specified";
if (["string", "undefined"].indexOf(typeof settings.password) === -1)
    throw "password must be a JSON string if specified";
var ENV;
(function (ENV) {
    ENV.disableLocalHost = false;
})(ENV || (ENV = {}));
;
if (process.env.TiddlyServer_disableLocalHost || settings._disableLocalHost)
    ENV.disableLocalHost = true;
//import and init api-access
const tiddlyserver_1 = require("./tiddlyserver");
const settingsPage_1 = require("./settingsPage");
server_types_1.init(eventer);
tiddlyserver_1.init(eventer);
settingsPage_1.initSettings(eventer);
//emit settings to everyone (I know, this could be an observable)
const assets = path.resolve(__dirname, '../assets');
const favicon = path.resolve(__dirname, '../assets/favicon.ico');
const stylesheet = path.resolve(__dirname, '../assets/directory.css');
settings.__assetsDir = assets;
eventer.emit('settings', settings);
let serverLocalHost, serverNetwork;
process.on('uncaughtException', () => {
    serverNetwork.close();
    serverLocalHost.close();
    console.log('closing server');
});
// const un = settings.username;
// const pw = settings.password;
// fs.createWriteStream()
const morgan = require('../lib/morgan.js');
function setLog() {
    const logger = morgan.handler({
        logFile: settings.logAccess || undefined,
        logToConsole: !settings.logAccess || settings.logToConsoleAlso,
        logColorsToFile: settings.logColorsToFile
    });
    return settings.logAccess === false ? ((...args) => rx_1.Observable.of({}).map(() => { }))
        : rx_1.Observable.bindNodeCallback(logger);
}
let log = setLog();
eventer.on('settingsChanged', (keys) => {
    let watch = ["logAccess", "logToConsoleAlso", "logColorsToFile"];
    if (watch.some(e => keys.indexOf(e) > -1))
        log = setLog();
});
const routes = {
    'admin': state => handleAdminRoute(state),
    'assets': state => handleAssetsRoute(state),
    'favicon.ico': state => server_types_1.serveFile(state, 'favicon.ico', assets),
    'directory.css': state => server_types_1.serveFile(state, 'directory.css', assets),
};
if (typeof settings.tree === "object") {
    let keys = Object.keys(settings.tree);
    let routeKeys = Object.keys(routes);
    let conflict = keys.filter(k => routeKeys.indexOf(k) > -1);
    if (conflict.length)
        console.log("The paths %s are reserved for use by TiddlyServer", conflict.join(', '));
}
function initServer() {
    serverLocalHost = http.createServer();
    serverNetwork = http.createServer();
    const serverClose = rx_1.Observable.merge(rx_1.Observable.fromEvent(serverLocalHost, 'close').take(1), rx_1.Observable.fromEvent(serverNetwork, 'close').take(1)).multicast(new rx_1.Subject()).refCount();
    rx_1.Observable.merge(rx_1.Observable.fromEvent(serverLocalHost, 'request', (req, res) => {
        if (!req || !res)
            console.log('blank req or res');
        return new server_types_1.StateObject(req, res, debug, eventer, true);
    }).takeUntil(serverClose).concatMap(state => {
        return log(state.req, state.res).mapTo(state);
    }), rx_1.Observable.fromEvent(serverNetwork, 'request', (req, res) => {
        if (!req || !res)
            console.log('blank req or res');
        return new server_types_1.StateObject(req, res, debug, eventer, false);
    }).takeUntil(serverClose).concatMap(state => {
        return log(state.req, state.res).mapTo(state);
    })).subscribe((state) => {
        if (!handleBasicAuth(state))
            return;
        const route = routes[state.path[1]];
        if (route)
            route(state);
        else
            tiddlyserver_1.handleTiddlyServerRoute(state);
    }, err => {
        debug(4, 'Uncaught error in the server route: ' + err.message);
        debug(4, err.stack);
        debug(4, "the server will now close");
        serverNetwork.close();
        serverLocalHost.close();
    }, () => {
        //theoretically we could rebind the listening port without restarting the process, 
        //but I don't know what would be the point of that. If this actually happens, 
        //there will be no more listeners so the process will probably exit.
        //In practice, the only reason this should happen is if the server close event fires.
        console.log('finished processing for some reason');
    });
    if (ENV.disableLocalHost) {
        serverNetwork.listen(settings.port, settings.host, serverListenCB);
    }
    else {
        serverLocalHost.listen(settings.port, "127.0.0.1", (err, res) => {
            if (settings.host !== "127.0.0.1") {
                serverNetwork.listen(settings.port, settings.host, serverListenCB);
            }
            else {
                serverListenCB(err, res);
            }
        });
    }
}
initServer();
const errLog = server_types_1.DebugLogger('STATE_ERR');
eventer.on("stateError", (state) => {
    if (state.doneMessage.length > 0)
        dbgLog(2, state.doneMessage.join('\n'));
});
const dbgLog = server_types_1.DebugLogger('STATE_DBG');
eventer.on("stateDebug", (state) => {
    if (state.doneMessage.length > 0)
        dbgLog(-2, state.doneMessage.join('\n'));
});
function handleAssetsRoute(state) {
    switch (state.path[2]) {
        case "static":
            server_types_1.serveFolder(state, '/assets/static', path.join(assets, "static"));
            break;
        case "icons":
            server_types_1.serveFolder(state, '/assets/icons', path.join(assets, "icons"));
            break;
        case "tiddlywiki":
            tiddlyserver_1.handleTiddlyWikiRoute(state);
            break;
        default: state.throw(404);
    }
}
function handleAdminRoute(state) {
    switch (state.path[2]) {
        case "settings":
            settingsPage_1.handleSettings(state);
            break;
        default: state.throw(404);
    }
}
function serverListenCB(err, res) {
    function connection(client, request) {
        eventer.emit('websocket-connection', client, request);
    }
    function error(error) {
        debug(-2, 'WS-ERROR %s', util_1.inspect(error));
    }
    if (err) {
        console.error('error on app.listen', err);
        return;
    }
    const wssl = new WebSocketServer({ server: serverLocalHost });
    wssl.on('connection', connection);
    wssl.on('error', error);
    const wssn = new WebSocketServer({ server: serverNetwork });
    wssn.on('connection', connection);
    wssn.on('error', error);
    console.log('Open your browser and type in one of the following:');
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
}
function handleBasicAuth(state) {
    //check authentication and do sanity/security checks
    //https://github.com/hueniverse/iron
    //auth headers =====================
    if (!settings.username && !settings.password)
        return true;
    if (!state.req.headers['authorization']) {
        debug(-2, 'authorization required');
        state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' });
        state.res.end();
        return false;
    }
    debug(-3, 'authorization requested');
    var header = state.req.headers['authorization'] || '', // get the header
    token = header.split(/\s+/).pop() || '', // and the encoded auth token
    auth = new Buffer(token, 'base64').toString(), // convert from base64
    parts = auth.split(/:/), // split on colon
    username = parts[0], password = parts[1];
    if (username !== settings.username || password !== settings.password) {
        debug(-2, 'authorization invalid - UN:%s - PW:%s', username, password);
        state.throwReason(401, 'Invalid username or password');
        return false;
    }
    debug(-3, 'authorization successful');
    // securityChecks =====================
    return true;
}
// .map((state: StateObject) => {
//     //check authentication and do sanity/security checks
//     //https://github.com/hueniverse/iron
//     //auth headers =====================
//     if (!settings.username && !settings.password) return state;
//     if (!state.req.headers['authorization']) {
//         debug(-2, 'authorization required');
//         state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' });
//         state.res.end();
//         return;
//     }
//     debug(-3, 'authorization requested');
//     var header = state.req.headers['authorization'] || '',        // get the header
//         token = header.split(/\s+/).pop() || '',            // and the encoded auth token
//         auth = new Buffer(token, 'base64').toString(),    // convert from base64
//         parts = auth.split(/:/),                          // split on colon
//         username = parts[0],
//         password = parts[1];
//     if (username !== settings.username || password !== settings.password) {
//         debug(-2, 'authorization invalid - UN:%s - PW:%s', username, password);
//         state.throwReason(401, 'Invalid username or password');
//         return;
//     }
//     debug(-3, 'authorization successful')
//     // securityChecks =====================
//     return state;
// }).filter(obsTruthy).routeCase<StateObject>(
//     state => state.path[1], routes, doTiddlyServerRoute
// ) 
