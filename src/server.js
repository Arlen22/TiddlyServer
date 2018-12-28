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
// import { parse as jsonParse } from 'jsonlint';
// import send = require('../lib/send-lib');
const { Server: WebSocketServer } = bundled_lib_1.ws;
__dirname = path.dirname(module.filename || process.execPath);
Error.stackTraceLimit = Infinity;
console.debug = function () { }; //noop console debug;
//setup global objects
exports.eventer = new events_1.EventEmitter();
const debug = server_types_1.DebugLogger('APP');
var ENV;
(function (ENV) {
    ENV.disableLocalHost = false;
})(ENV || (ENV = {}));
;
var settings;
//import and init api-access
const tiddlyserver_1 = require("./tiddlyserver");
const settingsPage_1 = require("./settingsPage");
const os_1 = require("os");
server_types_1.init(exports.eventer);
tiddlyserver_1.init(exports.eventer);
settingsPage_1.initSettings(exports.eventer);
//emit settings to everyone (I know, this could be an observable)
const assets = path.resolve(__dirname, '../assets');
const favicon = path.resolve(__dirname, '../assets/favicon.ico');
const stylesheet = path.resolve(__dirname, '../assets/directory.css');
function loadSettings(settingsFile) {
    console.log("Settings file: %s", settingsFile);
    const settingsString = fs.readFileSync(settingsFile, 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
    var schema = require("../settings.schema.json");
    var schemaChecker = new bundled_lib_1.ajv({
        allErrors: true,
        async: false
    });
    schemaChecker.addMetaSchema(require('../lib/json-schema-refs/json-schema-draft-06.json'));
    var validate = schemaChecker.compile(schema);
    var valid = validate(settingsString, settingsFile);
    if (!valid)
        console.log(validate.errors);
    let settingsObj = server_types_1.tryParseJSON(settingsString, (e) => {
        console.error(/*colors.BgWhite + */ server_types_1.colors.FgRed + "The settings file could not be parsed: %s" + server_types_1.colors.Reset, e.originalError.message);
        console.error(e.errorPosition);
        throw "The settings file could not be parsed: Invalid JSON";
    });
    if (!settingsObj.tree)
        throw "tree is not specified in the settings file";
    let routeKeys = Object.keys(routes);
    server_types_1.normalizeSettings(settingsObj, settingsFile, routeKeys);
    // let newSettingsObj: NewConfig = ConvertSettings(settingsObj);
    // if (["string", "undefined"].indexOf(typeof settingsObj.username) === -1) throw "username must be a JSON string if specified";
    // if (["string", "undefined"].indexOf(typeof settingsObj.password) === -1) throw "password must be a JSON string if specified";
    // if (process.env.TiddlyServer_disableLocalHost || settingsObj._disableLocalHost)
    // 	ENV.disableLocalHost = true;
    settingsObj.__assetsDir = assets;
    if (typeof settingsObj.tree === "object") {
        let keys = Object.keys(settingsObj.tree);
        let routeKeys = Object.keys(routes);
        let conflict = keys.filter(k => routeKeys.indexOf(k) > -1);
        if (conflict.length)
            console.log("The following tree items are reserved for use by TiddlyServer: %s", conflict.map(e => '"' + e + '"').join(', '));
    }
    return settingsObj;
}
exports.loadSettings = loadSettings;
// === Setup Logging
const morgan = require('../lib/morgan.js');
function setLog() {
    const logger = morgan.handler({
        logFile: settings.server.logAccess || undefined,
        logToConsole: !settings.server.logAccess || settings.server.logToConsoleAlso,
        logColorsToFile: settings.server.logColorsToFile
    });
    return settings.server.logAccess === false
        ? ((...args) => Promise.resolve([]))
        : (...args) => new Promise(resolve => {
            args.push((...args2) => resolve(args2));
            logger.apply(null, args);
        });
}
let log;
exports.eventer.on('settings', () => { log = setLog(); });
exports.eventer.on('settingsChanged', (keys) => {
    // let watch: (keyof ServerConfig["server"])[] = ["server.logAccess", "server.logToConsoleAlso", "server.logColorsToFile"];
    // if (watch.some(e => keys.indexOf(e) > -1)) log = setLog();
});
// === Setup static routes
const routes = {
    'admin': state => handleAdminRoute(state),
    'assets': state => handleAssetsRoute(state),
    'favicon.ico': state => server_types_1.serveFile(state, 'favicon.ico', assets),
    'directory.css': state => server_types_1.serveFile(state, 'directory.css', assets),
};
function initServer(options) {
    settings = options.settings;
    const { preflighter, env, listenCB } = options;
    exports.eventer.emit('settings', settings);
    const hosts = [];
    const bindWildcard = settings.server.bindWildcard;
    //always match localhost
    const tester = server_types_1.parseHostList([...settings.server.bindAddress, "-127.0.0.0/8"]);
    const localhostTester = server_types_1.parseHostList(["127.0.0.0/8"]);
    const addListeners = (server, iface) => {
        let closing = false;
        if (bindWildcard)
            server.on('connection', (socket) => {
                if (!tester(socket.localAddress) && !localhostTester(socket.localAddress))
                    socket.end();
            });
        server.on('request', requestHandler(iface, preflighter));
        server.on('listening', () => {
            debug(1, "server %s listening", iface);
        });
        server.on('error', (err) => {
            debug(4, "server %s error: %s", iface, err.message);
            debug(4, "server %s stack: %s", iface, err.stack);
            server.close();
            exports.eventer.emit('serverClose', iface);
        });
        server.on('close', () => {
            if (!closing)
                exports.eventer.emit('serverClose', iface);
            debug(4, "server %s closed", iface);
            closing = true;
        });
        const wss = new WebSocketServer({ server });
        wss.on('connection', (client, request) => {
            exports.eventer.emit('websocket-connection', client, request);
        });
        wss.on('error', (error) => {
            debug(-2, 'WS-ERROR %s', util_1.inspect(error));
        });
    };
    if (settings.server.bindWildcard) {
        hosts.push('0.0.0.0');
        if (settings.server.enableIPv6)
            hosts.push('::');
    }
    else if (Array.isArray(settings.server.bindAddress)) {
        let ifaces = os_1.networkInterfaces();
        let addresses = Object.keys(ifaces)
            .reduce((n, k) => n.concat(ifaces[k]), [])
            .filter(e => (settings.server.enableIPv6 || e.family === "IPv4") && tester(e.address))
            .map(e => e.address);
        hosts.push(...addresses);
    }
    if (settings.server._bindLocalhost)
        hosts.push('localhost');
    let servers = [];
    rx_1.Observable.from(hosts).concatMap(host => {
        let server = http.createServer();
        addListeners(server, host);
        servers.push(server);
        return new rx_1.Observable(subs => {
            server.listen(settings.server.port, host, undefined, () => { subs.complete(); });
        });
    }).subscribe(item => { }, x => { }, () => {
        exports.eventer.emit("serverOpen", servers, false);
    });
    return exports.eventer;
}
exports.initServer = initServer;
function requestHandler(iface, preflighter) {
    return (request, response) => {
        let host = request.headers.host;
        let addr = request.socket.localAddress;
        // console.log(host, addr, request.socket.address().address);
        //send the request and response to morgan
        log(request, response).then(() => {
            const ev = {
                handled: false,
                trusted: false,
                interface: { host, addr, iface },
                request, response
            };
            //send it to the preflighter
            return preflighter ? preflighter(ev) : Promise.resolve(ev);
        }).then(ev => {
            // check if the preflighter handled it
            if (ev.handled)
                return;
            //create the state object
            const state = new server_types_1.StateObject(ev.request, ev.response, debug, exports.eventer, ev.trusted ? "trusted" : iface);
            //handle basic auth
            if (!handleBasicAuth(state))
                return;
            //check for static routes
            const route = routes[state.path[1]];
            //if so, handle it
            if (route)
                route(state);
            //otherwise forward to TiddlyServer
            else
                tiddlyserver_1.handleTiddlyServerRoute(state);
        }).catch(err => {
            //catches any errors that happen inside the then statements
            debug(3, 'Uncaught error in the request handler: ' + (err.message || err.toString()));
            //if we have a stack, then print it
            if (err.stack)
                debug(3, err.stack);
        });
    };
}
const errLog = server_types_1.DebugLogger('STATE_ERR');
exports.eventer.on("stateError", (state) => {
    if (state.doneMessage.length > 0)
        dbgLog(2, state.doneMessage.join('\n'));
});
const dbgLog = server_types_1.DebugLogger('STATE_DBG');
exports.eventer.on("stateDebug", (state) => {
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
    if (err) {
        console.error('error on app.listen', err);
        return;
    }
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
    const first = (header) => Array.isArray(header) ? header[0] : header;
    if (!state.req.headers['authorization']) {
        debug(-2, 'authorization required');
        state.respond(401, "", { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' }).empty();
        return false;
    }
    debug(-3, 'authorization requested');
    var header = first(state.req.headers['authorization']) || '', // get the header
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
