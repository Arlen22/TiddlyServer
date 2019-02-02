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
    let publicKeyLookup = {};
    let passwordLookup = {};
    const { crypto_generichash, crypto_generichash_BYTES, crypto_sign_SECRETKEYBYTES, crypto_sign_keypair, crypto_sign_open, from_base64, crypto_sign_verify_detached, randombytes_buf } = bundled_lib_1.libsodium;
    let passwordKey = crypto_sign_keypair("uint8array");
    Object.keys(settings.authAccounts).forEach(k => {
        Object.keys(settings.authAccounts[k].clientKeys).forEach(u => {
            const publicKey = settings.authAccounts[k].clientKeys[u];
            let publicHash = crypto_generichash(crypto_generichash_BYTES, publicKey, undefined, "base64");
            if (!publicKeyLookup[publicHash + u])
                publicKeyLookup[publicHash + u] = k;
            else
                throw "publicKey+username combination is used for more than one authAccount";
        });
        Object.keys(settings.authAccounts[k].passwords).forEach(u => {
            const password = settings.authAccounts[k].passwords[u];
            let passHash = crypto_generichash(crypto_generichash_BYTES, password, undefined, "base64");
            if (!passwordLookup[u])
                passwordLookup[u] = k;
            else
                throw "username is used for more than one authAccount password list";
        });
    });
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
        let json = server_types_1.tryParseJSON(auth);
        if (!json)
            return "";
        let [type, username, timestamp, hash, sig] = json;
        let valid = crypto_sign_verify_detached(from_base64(sig), username + timestamp + hash, type === "key" ? from_base64(publicKeyLookup[hash + username]) : passwordKey.publicKey);
        if (!valid)
            return "";
        return username;
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
            const state = new server_types_1.StateObject(ev.request, ev.response, debug, exports.eventer, ev.hostLevelPermissionsKey, ev.authAccountKey, settings);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFFQSxvREFBMkU7QUFDM0UsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBR3ZCLGtDQUVtQjtBQUVuQixpREFld0I7QUFpQ2YsdUJBbkNSLDJCQUFZLENBbUNRO0FBL0JyQiw2QkFBNEI7QUFDNUIsK0JBQThCO0FBRTlCLDZCQUE2QjtBQUU3QiwrQkFBdUM7QUFDdkMsbUNBQXNDO0FBR3RDLGlEQUFpRDtBQUVqRCw0Q0FBNEM7QUFFNUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsR0FBRyxnQkFBUyxDQUFDO0FBRTlDLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRTlELEtBQUssQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDO0FBRWpDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxxQkFBcUI7QUFFdEQsc0JBQXNCO0FBQ1QsUUFBQSxPQUFPLEdBQUcsSUFBSSxxQkFBWSxFQUF3QixDQUFDO0FBQ2hFLE1BQU0sS0FBSyxHQUFHLDBCQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7QUFFakMsSUFBVSxHQUFHLENBRVo7QUFGRCxXQUFVLEdBQUc7SUFDRCxvQkFBZ0IsR0FBWSxLQUFLLENBQUM7QUFDOUMsQ0FBQyxFQUZTLEdBQUcsS0FBSCxHQUFHLFFBRVo7QUFBQSxDQUFDO0FBRUYsSUFBSSxRQUFzQixDQUFDO0FBSTNCLDRCQUE0QjtBQUM1QixpREFBMEc7QUFDMUcsaUVBQWlFO0FBQ2pFLDJDQUE2RDtBQUc3RCwyQkFBNkQ7QUFHN0QsbUJBQWUsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUN6QixtQkFBZ0IsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUMxQix5QkFBYSxDQUFDLGVBQU8sQ0FBQyxDQUFDO0FBQ3ZCLHlCQUF5QjtBQUN6Qix1REFBdUQ7QUFDdkQsaUVBQWlFO0FBR2pFLG9CQUFvQjtBQUNwQixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUMzQztJQUNDLE1BQU0sTUFBTSxHQUFhLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDdkMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLFNBQVM7UUFDL0MsWUFBWSxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFTLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0I7UUFDNUUsZUFBZSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsZUFBZTtLQUNoRCxDQUFDLENBQUM7SUFDSCxPQUFPLFFBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxLQUFLLEtBQUs7UUFDekMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQVcsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMzQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBWSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUMvQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMxQixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFDRCxJQUFJLEdBQXlFLENBQUM7QUFFOUUscUJBQXFCO0FBQ3JCLElBQUksZUFBMEQsQ0FBQztBQUMvRDs7Ozs7Ozs7Ozs7R0FXRztBQUNILE1BQU0sT0FBTyxHQUFHLEdBQUcsRUFBRTtJQUNwQixJQUFJLEVBQUUsR0FBdUMsRUFBRSxDQUFDO0lBQ2hELElBQUksRUFBRSxHQUErQixFQUFTLENBQUM7SUFDL0MsSUFBSSxlQUFlLEdBQTJCLEVBQUUsQ0FBQztJQUNqRCxJQUFJLGNBQWMsR0FBMkIsRUFBRSxDQUFDO0lBQ2hELE1BQU0sRUFBRSxrQkFBa0IsRUFBRSx3QkFBd0IsRUFBRSwwQkFBMEIsRUFBRSxtQkFBbUIsRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLEVBQUUsMkJBQTJCLEVBQUUsZUFBZSxFQUFFLEdBQUcsdUJBQVMsQ0FBQztJQUNqTSxJQUFJLFdBQVcsR0FBRyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNwRCxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDOUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUM1RCxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6RCxJQUFJLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQyx3QkFBd0IsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQzlGLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQztnQkFBRSxlQUFlLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQzs7Z0JBQ3JFLE1BQU0sc0VBQXNFLENBQUM7UUFDbkYsQ0FBQyxDQUFDLENBQUE7UUFDRixNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQzNELE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZELElBQUksUUFBUSxHQUFHLGtCQUFrQixDQUFDLHdCQUF3QixFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDM0YsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQzs7Z0JBQ3pDLE1BQU0sOERBQThELENBQUM7UUFDM0UsQ0FBQyxDQUFDLENBQUE7SUFDSCxDQUFDLENBQUMsQ0FBQTtJQUVGLGVBQWUsR0FBRyxDQUFDLE9BQTZCLEVBQUUsRUFBRTtRQUNuRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDdkMsSUFBSSxPQUFPLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQWdCLENBQUM7UUFDeEQsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxNQUFNO1lBQ3JDLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUIsT0FBTyxDQUFFLEtBQUssQ0FBQyxLQUFLLEVBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUM1RixDQUFDLENBQUMsQ0FBQztRQUNILElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBVyxDQUFDO1FBQ2pELElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDckIsSUFBSSxJQUFJLEdBQUcsMkJBQVksQ0FBaUQsSUFBSSxDQUFDLENBQUM7UUFDOUUsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUVyQixJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNsRCxJQUFJLEtBQUssR0FBRywyQkFBMkIsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEVBQ3ZELFFBQVEsR0FBRyxTQUFTLEdBQUcsSUFBSSxFQUMzQixJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUN0RixDQUFDO1FBQ0YsSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUN0QixPQUFPLFFBQVEsQ0FBQztJQUVqQixDQUFDLENBQUM7QUFFSCxDQUFDLENBQUE7QUFFRCxlQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFO0lBQzlCLFFBQVEsR0FBRyxHQUFHLENBQUM7SUFDZixHQUFHLEdBQUcsTUFBTSxFQUFFLENBQUM7SUFDZixPQUFPLEVBQUUsQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFDO0FBQ0gsZUFBTyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO0lBQ3RDLDJIQUEySDtJQUMzSCw2REFBNkQ7QUFDOUQsQ0FBQyxDQUFDLENBQUE7QUFFRiwwQkFBMEI7QUFDMUIsTUFBTSxNQUFNLEdBQUc7SUFDZCxPQUFPLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7SUFDekMsUUFBUSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDO0lBQzNDLGFBQWEsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLHdCQUFTLENBQUMsS0FBSyxFQUFFLGFBQWEsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDO0lBQzdFLGVBQWUsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLHdCQUFTLENBQUMsS0FBSyxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDO0NBQ2pGLENBQUM7QUFJTyx3QkFBTTtBQUhmLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyx1QkFBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFHaEMsOEJBQVM7QUEwQjFCOzs7Ozs7Ozs7R0FTRztBQUNILDRCQUFtQyxNQUFrQyxFQUFFLEtBQWEsRUFBRSxXQUFXO0lBQ2hHLCtCQUErQjtJQUMvQixJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFcEIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO0lBQ3pELE1BQU0sQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtRQUMzQixLQUFLLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3hDLENBQUMsQ0FBQyxDQUFBO0lBQ0YsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUMxQixLQUFLLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEQsS0FBSyxDQUFDLENBQUMsRUFBRSxxQkFBcUIsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xELE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNmLGVBQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3BDLENBQUMsQ0FBQyxDQUFBO0lBQ0YsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO1FBQ3ZCLElBQUksQ0FBQyxPQUFPO1lBQUUsZUFBTyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDakQsS0FBSyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0lBQ2hCLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSxlQUFlLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzVDLEdBQUcsQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsTUFBaUIsRUFBRSxPQUE2QixFQUFFLEVBQUU7UUFDekUsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDaEMsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7UUFDdkMsa0RBQWtEO1FBQ2xELElBQUksRUFBRSxHQUFtQjtZQUN4QixPQUFPLEVBQUUsS0FBSztZQUNkLHVCQUF1QixFQUFFLEVBQUU7WUFDM0IsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUU7WUFDaEMsY0FBYyxFQUFFLEVBQUU7WUFDbEIsT0FBTztZQUNQLE1BQU07U0FDTixDQUFDO1FBQ0YsNkJBQTZCLENBQUMsRUFBRSxFQUFFLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN6RCxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRTtnQkFDakIsd0VBQXdFO2dCQUN4RSxJQUFJLFFBQVEsQ0FBQyxZQUFZLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUMsVUFBVSxLQUFLLEtBQUs7b0JBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDOztvQkFDNUcsZUFBTyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDM0Q7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0gsR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtRQUN6QixLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxFQUFFLGNBQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzFDLENBQUMsQ0FBQyxDQUFDO0FBRUosQ0FBQztBQTdDRCxnREE2Q0M7QUFDRDs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsb0JBQWlDLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFLNUQ7O1FBQ0EsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxRQUFRO1lBQUUsTUFBTSwyRUFBMkUsQ0FBQztRQUNqRyxpRUFBaUU7UUFDakUsc0NBQXNDO1FBQ3RDLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztRQUMzQixNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUNsRCxNQUFNLE1BQU0sR0FBRyw0QkFBYSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFBO1FBQzlFLE1BQU0sZUFBZSxHQUFHLDRCQUFhLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBRXZELE1BQU0sdUJBQVMsQ0FBQyxLQUFLLENBQUM7UUFFdEIsSUFBSSxZQUFZLEVBQUU7WUFDakIsbURBQW1EO1lBQ25ELEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDdEIsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLFVBQVU7Z0JBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNqRDthQUFNLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRTtZQUM3QywyREFBMkQ7WUFDM0QsSUFBSSxNQUFNLEdBQUcsc0JBQWlCLEVBQUUsQ0FBQztZQUNqQyxJQUFJLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztpQkFDakMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUE0QixDQUFDO2lCQUNuRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztpQkFDMUYsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3RCLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztTQUN6QjthQUFNO1lBQ04saUNBQWlDO1lBQ2pDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQzNDO1FBQ0QsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLGNBQWM7WUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzVELElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDdkIsSUFBSSxFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUM7WUFDbkcsT0FBTyxDQUFDLEdBQUcsQ0FBQztrQkFDSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7dUJBQzVCLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU87b0JBQ3ZDLGNBQWMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO2dCQUNyQyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTztpQkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztDQUNwRCxDQUFDLENBQUM7U0FDRDtRQUNELElBQUksT0FBTyxHQUFtQyxFQUFFLENBQUM7UUFDakQsZUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDdkMsSUFBSSxNQUFNLENBQUM7WUFDWCxJQUFJLE9BQU8sYUFBYSxLQUFLLFVBQVUsRUFBRTtnQkFDeEMsSUFBSTtvQkFDSCxNQUFNLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztpQkFDakQ7Z0JBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ1gsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3Q0FBd0MsR0FBRyxJQUFJLENBQUMsQ0FBQztvQkFDN0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDZixNQUFNLENBQUMsQ0FBQztpQkFDUjthQUNEO2lCQUFNO2dCQUNOLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7YUFDN0I7WUFFRCx1RkFBdUY7WUFDdkYsa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztZQUM5Qyw0RkFBNEY7WUFDNUYsSUFBSSxZQUFZLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUI7Z0JBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtvQkFDekYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNO3dCQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDdkcsQ0FBQyxDQUFDLENBQUE7WUFDRixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3JCLE9BQU8sSUFBSSxlQUFVLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzVCLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsRixDQUFDLENBQUMsQ0FBQTtRQUNILENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7WUFDbEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoQixDQUFDLEVBQUUsR0FBRyxFQUFFO1lBQ1AsZUFBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDNUQsSUFBSSxNQUFNLEdBQUcsc0JBQWlCLEVBQUUsQ0FBQztZQUNqQyxPQUFPLENBQUMsR0FBRyxDQUFDLHVEQUF1RDtnQkFDbEUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFlBQVk7b0JBQzVCLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQzt5QkFDbkIsTUFBTSxDQUNOLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFDN0IsRUFBNEIsQ0FDNUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FDWixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDOzJCQUNoRCxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUNuRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7b0JBQ3RCLENBQUMsQ0FBQyxLQUFLLENBQ1AsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQ1osQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxlQUFPLENBQUM7SUFDaEIsQ0FBQztDQUFBO0FBM0ZELGdDQTJGQztBQUNEOzs7O0dBSUc7QUFDSCx1Q0FDQyxFQUFLLEVBQ0wsV0FBbUM7SUFFbkMsOEdBQThHO0lBQzlHLDhDQUE4QztJQUM5QyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7SUFDbEQsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDbkUsSUFBSSxXQUFXLEdBQUcsMEJBQVcsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzVELElBQUksT0FBTyxHQUFHLDRCQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDaEQsSUFBSSxXQUFXLEVBQUU7UUFDaEIsRUFBRSxDQUFDLHVCQUF1QixHQUFHLFdBQVcsQ0FBQztLQUN6QztTQUFNLElBQUksT0FBTyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFBRTtRQUNsQyxFQUFFLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUNyRDtTQUFNO1FBQ04sRUFBRSxDQUFDLHVCQUF1QixHQUFHLEdBQUcsQ0FBQztLQUNqQztJQUVELEVBQUUsQ0FBQyxjQUFjLEdBQUcsZUFBZSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUdoRCxrQ0FBa0M7SUFDbEMsT0FBTyxXQUFXLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM1RCxDQUFDO0FBQ0Qsd0JBQXdCLEtBQWEsRUFBRSxXQUFpRTtJQUN2RyxPQUFPLENBQUMsT0FBNkIsRUFBRSxRQUE2QixFQUFFLEVBQUU7UUFDdkUsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDaEMsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7UUFDdkMsNkRBQTZEO1FBQzdELHlDQUF5QztRQUN6QyxHQUFHLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDaEMsTUFBTSxFQUFFLEdBQXFCO2dCQUM1QixPQUFPLEVBQUUsS0FBSztnQkFDZCx1QkFBdUIsRUFBRSxFQUFFO2dCQUMzQixjQUFjLEVBQUUsRUFBRTtnQkFDbEIsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUU7Z0JBQ2hDLE9BQU8sRUFBRSxRQUFRO2FBQ2pCLENBQUM7WUFDRiw0QkFBNEI7WUFDNUIsT0FBTyw2QkFBNkIsQ0FBQyxFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDdkQsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ1osc0NBQXNDO1lBQ3RDLElBQUksRUFBRSxDQUFDLE9BQU87Z0JBQUUsT0FBTztZQUN2Qix5QkFBeUI7WUFDekIsTUFBTSxLQUFLLEdBQUcsSUFBSSwwQkFBVyxDQUM1QixFQUFFLENBQUMsT0FBTyxFQUNWLEVBQUUsQ0FBQyxRQUFRLEVBQ1gsS0FBSyxFQUNMLGVBQU8sRUFDUCxFQUFFLENBQUMsdUJBQXVCLEVBQzFCLEVBQUUsQ0FBQyxjQUFjLEVBQ2pCLFFBQVEsQ0FDUixDQUFDO1lBQ0YsbUJBQW1CO1lBQ25CLHVDQUF1QztZQUN2Qyx5QkFBeUI7WUFDekIsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwQyxrQkFBa0I7WUFDbEIsSUFBSSxLQUFLO2dCQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN4QixtQ0FBbUM7O2dCQUM5QixzQ0FBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDZCwyREFBMkQ7WUFDM0QsS0FBSyxDQUFDLENBQUMsRUFBRSx5Q0FBeUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN0RixtQ0FBbUM7WUFDbkMsSUFBSSxHQUFHLENBQUMsS0FBSztnQkFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQTtBQUNGLENBQUM7QUFFRCxNQUFNLE1BQU0sR0FBRywwQkFBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3hDLGVBQU8sQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDbEMsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDO1FBQy9CLE1BQU0sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMxQyxDQUFDLENBQUMsQ0FBQTtBQUNGLE1BQU0sTUFBTSxHQUFHLDBCQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDeEMsZUFBTyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNsQyxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUM7UUFDL0IsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDLENBQUE7QUFHRiwyQkFBMkIsS0FBa0I7SUFDNUMsUUFBUSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ3RCLEtBQUssUUFBUTtZQUFFLDBCQUFXLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQUMsTUFBTTtRQUN0RyxLQUFLLE9BQU87WUFBRSwwQkFBVyxDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFBQyxNQUFNO1FBQ25HLEtBQUssWUFBWTtZQUFFLG9DQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQUMsTUFBTTtRQUN2RCxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQzFCO0FBQ0YsQ0FBQztBQUVELDBCQUEwQixLQUFrQjtJQUMzQyxRQUFRLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDdEIsaURBQWlEO1FBQ2pELEtBQUssY0FBYztZQUFFLDJCQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7WUFBQyxNQUFNO1FBQ25ELE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDMUI7QUFDRixDQUFDO0FBRUQsbUVBQW1FO0FBQ25FLHlDQUF5QztBQUN6QyxpREFBaUQ7QUFDakQsZ0RBQWdEO0FBQ2hELGtGQUFrRjtBQUNsRiw2RkFBNkY7QUFDN0Ysc0ZBQXNGO0FBQ3RGLGlGQUFpRjtBQUNqRix5QkFBeUI7QUFDekIseUJBQXlCO0FBQ3pCLCtEQUErRDtBQUMvRCxrRUFBa0U7QUFDbEUsb0JBQW9CO0FBQ3BCLElBQUk7QUFFSix5QkFBeUIsS0FBa0IsRUFBRSxRQUFnRDtJQUM1RixvREFBb0Q7SUFDcEQsb0NBQW9DO0lBQ3BDLG9DQUFvQztJQUNwQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDMUQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUEwQixFQUFFLEVBQUUsQ0FDNUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDNUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBQ3hDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1FBQ3BDLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLGtCQUFrQixFQUFFLDRCQUE0QixFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25ILE9BQU8sS0FBSyxDQUFDO0tBQ2I7SUFDRCxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUseUJBQXlCLENBQUMsQ0FBQztJQUNyQyxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUcsaUJBQWlCO0lBQy9FLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBb0IsNkJBQTZCO0lBQ3hGLElBQUksR0FBRyxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQWMsc0JBQXNCO0lBQ2pGLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFvQyxpQkFBaUI7SUFDNUUsUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFDbkIsUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyQixJQUFJLFFBQVEsS0FBSyxRQUFRLENBQUMsUUFBUSxJQUFJLFFBQVEsS0FBSyxRQUFRLENBQUMsUUFBUSxFQUFFO1FBQ3JFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSx1Q0FBdUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkUsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsOEJBQThCLENBQUMsQ0FBQztRQUN2RCxPQUFPLEtBQUssQ0FBQztLQUNiO0lBQ0QsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLDBCQUEwQixDQUFDLENBQUE7SUFDckMsdUNBQXVDO0lBRXZDLE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQyJ9