"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    let settingsObj = server_types_1.tryParseJSON(settingsString, (e) => {
        console.error(/*colors.BgWhite + */ server_types_1.colors.FgRed + "The settings file could not be parsed: %s" + server_types_1.colors.Reset, e.originalError.message);
        console.error(e.errorPosition);
        throw "The settings file could not be parsed: Invalid JSON";
    });
    var schemaChecker = new bundled_lib_1.ajv({ allErrors: true, async: false });
    schemaChecker.addMetaSchema(require('../lib/json-schema-refs/json-schema-draft-06.json'));
    var validate = schemaChecker.compile(require("../settings.schema.json"));
    var valid = validate(settingsObj, "settings");
    var validationErrors = validate.errors;
    if (!valid)
        console.log(validationErrors && validationErrors.map(e => [e.keyword.toUpperCase() + ":", e.dataPath, e.message].join(' ')).join('\n'));
    if (!settingsObj.tree)
        throw "tree is not specified in the settings file";
    let routeKeys = Object.keys(routes);
    server_types_1.normalizeSettings(settingsObj, settingsFile, routeKeys);
    settingsObj.__assetsDir = assets;
    if (typeof settingsObj.tree === "object") {
        let keys = [];
        if (settingsObj.tree.$element === "group") {
            keys = settingsObj.tree.$children
                .map(e => (e.$element === "group" || e.$element === "folder") && e.key)
                .filter((e) => !!e);
        }
        else if (settingsObj.tree.$element === "folder") {
            keys = fs.readdirSync(settingsObj.tree.path, { encoding: "utf8" });
        }
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
        if (bindWildcard && settings.server.filterBindAddress)
            server.on('connection', (socket) => {
                if (!tester(socket.localAddress).usable && !localhostTester(socket.localAddress).usable)
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
    if (bindWildcard) {
        hosts.push('0.0.0.0');
        if (settings.server.enableIPv6)
            hosts.push('::');
    }
    else if (settings.server.filterBindAddress) {
        let ifaces = os_1.networkInterfaces();
        let addresses = Object.keys(ifaces)
            .reduce((n, k) => n.concat(ifaces[k]), [])
            .filter(e => (settings.server.enableIPv6 || e.family === "IPv4") && tester(e.address).usable)
            .map(e => e.address);
        hosts.push(...addresses);
    }
    else {
        hosts.push(...settings.server.bindAddress);
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
        exports.eventer.emit("serverOpen", servers, hosts, false);
        let ifaces = os_1.networkInterfaces();
        console.log('Open your browser and type in one of the following:\n' +
            (settings.server.bindWildcard
                ? Object.keys(ifaces)
                    .reduce((n, k) => n.concat(ifaces[k]), []).filter(e => (settings.server.enableIPv6 || e.family === "IPv4")
                    && (!settings.server.filterBindAddress || tester(e.address).usable)).map(e => e.address)
                : hosts).join('\n'));
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
            const state = new server_types_1.StateObject(ev.request, ev.response, debug, exports.eventer);
            //handle basic auth
            // if (!handleBasicAuth(state)) return;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsb0RBQW1EO0FBQ25ELE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUd2QixrQ0FFbUI7QUFFbkIsaURBWXdCO0FBRXhCLDZCQUE0QjtBQUM1Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUF1QztBQUN2QyxtQ0FBc0M7QUFHdEMsaURBQWlEO0FBRWpELDRDQUE0QztBQUU1QyxNQUFNLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxHQUFHLGdCQUFFLENBQUM7QUFFdkMsU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFFOUQsS0FBSyxDQUFDLGVBQWUsR0FBRyxRQUFRLENBQUM7QUFFakMsT0FBTyxDQUFDLEtBQUssR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLHFCQUFxQjtBQUV0RCxzQkFBc0I7QUFDVCxRQUFBLE9BQU8sR0FBRyxJQUFJLHFCQUFZLEVBQXdCLENBQUM7QUFDaEUsTUFBTSxLQUFLLEdBQUcsMEJBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUVqQyxJQUFVLEdBQUcsQ0FFWjtBQUZELFdBQVUsR0FBRztJQUNELG9CQUFnQixHQUFZLEtBQUssQ0FBQztBQUM5QyxDQUFDLEVBRlMsR0FBRyxLQUFILEdBQUcsUUFFWjtBQUFBLENBQUM7QUFFRixJQUFJLFFBQXNCLENBQUM7QUFNM0IsNEJBQTRCO0FBQzVCLGlEQUEwRztBQUMxRyxpREFBOEQ7QUFHOUQsMkJBQTZEO0FBRTdELG1CQUFlLENBQUMsZUFBTyxDQUFDLENBQUM7QUFDekIsbUJBQWdCLENBQUMsZUFBTyxDQUFDLENBQUM7QUFDMUIsMkJBQVksQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUV0QixpRUFBaUU7QUFFakUsTUFBTSxNQUFNLEdBQUcsSUFBSSxD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