"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const bundled_lib_1 = require("../lib/bundled-lib");
const sendOptions = {};
const rx_1 = require("../lib/rx");
const server_types_1 = require("./server-types");
exports.loadSettings = server_types_1.loadSettings;
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const events_1 = require("events");
const x509 = require("@fidm/x509");
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
// import { handleSettings, initSettings } from './settingsPage';
const authRoute_1 = require("./authRoute");
const os_1 = require("os");
server_types_1.init(exports.eventer);
tiddlyserver_1.init(exports.eventer);
authRoute_1.initAuthRoute(exports.eventer);
// initSettings(eventer);
// eventer.on("settings", (set) => { settings = set });
//emit settings to everyone (I know, this could be an observable)
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
//setup auth checkers
let checkCookieAuth;
/**
Authentication could be done several ways, but the most convenient and secure method is
probably to specify a public key instead of a certificate, and then use that public key
to verify the signiture of the cookie. The cookie would consist of two parts, the first
being an info packet containing the desired username and the key fingerprint, the
second being the signature of the first using the private key. The info packet should also
contain the signature time and should probably be sent to the server in a post request so
the server can set it as an HTTP only cookie. Directory Index would display the current user
info so the user can logout if desired. Data folders would be given the username from the
cookie with the request. The private key could be pasted in during login and stored using
crypto.subtle.
 */
const setAuth = () => {
    let ca = {};
    let up = [];
    let prom = Promise.all(Object.keys(settings.authAccounts).map(k => {
        let cred = settings.authAccounts[k].credentials;
        if (cred.type === "clientKey") {
            return Promise.all(cred.certificateAuthority.map(e => server_types_1.NodePromise(cb => fs.readFile(e, cb))))
                .then(res => res.reduce((n, e) => n.concat(x509.Certificate.fromPEMs(e)), []))
                .then(certs => { ca[k] = certs; });
        }
        else if (cred.type === "password") {
            up.push([k, cred.username, cred.password]);
            return Promise.resolve();
        }
        else
            return Promise.resolve();
    }));
    checkCookieAuth = (request) => {
        if (!request.headers.cookie)
            return "";
        var cookies = {}, rc = request.headers.cookie;
        rc.split(';').forEach(function (cookie) {
            var parts = cookie.split('=');
            cookies[parts.shift().trim()] = parts.length ? decodeURI(parts.join('=')) : "";
        });
        let auth = cookies["TiddlyServerAuth"];
        if (!auth)
            return "";
        else
            return "";
    };
};
exports.eventer.on('settings', (set) => {
    settings = set;
    log = setLog();
    setAuth();
});
exports.eventer.on('settingsChanged', (keys) => {
    // let watch: (keyof ServerConfig["server"])[] = ["server.logAccess", "server.logToConsoleAlso", "server.logColorsToFile"];
    // if (watch.some(e => keys.indexOf(e) > -1)) log = setLog();
});
// === Setup static routes
const routes = {
    'admin': state => handleAdminRoute(state),
    'assets': state => handleAssetsRoute(state),
    'favicon.ico': state => server_types_1.serveFile(state, 'favicon.ico', settings.__assetsDir),
    'directory.css': state => server_types_1.serveFile(state, 'directory.css', settings.__assetsDir),
};
exports.routes = routes;
const libsReady = Promise.all([bundled_lib_1.libsodium.ready]);
exports.libsReady = libsReady;
/**
 * Adds all the listeners required for tiddlyserver to operate.
 *
 * @export
 * @param {(https.Server | http.Server)} server The server instance to initialize
 * @param {string} iface A marker string which is only used for certain debug messages and
 * is passed into the preflighter as `ev.iface`.
 * @param {*} preflighter A preflighter function which may modify data about the request before
 * it is handed off to the router for processing.
 */
function addRequestHandlers(server, iface, preflighter) {
    // const addListeners = () => {
    let closing = false;
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
        let host = request.headers.host;
        let addr = request.socket.localAddress;
        //check host level permissions and the preflighter
        let ev = {
            handled: false,
            hostLevelPermissionsKey: "",
            interface: { host, addr, iface },
            authAccountKey: "",
            request,
            client
        };
        requestHandlerHostLevelChecks(ev, preflighter).then(ev2 => {
            if (!ev2.handled) {
                // we give the preflighter the option to handle the websocket on its own
                if (settings.tiddlyserver.hostLevelPermissions[ev2.hostLevelPermissionsKey].websockets === false)
                    client.close();
                else
                    exports.eventer.emit('websocket-connection', client, request);
            }
        });
    });
    wss.on('error', (error) => {
        debug(-2, 'WS-ERROR %s', util_1.inspect(error));
    });
}
exports.addRequestHandlers = addRequestHandlers;
/**
 * All this function does is create the servers and start listening. The settings object is emitted
 * on the eventer and addListeners is called to add the listeners to each server before
 * it is started. If another project wanted to provide its own server instances, it should
 * first emit the settings event with a valid settings object as the only argument, then call
 * addListeners with each server instance, then call listen on each instance.
 *
 * @export
 * @param {<T extends RequestEvent>(ev: T) => Promise<T>} preflighter
 * @param {(SecureServerOptions | ((host: string) => https.ServerOptions)) | undefined} settingshttps
 * Either an object containing the settings.server.https from settings.json or a function that
 * takes the host string and returns an https.createServer options object. Undefined if not using https.
 * @returns
 */
