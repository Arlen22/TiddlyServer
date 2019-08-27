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
exports.checkServerConfig = interfacechecker_1.checkServerConfig;
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
    if (interfacechecker_1.checkServerConfig(set) !== true)
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
 * @param {boolean} dryRun Creates the servers and sets everything up but does not start listening
 * Either an object containing the settings.server.https from settings.json or a function that
 * takes the host string and returns an https.createServer options object. Undefined if not using https.
 * @returns
 */
async function initServer({ preflighter, settingshttps, dryRun }) {
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
    if (!settingshttps)
        console.log("Remember that any login credentials are being sent in the clear");
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
            dryRun ? resolve() : server.listen(settings.bindInfo.port, host, undefined, () => { resolve(); });
        });
    })).then(() => {
        exports.eventer.emit("serverOpen", servers, hosts, !!settingshttps, dryRun);
        let ifaces = os_1.networkInterfaces();
        console.log('Open your browser and type in one of the following:\n' +
            (settings.bindInfo.bindWildcard
                ? Object.keys(ifaces)
                    .reduce((n, k) => n.concat(ifaces[k]), []).filter(e => (settings.bindInfo.enableIPv6 || e.family === "IPv4")
                    && (!settings.bindInfo.filterBindAddress || tester(e.address).usable)).map(e => e.address)
                : hosts
                    .map(e => (settings.bindInfo.https ? "https" : "http") + "://" + e + ":" + settings.bindInfo.port)).join('\n'));
        if (dryRun)
            console.log("DRY RUN: No further processing is likely to happen");
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
        if (ev2.handled)
            return ev2; //cancel early if it is handled
        //sanity checks after the preflighter
        //"always check all variables and sometimes check some constants too" -- Arlen Beiler
        //@ts-ignore
        if (!ev.response !== !ev2.response || !ev.client !== !ev2.client)
            throw new Error("DEV: Request Event types got mixed up");
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
        // case "tiddlywiki": handleTiddlyWikiRoute(state); break;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsb0RBQTJFO0FBQzNFLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUd2QixXQUFXO0FBQ1gsa0VBQWtFO0FBQ2xFLHNCQUFzQjtBQUV0QixpREF1QndCO0FBc0NmLHVCQTNDUiwyQkFBWSxDQTJDUTtBQXBDckIsNkJBQTRCO0FBQzVCLCtCQUE4QjtBQUM5Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLCtCQUF1QztBQUN2QyxtQ0FBc0M7QUFJdEMsMkJBQTZEO0FBRTdELHlEQUF1RDtBQUM5Qyw0QkFEQSxvQ0FBaUIsQ0FDQTtBQUMxQixpREFBaUQ7QUFFakQsNENBQTRDO0FBRTVDLE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsZ0JBQVMsQ0FBQztBQUU5QyxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUU5RCxLQUFLLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQztBQUVqQyxPQUFPLENBQUMsS0FBSyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMscUJBQXFCO0FBRXRELHNCQUFzQjtBQUNULFFBQUEsT0FBTyxHQUFHLElBQUkscUJBQVksRUFBd0IsQ0FBQztBQUNoRSxvQ0FBb0M7QUFFcEMsSUFBVSxHQUFHLENBRVo7QUFGRCxXQUFVLEdBQUc7SUFDRCxvQkFBZ0IsR0FBWSxLQUFLLENBQUM7QUFDOUMsQ0FBQyxFQUZTLEdBQUcsS0FBSCxHQUFHLFFBRVo7QUFBQSxDQUFDO0FBRUYsSUFBSSxRQUFzQixDQUFDO0FBQzNCLElBQUksS0FBdUUsQ0FBQztBQUc1RSw0QkFBNEI7QUFDNUIsaURBQTBHO0FBQzFHLGdGQUFnRjtBQUNoRiwyQ0FBOEU7QUFDOUUsbUNBQWtDO0FBR2xDLG1CQUFlLENBQUMsZUFBTyxD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