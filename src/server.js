"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bundled_lib_1 = require("../lib/bundled-lib");
const sendOptions = {};
// import {
// 	Observable, Subject, Subscription, BehaviorSubject, Subscriber
// } from '../lib/rx';
const server_types_1 = require("./server-types");
exports.loadSettings = server_types_1.loadSettings;
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const events_1 = require("events");
const os_1 = require("os");
const interfacechecker_1 = require("./interfacechecker");
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
    // console.log(JSON.stringify(set, null, 2));
    if (!interfacechecker_1.checkServerConfig(set))
        throw "ServerConfig did not pass validator";
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
            if (!ev2.handled) { // we give the preflighter the option to handle the websocket on its own
                if (!settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey].websockets)
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
async function initServer({ preflighter, settingshttps }) {
    // settings = options.settings;
    if (!settings)
        throw "The settings object must be emitted on eventer before starting the server";
    // const { preflighter, env, listenCB, settingshttps } = options;
    // eventer.emit('settings', settings);
    const hosts = [];
    const bindWildcard = settings.bindInfo.bindWildcard;
    const tester = server_types_1.parseHostList([...settings.bindInfo.bindAddress, "-127.0.0.0/8"]);
    const localhostTester = server_types_1.parseHostList(["127.0.0.0/8"]);
    await bundled_lib_1.libsodium.ready;
    bundled_lib_1.send.mime.define(settings.directoryIndex.mimetypes);
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
    Promise.all(hosts.map(host => {
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
        return new Promise(resolve => {
            server.listen(settings.bindInfo.port, host, undefined, () => { resolve(); });
        });
    })).then(() => {
        exports.eventer.emit("serverOpen", servers, hosts, !!settingshttps);
        let ifaces = os_1.networkInterfaces();
        console.log('Open your browser and type in one of the following:\n' +
            (settings.bindInfo.bindWildcard
                ? Object.keys(ifaces)
                    .reduce((n, k) => n.concat(ifaces[k]), []).filter(e => (settings.bindInfo.enableIPv6 || e.family === "IPv4")
                    && (!settings.bindInfo.filterBindAddress || tester(e.address).usable)).map(e => e.address)
                : hosts
                    .map(e => (settings.bindInfo.https ? "https" : "http") + "://" + e + ":" + settings.bindInfo.port)).join('\n'));
    }, (x) => {
        console.log("Error thrown while starting server");
        console.log(x);
    });
    return exports.eventer;
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
    //determine localAddressPermissions to be applied
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
    // console.log(settings.bindInfo);
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
            //
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
    debugger;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsb0RBQTJFO0FBQzNFLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUd2QixXQUFXO0FBQ1gsa0VBQWtFO0FBQ2xFLHNCQUFzQjtBQUV0QixpREF1QndCO0FBcUNmLHVCQTFDUiwyQkFBWSxDQTBDUTtBQW5DckIsNkJBQTRCO0FBQzVCLCtCQUE4QjtBQUM5Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUF1QztBQUN2QyxtQ0FBc0M7QUFJdEMsMkJBQTZEO0FBRTdELHlEQUF1RDtBQUN2RCxpREFBaUQ7QUFFakQsNENBQTRDO0FBRTVDLE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsZ0JBQVMsQ0FBQztBQUU5QyxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUU5RCxLQUFLLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQztBQUVqQyxPQUFPLENBQUMsS0FBSyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMscUJBQXFCO0FBRXRELHNCQUFzQjtBQUNULFFBQUEsT0FBTyxHQUFHLElBQUkscUJBQVksRUFBd0IsQ0FBQztBQUNoRSxvQ0FBb0M7QUFFcEMsSUFBVSxHQUFHLENBRVo7QUFGRCxXQUFVLEdBQUc7SUFDRCxvQkFBZ0IsR0FBWSxLQUFLLENBQUM7QUFDOUMsQ0FBQyxFQUZTLEdBQUcsS0FBSCxHQUFHLFFBRVo7QUFBQSxDQUFDO0FBRUYsSUFBSSxRQUFzQixDQUFDO0FBQzNCLElBQUksS0FBdUUsQ0FBQztBQUc1RSw0QkFBNEI7QUFDNUIsaURBQTBHO0FBQzFHLGdGQUFnRjtBQUNoRiwyQ0FBOEU7QUFDOUUsbUNBQWtDO0FBR2xDLG1CQUFlLENBQUMsZUFBTyxDQUFDLENBQUM7QUFDekIsbUJBQWdCLENB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