function initServer({ preflighter, settingshttps }) {
    return __awaiter(this, void 0, void 0, function* () {
        // settings = options.settings;
        if (!settings)
            throw "The settings object must be emitted on eventer before starting the server";
        // const { preflighter, env, listenCB, settingshttps } = options;
        // eventer.emit('settings', settings);
        const hosts = [];
        const bindWildcard = settings.server.bindWildcard;
        const tester = server_types_1.parseHostList([...settings.server.bindAddress, "-127.0.0.0/8"]);
        const localhostTester = server_types_1.parseHostList(["127.0.0.0/8"]);
        yield bundled_lib_1.libsodium.ready;
        if (bindWildcard) {
            //bind to everything and filter elsewhere if needed
            hosts.push('0.0.0.0');
            if (settings.server.enableIPv6)
                hosts.push('::');
        }
        else if (settings.server.filterBindAddress) {
            //bind to all interfaces that match the specified addresses
            let ifaces = os_1.networkInterfaces();
            let addresses = Object.keys(ifaces)
                .reduce((n, k) => n.concat(ifaces[k]), [])
                .filter(e => settings.server.enableIPv6 || e.family === "IPv4" && tester(e.address).usable)
                .map(e => e.address);
            hosts.push(...addresses);
        }
        else {
            //bind to all specified addresses
            hosts.push(...settings.server.bindAddress);
        }
        if (settings.server._bindLocalhost)
            hosts.push('localhost');
        if (hosts.length === 0) {
            let { filterBindAddress, bindAddress, bindWildcard, _bindLocalhost, enableIPv6 } = settings.server;
            console.log(`"No IP addresses will be listened on. This is probably a mistake.
bindWildcard is ${(bindWildcard ? "true" : "false")}
filterBindAddress is ${filterBindAddress ? "true" : "false"}
_bindLocalhost is ${_bindLocalhost ? "true" : "false"}
enableIPv6 is ${enableIPv6 ? "true" : "false"}
bindAddress is ${JSON.stringify(bindAddress, null, 2)}
`);
        }
        let servers = [];
        rx_1.Observable.from(hosts).concatMap(host => {
            let server;
            if (typeof settingshttps === "function") {
                try {
                    server = https.createServer(settingshttps(host));
                }
                catch (e) {
                    console.log("settingshttps function threw for host " + host);
                    console.log(e);
                    throw e;
                }
            }
            else {
                server = http.createServer();
            }
            // let server = settingshttps ? https.createServer(httpsOptions) : http.createServer();
            addRequestHandlers(server, host, preflighter);
            //this one we add here because it is related to the host property rather than just listening
            if (bindWildcard && settings.server.filterBindAddress)
                server.on('connection', (socket) => {
                    if (!tester(socket.localAddress).usable && !localhostTester(socket.localAddress).usable)
                        socket.end();
                });
            servers.push(server);
            return new rx_1.Observable(subs => {
                server.listen(settings.server.port, host, undefined, () => { subs.complete(); });
            });
        }).subscribe(item => { }, x => {
            console.log("Error thrown while starting server");
            console.log(x);
        }, () => {
            exports.eventer.emit("serverOpen", servers, hosts, !!settingshttps);
            let ifaces = os_1.networkInterfaces();
            console.log('Open your browser and type in one of the following:\n' +
                (settings.server.bindWildcard
                    ? Object.keys(ifaces)
                        .reduce((n, k) => n.concat(ifaces[k]), []).filter(e => (settings.server.enableIPv6 || e.family === "IPv4")
                        && (!settings.server.filterBindAddress || tester(e.address).usable)).map(e => e.address)
                    : hosts).join('\n'));
        });
        return exports.eventer;
    });
}
exports.initServer = initServer;
/**
 * handles all checks that apply to the entire server, including
 *  - auth accounts key
 *  - host level permissions key (based on socket.localAddress)
 */
