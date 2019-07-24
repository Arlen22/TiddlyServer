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
const os_1 = require("os");
// import { parse as jsonParse } from 'jsonlint';
// import send = require('../lib/send-lib');
const { Server: WebSocketServer } = bundled_lib_1.ws;
__dirname = path.dirname(module.filename || process.execPath);
Error.stackTraceLimit = Infinity;
console.debug = function () { }; //noop console debug;
//setup global objects
exports.eventer = new events_1.EventEmitter();
// const debug = DebugLogger('APP');
var ENV;
(function (ENV) {
    ENV.disableLocalHost = false;
})(ENV || (ENV = {}));
;
var settings;
var debug;
//import and init api-access
const tiddlyserver_1 = require("./tiddlyserver");
// typescript retains the object reference here ()`authroute_1.checkCookieAuth`)
const authRoute_1 = require("./authRoute");
const stream_1 = require("stream");
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
        logFile: settings.logging.logAccess || undefined,
        logToConsole: !settings.logging.logAccess || settings.logging.logToConsoleAlso,
        logColorsToFile: settings.logging.logColorsToFile
    });
    return settings.logging.logAccess === false
        ? ((...args) => Promise.resolve([]))
        : (...args) => new Promise(resolve => {
            args.push((...args2) => resolve(args2));
            logger.apply(null, args);
        });
}
let log;
//setup auth checkers
// let checkCookieAuth: (request: http.IncomingMessage) => string;
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
exports.eventer.on('settings', (set) => {
    settings = set;
    let debugOutput = MakeDebugOutput(settings);
    debug = server_types_1.StateObject.DebugLogger("SERVER ").bind({ debugOutput, settings });
    log = setLog();
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
            localAddressPermissionsKey: "",
            interface: { host, addr, iface },
            authAccountKey: "",
            treeHostIndex: -1,
            username: "",
            //@ts-ignore
            debugOutput: undefined,
            // settings,
            request,
            client,
            get settings() {
                return settings;
            }
        };
        requestHandlerHostLevelChecks(ev, preflighter).then(ev2 => {
            if (!ev2.handled) {
                // we give the preflighter the option to handle the websocket on its own
                if (settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey].websockets === false)
                    client.close();
                else
                    exports.eventer.emit('websocket-connection', ev);
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
        const bindWildcard = settings.bindInfo.bindWildcard;
        const tester = server_types_1.parseHostList([...settings.bindInfo.bindAddress, "-127.0.0.0/8"]);
        const localhostTester = server_types_1.parseHostList(["127.0.0.0/8"]);
        yield bundled_lib_1.libsodium.ready;
        if (bindWildcard) {
            //bind to everything and filter elsewhere if needed
            hosts.push('0.0.0.0');
            if (settings.bindInfo.enableIPv6)
                hosts.push('::');
        }
        else if (settings.bindInfo.filterBindAddress) {
            //bind to all interfaces that match the specified addresses
            let ifaces = os_1.networkInterfaces();
            let addresses = Object.keys(ifaces)
                .reduce((n, k) => n.concat(ifaces[k]), [])
                .filter(e => settings.bindInfo.enableIPv6 || e.family === "IPv4" && tester(e.address).usable)
                .map(e => e.address);
            hosts.push(...addresses);
        }
        else {
            //bind to all specified addresses
            hosts.push(...settings.bindInfo.bindAddress);
        }
        if (settings.bindInfo._bindLocalhost)
            hosts.push('localhost');
        if (hosts.length === 0) {
            let { filterBindAddress, bindAddress, bindWildcard, _bindLocalhost, enableIPv6 } = settings.bindInfo;
            console.log(`"No IP addresses will be listened on. This is probably a mistake.
bindWildcard is ${(bindWildcard ? "true" : "false")}
filterBindAddress is ${filterBindAddress ? "true" : "false"}
_bindLocalhost is ${_bindLocalhost ? "true" : "false"}
enableIPv6 is ${enableIPv6 ? "true" : "false"}
bindAddress is ${JSON.stringify(bindAddress, null, 2)}
`);
        }
        let servers = [];
        console.log("Creating servers as %s", typeof settingshttps === "function" ? "https" : "http");
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
            if (bindWildcard && settings.bindInfo.filterBindAddress)
                server.on('connection', (socket) => {
                    if (!tester(socket.localAddress).usable && !localhostTester(socket.localAddress).usable)
                        socket.end();
                });
            servers.push(server);
            return new rx_1.Observable(subs => {
                server.listen(settings.bindInfo.port, host, undefined, () => { subs.complete(); });
            });
        }).subscribe(item => { }, x => {
            console.log("Error thrown while starting server");
            console.log(x);
        }, () => {
            exports.eventer.emit("serverOpen", servers, hosts, !!settingshttps);
            let ifaces = os_1.networkInterfaces();
            console.log('Open your browser and type in one of the following:\n' +
                (settings.bindInfo.bindWildcard
                    ? Object.keys(ifaces)
                        .reduce((n, k) => n.concat(ifaces[k]), []).filter(e => (settings.bindInfo.enableIPv6 || e.family === "IPv4")
                        && (!settings.bindInfo.filterBindAddress || tester(e.address).usable)).map(e => e.address)
                    : hosts
                        .map(e => (settings.bindInfo.https ? "https" : "http") + "://" + e + ":" + settings.bindInfo.port)).join('\n'));
        });
        return exports.eventer;
    });
}
exports.initServer = initServer;
/**
 * handles all checks that apply to the entire server (not just inside the tree), including
 * > auth accounts key
 * > local address permissions key (based on socket.localAddress)
 * > host array index
 */