function requestHandlerHostLevelChecks(ev, preflighter) {
    //connections to the wrong IP address are already filtered out by the connection event listener on the server.
    //determine hostLevelPermissions to be applied
    let localAddress = ev.request.socket.localAddress;
    let keys = Object.keys(settings.tiddlyserver.hostLevelPermissions);
    let isLocalhost = server_types_1.testAddress(localAddress, "127.0.0.1", 8);
    let matches = server_types_1.parseHostList(keys)(localAddress);
    if (isLocalhost) {
        ev.hostLevelPermissionsKey = "localhost";
    }
    else if (matches.lastMatch > -1) {
        ev.hostLevelPermissionsKey = keys[matches.lastMatch];
    }
    else {
        ev.hostLevelPermissionsKey = "*";
    }
    ev.authAccountKey = checkCookieAuth(ev.request);
    //send the data to the preflighter
    return preflighter ? preflighter(ev) : Promise.resolve(ev);
}
function requestHandler(iface, preflighter) {
    return (request, response) => {
        let host = request.headers.host;
        let addr = request.socket.localAddress;
        // console.log(host, addr, request.socket.address().address);
        //send the request and response to morgan
        log(request, response).then(() => {
            const ev = {
                handled: false,
                hostLevelPermissionsKey: "",
                authAccountKey: "",
                interface: { host, addr, iface },
                request, response
            };
            //send it to the preflighter
            return requestHandlerHostLevelChecks(ev, preflighter);
        }).then(ev => {
            // check if the preflighter handled it
            if (ev.handled)
                return;
            //create the state object
            const state = new server_types_1.StateObject(ev.request, ev.response, debug, exports.eventer, ev.hostLevelPermissionsKey, ev.authAccountKey);
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
            server_types_1.serveFolder(state, '/assets/static', path.join(settings.__assetsDir, "static"));
            break;
        case "icons":
            server_types_1.serveFolder(state, '/assets/icons', path.join(settings.__assetsDir, "icons"));
            break;
        case "tiddlywiki":
            tiddlyserver_1.handleTiddlyWikiRoute(state);
            break;
        default: state.throw(404);
    }
}
function handleAdminRoute(state) {
    switch (state.path[2]) {
        // case "settings": handleSettings(state); break;
        case "authenticate":
            authRoute_1.handleAuthRoute(state);
            break;
        default: state.throw(404);
    }
}
// function checkBasicAuth(request: http.IncomingMessage): string {
// 	//determine authAccount to be applied
// 	const first = (header?: string | string[]) =>
// 		Array.isArray(header) ? header[0] : header;
// 	var header = first(request.headers['authorization']) || '',  // get the header
// 		token = header.split(/\s+/).pop() || '',                   // and the encoded auth token
// 		auth = new Buffer(token, 'base64').toString(),             // convert from base64
// 		parts = auth.split(/:/),                                   // split on colon
// 		username = parts[0],
// 		password = parts[1];
// 	if (username && password) debug(-3, "Basic Auth recieved");
// 	throw "DEV ERROR: we didn't check if the basic auth is valid";
// 	return username;
// }
function handleBasicAuth(state, settings) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFFQSxvREFBMkU7QUFDM0UsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBR3ZCLGtDQUVtQjtBQUVuQixpREFnQndCO0FBaUNmLHVCQW5DUiwyQkFBWSxDQW1DUTtBQS9CckIsNkJBQTRCO0FBQzVCLCtCQUE4QjtBQUM5Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUF1QztBQUN2QyxtQ0FBc0M7QUFFdEMsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUVqRCw0Q0FBNEM7QUFFNUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsR0FBRyxnQkFBUyxDQUFDO0FBRTlDLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRTlELEtBQUssQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDO0FBRWpDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxxQkFBcUI7QUFFdEQsc0JBQXNCO0FBQ1QsUUFBQSxPQUFPLEdBQUcsSUFBSSxxQkFBWSxFQUF3QixDQUFDO0FBQ2hFLE1BQU0sS0FBSyxHQUFHLDBCQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7QUFFakMsSUFBVSxHQUFHLENBRVo7QUFGRCxXQUFVLEdBQUc7SUFDRCxvQkFBZ0IsR0FBWSxLQUFLLENBQUM7QUFDOUMsQ0FBQyxFQUZTLEdBQUcsS0FBSCxHQUFHLFFBRVo7QUFBQSxDQUFDO0FBRUYsSUFBSSxRQUFzQixDQUFDO0FBSTNCLDRCQUE0QjtBQUM1QixpREFBMEc7QUFDMUcsaUVBQWlFO0FBQ2pFLDJDQUE2RDtBQUc3RCwyQkFBNkQ7QUFHN0QsbUJBQWUsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUN6QixtQkFBZ0IsQ0FBQyxlQUFPLENBQUMsQ0FB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