function requestHandlerHostLevelChecks(ev, preflighter) {
    //connections to the wrong IP address are already filtered out by the connection event listener on the server.
    //determine hostLevelPermissions to be applied
    {
        let localAddress = ev.request.socket.localAddress;
        let keys = Object.keys(settings.bindInfo.localAddressPermissions);
        let isLocalhost = server_types_1.testAddress(localAddress, "127.0.0.1", 8);
        let matches = server_types_1.parseHostList(keys)(localAddress);
        if (isLocalhost) {
            ev.localAddressPermissionsKey = "localhost";
        }
        else if (matches.lastMatch > -1) {
            ev.localAddressPermissionsKey = keys[matches.lastMatch];
        }
        else {
            ev.localAddressPermissionsKey = "*";
        }
    }
    // host header is currently not implemented, but could be implemented by the preflighter
    ev.treeHostIndex = 0;
    console.log(settings.bindInfo);
    let { registerNotice } = settings.bindInfo.localAddressPermissions[ev.localAddressPermissionsKey];
    let auth = authRoute_1.checkCookieAuth(ev.request, registerNotice);
    if (auth) {
        ev.authAccountKey = auth[0];
        ev.username = auth[1];
    }
    //send the data to the preflighter
    return (preflighter ? preflighter(ev) : Promise.resolve(ev)).then(ev2 => {
        //sanity checks after the preflighter
        //"always check all variables and sometimes check some constants too" -- Arlen Beiler
        if (ev2.treeHostIndex > settings.tree.length - 1)
            throw util_1.format("treeHostIndex of %s is not within array length of %s", ev2.treeHostIndex, settings.tree.length);
        if (!settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey])
            throw util_1.format("localAddressPermissions key of %s does not exist", ev2.localAddressPermissionsKey);
        if (ev2.authAccountKey && !settings.authAccounts[ev2.authAccountKey])
            throw util_1.format("authAccounts key of %s does not exist", ev2.authAccountKey);
        // let settings: never;
        if (!ev2.debugOutput)
            ev2.debugOutput = MakeDebugOutput(ev2.settings);
        return ev2;
    });
}
function MakeDebugOutput(settings) {
    const colorsRegex = /\x1b\[[0-9]+m/gi;
    return new stream_1.Writable({
        write: function (chunk, encoding, callback) {
            // if we're given a buffer, convert it to a string
            if (Buffer.isBuffer(chunk))
                chunk = chunk.toString('utf8');
            // remove ending linebreaks for consistency
            chunk = chunk.slice(0, chunk.length - (chunk.endsWith("\r\n") ? 2 : +chunk.endsWith("\n")));
            if (settings.logging.logError) {
                fs.appendFileSync(settings.logging.logError, (settings.logging.logColorsToFile ? chunk : chunk.replace(colorsRegex, "")) + "\r\n", { encoding: "utf8" });
            }
            if (!settings.logging.logError || settings.logging.logToConsoleAlso) {
                console.log(chunk);
            }
            callback && callback();
            return true;
        }
    });
    ;
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
                localAddressPermissionsKey: "",
                authAccountKey: "",
                username: "",
                treeHostIndex: 0,
                interface: { host, addr, iface },
                //@ts-ignore
                debugOutput: undefined,
                request, response, settings
            };
            //send it to the preflighter
            return requestHandlerHostLevelChecks(ev, preflighter);
        }).then(ev => {
            // check if the preflighter handled it
            if (ev.handled)
                return;
            //create the state object
            const state = new server_types_1.StateObject(ev.request, ev.response, 
            // debug,
            exports.eventer, ev.localAddressPermissionsKey, ev.authAccountKey, ev.treeHostIndex, ev.username, ev.settings, ev.debugOutput);
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
// const errLog = DebugLogger('STA-ERR');
exports.eventer.on("stateError", (state) => {
    if (state.doneMessage.length > 0)
        server_types_1.StateObject.DebugLogger("STA-ERR").call(state, 2, state.doneMessage.join('\n'));
});
exports.eventer.on("stateDebug", (state) => {
    if (state.doneMessage.length > 0)
        server_types_1.StateObject.DebugLogger("STA-DBG").call(state, -2, state.doneMessage.join('\n'));
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
        server_types_1.StateObject.DebugLogger("AUTH   ").call(state, -2, 'authorization required');
        state.respond(401, "", { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' }).empty();
        return false;
    }
    server_types_1.StateObject.DebugLogger("AUTH   ").call(state, -3, 'authorization requested');
    var header = first(state.req.headers['authorization']) || '', // get the header
    token = header.split(/\s+/).pop() || '', // and the encoded auth token
    auth = new Buffer(token, 'base64').toString(), // convert from base64
    parts = auth.split(/:/), // split on colon
    username = parts[0], password = parts[1];
    if (username !== settings.username || password !== settings.password) {
        server_types_1.StateObject.DebugLogger("AUTH   ").call(state, -2, 'authorization invalid - UN:%s - PW:%s', username, password);
        state.throwReason(401, 'Invalid username or password');
        return false;
    }
    server_types_1.StateObject.DebugLogger("AUTH   ").call(state, -3, 'authorization successful');
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFFQSxvREFBMkU7QUFDM0UsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBR3ZCLGtDQUVtQjtBQUVuQixpREFrQndCO0FBcUNmLHVCQTFDUiwyQkFBWSxDQTBDUTtBQW5DckIsNkJBQTRCO0FBQzVCLCtCQUE4QjtBQUM5Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUF1QztBQUN2QyxtQ0FBc0M7QUFJdEMsMkJBQTZEO0FBRzdELGlEQUFpRDtBQUVqRCw0Q0FBNEM7QUFFNUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsR0FBRyxnQkFBUyxDQUFDO0FBRTlDLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRTlELEtBQUssQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDO0FBRWpDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxxQkFBcUI7QUFFdEQsc0JBQXNCO0FBQ1QsUUFBQSxPQUFPLEdBQUcsSUFBSSxxQkFBWSxFQUF3QixDQUFDO0FBQ2hFLG9DQUFvQztBQUVwQyxJQUFVLEdBQUcsQ0FFWjtBQUZELFdBQVUsR0FBRztJQUNELG9CQUFnQixHQUFZLEtBQUssQ0FBQztBQUM5QyxDQUFDLEVBRlMsR0FBRyxLQUFILEdBQUcsUUFFWjtBQUFBLENBQUM7QUFFRixJQUFJLFFBQXNCLENBQUM7QUFDM0IsSUFBSSxLQUF1RSxDQUFDO0FBRzVFLDRCQUE0QjtBQUM1QixpREFBMEc7QUFDMUcsZ0ZBQWdGO0FBQ2hGLDJDQUE4RTtBQUM5RSxtQ0FBa0M7QUFHbEMsbUJBQWUsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUN6QixtQkFBZ0IsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUMxQix5QkFB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