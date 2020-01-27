"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os_1 = require("os");
const path = require("path");
const stream_1 = require("stream");
const util_1 = require("util");
const bundled_lib_1 = require("../lib/bundled-lib");
const morgan_1 = require("../lib/morgan");
const authRoute_1 = require("./authRoute");
const interfacechecker_1 = require("./interfacechecker");
exports.checkServerConfig = interfacechecker_1.checkServerConfig;
const server_types_1 = require("./server-types");
exports.loadSettings = server_types_1.loadSettings;
const tiddlyserver_1 = require("./tiddlyserver");
const { Server: WebSocketServer } = bundled_lib_1.ws;
// global settings
Error.stackTraceLimit = Infinity;
console.debug = function () { }; //noop console debug;
// this is the internal communicator
exports.eventer = new events_1.EventEmitter();
// external flags combine here
var ENV;
(function (ENV) {
    ENV.disableLocalHost = false;
})(ENV || (ENV = {}));
;
server_types_1.init(exports.eventer);
tiddlyserver_1.init(exports.eventer);
authRoute_1.initAuthRoute(exports.eventer);
exports.eventer.on('settings', (set) => {
    if (interfacechecker_1.checkServerConfig(set)[0] !== true)
        throw "ServerConfig did not pass validator";
});
const routes = {
    'admin': state => handleAdminRoute(state),
    'assets': state => handleAssetsRoute(state),
    'favicon.ico': state => server_types_1.serveFile(state, 'favicon.ico', state.settings.__assetsDir),
    'directory.css': state => server_types_1.serveFile(state, 'directory.css', state.settings.__assetsDir),
};
exports.routes = routes;
function handleAssetsRoute(state) {
    switch (state.path[2]) {
        case "static":
            server_types_1.serveFolder(state, '/assets/static', path.join(state.settings.__assetsDir, "static"));
            break;
        case "icons":
            server_types_1.serveFolder(state, '/assets/icons', path.join(state.settings.__assetsDir, "icons"));
            break;
        case "tiddlywiki":
            server_types_1.serveFolder(state, '/assets/tiddlywiki', state.settings.__targetTW);
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
const libsReady = Promise.all([bundled_lib_1.libsodium.ready]);
exports.libsReady = libsReady;
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
async function initServer({ settings, preflighter, settingshttps, dryRun }) {
    const debug = server_types_1.StateObject.DebugLogger("STARTER").bind({ debugOutput: MakeDebugOutput(settings), settings });
    // if (!settings) throw "The settings object must be emitted on eventer before starting the server";
    const hosts = [];
    const { bindWildcard, enableIPv6, filterBindAddress, bindAddress, _bindLocalhost, port, https: isHttps } = settings.bindInfo;
    const tester = server_types_1.parseHostList([...settings.bindInfo.bindAddress, "-127.0.0.0/8"]);
    const localhostTester = server_types_1.parseHostList(["127.0.0.0/8"]);
    await bundled_lib_1.libsodium.ready;
    bundled_lib_1.send.mime.define(settings.directoryIndex.mimetypes);
    //setup the logging handler
    let log;
    if (settings.logging.logAccess !== false) {
        const logger = morgan_1.handler({
            logFile: settings.logging.logAccess || undefined,
            logToConsole: !settings.logging.logAccess || settings.logging.logToConsoleAlso,
            logColorsToFile: settings.logging.logColorsToFile
        });
        log = (req, res) => new Promise(resolve => logger(req, res, resolve));
    }
    else {
        log = (req, res) => Promise.resolve();
    }
    if (bindWildcard) {
        //bind to everything and filter elsewhere if needed
        hosts.push('0.0.0.0');
        if (enableIPv6)
            hosts.push('::');
    }
    else if (filterBindAddress) {
        //bind to all interfaces that match the specified addresses
        let ifaces = os_1.networkInterfaces();
        let addresses = Object.keys(ifaces)
            .reduce((n, k) => n.concat(ifaces[k]), [])
            .filter(e => enableIPv6 || e.family === "IPv4" && tester(e.address).usable)
            .map(e => e.address);
        hosts.push(...addresses);
    }
    else {
        //bind to all specified addresses
        hosts.push(...bindAddress);
    }
    if (_bindLocalhost)
        hosts.push('localhost');
    if (hosts.length === 0) {
        console.log(EmptyHostsWarning(bindWildcard, filterBindAddress, _bindLocalhost, enableIPv6, bindAddress));
    }
    let servers = [];
    console.log("Creating servers as %s", typeof settingshttps === "function" ? "https" : "http");
    if (!settingshttps)
        console.log("Remember that any login credentials are being sent in the clear");
    let success = await setupHosts(hosts, settingshttps, preflighter, settings, log, bindWildcard, filterBindAddress, tester, localhostTester, servers, dryRun, port, debug);
    if (success === false)
        return exports.eventer;
    // .then(() => {
    exports.eventer.emit("serverOpen", servers, hosts, !!settingshttps, dryRun);
    let ifaces = os_1.networkInterfaces();
    console.log('Open your browser and type in one of the following:');
    console.log((bindWildcard
        ? server_types_1.keys(ifaces)
            .reduce((n, k) => n.concat(ifaces[k]), [])
            .filter(e => enableIPv6 && e.family === "IPv6"
            || e.family === "IPv4" && (!filterBindAddress || tester(e.address).usable))
            .map(e => e.address)
        : hosts).map(e => (isHttps ? "https" : "http") + "://" + e + ":" + port).join('\n'));
    if (dryRun)
        console.log("DRY RUN: No further processing is likely to happen");
    // }, (x) => {
    // console.log("Error thrown while starting server");
    // console.log(x);
    // });
    return exports.eventer;
}
exports.initServer = initServer;
function setupHosts(hosts, settingshttps, preflighter, settings, log, bindWildcard, filterBindAddress, tester, localhostTester, servers, dryRun, port, debug) {
    return Promise.all(hosts.map(host => {
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
        addRequestHandlers(server, host, preflighter, settings, log, debug);
        //this one we add here because it is related to the host property rather than just listening
        if (bindWildcard && filterBindAddress) {
            server.on('connection', (socket) => {
                if (!tester(socket.localAddress).usable && !localhostTester(socket.localAddress).usable)
                    socket.end();
            });
        }
        servers.push(server);
        return new Promise(resolve => {
            dryRun ? resolve() : server.listen(port, host, undefined, () => { resolve(); });
        });
    })).catch((x) => {
        console.log("Error thrown while starting server");
        console.log(x);
        return false;
    });
}
function EmptyHostsWarning(bindWildcard, filterBindAddress, _bindLocalhost, enableIPv6, bindAddress) {
    return `"No IP addresses will be listened on. This is probably a mistake.
bindWildcard is ${(bindWildcard ? "true" : "false")}
filterBindAddress is ${filterBindAddress ? "true" : "false"}
_bindLocalhost is ${_bindLocalhost ? "true" : "false"}
enableIPv6 is ${enableIPv6 ? "true" : "false"}
bindAddress is ${JSON.stringify(bindAddress, null, 2)}
`;
}
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
function addRequestHandlers(server, iface, preflighter, settings, log, debug) {
    // const addListeners = () => {
    let closing = false;
    server.on('request', (req, res) => {
        requestHandler(req, res, iface, preflighter, log, settings).catch((err) => {
            //catches any errors that happen inside the then statements
            debug(3, 'Uncaught error in the request handler: ' + (err.message || err.toString()));
            //if we have a stack, then print it
            if (err.stack)
                debug(3, err.stack);
        });
    });
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
    wss.on('connection', (client, request) => websocketHandler(client, request, iface, settings, preflighter));
    wss.on('error', (error) => { debug(-2, 'WS-ERROR %s', util_1.inspect(error)); });
}
exports.addRequestHandlers = addRequestHandlers;
async function websocketHandler(client, request, iface, settings, preflighter) {
    // return async () => {
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
        request,
        client,
        settings
    };
    let ev2 = await requestHandlerHostLevelChecks(ev, preflighter); //.then(ev2 => {
    if (!ev2.handled) { // we give the preflighter the option to handle the websocket on its own
        if (!settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey].websockets)
            client.close();
        else
            exports.eventer.emit('websocket-connection', ev);
    }
    // };
}
async function requestHandler(request, response, iface, preflighter, log, settings) {
    // return async (request: http.IncomingMessage, response: http.ServerResponse) => {
    let host = request.headers.host;
    let addr = request.socket.localAddress;
    // console.log(host, addr, request.socket.address().address);
    //send the request and response to morgan
    await log(request, response);
    // .then(() => {
    let ev1 = {
        handled: false,
        localAddressPermissionsKey: "",
        authAccountKey: "",
        username: "",
        treeHostIndex: 0,
        interface: { host, addr, iface },
        //@ts-ignore
        debugOutput: undefined,
        request,
        response,
        settings
    };
    //send it to the preflighter
    let ev2 = await requestHandlerHostLevelChecks(ev1, preflighter);
    // }).then(ev => {
    // check if the preflighter handled it
    if (ev2.handled)
        return;
    //create the state object
    const state = new server_types_1.StateObject(ev2.request, ev2.response, exports.eventer, ev2.localAddressPermissionsKey, ev2.authAccountKey, ev2.treeHostIndex, ev2.username, ev2.settings, ev2.debugOutput);
    //check for static routes
    const route = routes[state.path[1]];
    //if so, handle it
    if (route)
        route(state);
    //otherwise forward to TiddlyServer
    else
        tiddlyserver_1.handleTiddlyServerRoute(state);
}
/**
 * handles all checks that apply to the entire server (not just inside the tree), including
 * > auth accounts key
 * > local address permissions key (based on socket.localAddress)
 * > host array index
 */
async function requestHandlerHostLevelChecks(ev, preflighter) {
    //connections to the wrong IP address are already filtered out by the connection event listener on the server.
    //determine localAddressPermissions to be applied
    {
        let localAddress = ev.request.socket.localAddress;
        let keys = Object.keys(ev.settings.bindInfo.localAddressPermissions);
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
    let { registerNotice } = ev.settings.bindInfo.localAddressPermissions[ev.localAddressPermissionsKey];
    let auth = authRoute_1.checkCookieAuth(ev.request, registerNotice);
    if (auth) {
        ev.authAccountKey = auth[0];
        ev.username = auth[1];
    }
    //send the data to the preflighter
    let ev2 = await (preflighter ? preflighter(ev) : Promise.resolve(ev));
    if (ev2.handled)
        return ev2; //cancel early if it is handled
    //sanity checks after the preflighter
    // "always check all variables and sometimes check some constants too"
    //@ts-ignore
    if (!ev.response !== !ev2.response || !ev.client !== !ev2.client)
        throw new Error("DEV: Request Event types got mixed up");
    if (ev2.treeHostIndex > ev2.settings.tree.length - 1)
        throw util_1.format("treeHostIndex of %s is not within array length of %s", ev2.treeHostIndex, ev2.settings.tree.length);
    if (!ev2.settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey])
        throw util_1.format("localAddressPermissions key of %s does not exist", ev2.localAddressPermissionsKey);
    if (ev2.authAccountKey && !ev2.settings.authAccounts[ev2.authAccountKey])
        throw util_1.format("authAccounts key of %s does not exist", ev2.authAccountKey);
    if (!ev2.debugOutput)
        ev2.debugOutput = MakeDebugOutput(ev2.settings);
    return ev2;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsbUNBQXNDO0FBQ3RDLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFFN0IsK0JBQStCO0FBQy9CLDJCQUE2RDtBQUM3RCw2QkFBNkI7QUFDN0IsbUNBQWtDO0FBQ2xDLCtCQUF1QztBQUN2QyxvREFBc0U7QUFDdEUsMENBQWtEO0FBQ2xELDJDQUE4RTtBQUM5RSx5REFBdUQ7QUFrQjlDLDRCQWxCQSxvQ0FBaUIsQ0FrQkE7QUFqQjFCLGlEQWN3QjtBQUdJLHVCQWQxQiwyQkFBWSxDQWMwQjtBQUZ4QyxpREFBbUY7QUFHbkYsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsR0FBRyxnQkFBUyxDQUFDO0FBRTlDLGtCQUFrQjtBQUNsQixLQUFLLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQztBQUNqQyxPQUFPLENBQUMsS0FBSyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMscUJBQXFCO0FBRXRELG9DQUFvQztBQUN2QixRQUFBLE9BQU8sR0FBRyxJQUFJLHFCQUFZLEVBQXdCLENBQUM7QUFFaEUsOEJBQThCO0FBQzlCLElBQVUsR0FBRyxDQUVaO0FBRkQsV0FBVSxHQUFHO0lBQ0Esb0JBQWdCLEdBQVksS0FBSyxDQUFDO0FBQy9DLENBQUMsRUFGUyxHQUFHLEtBQUgsR0FBRyxRQUVaO0FBQUEsQ0FBQztBQUVGLG1CQUFlLENBQUMsZUFBTyxDQUFDLENBQUM7QUFDekIsbUJBQWdCLENBQUMsZUFBTyxDQUFDLENBQUM7QUFDMUIseUJBQWEsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUV2QixlQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFO0lBQzdCLElBQUksb0NBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSTtRQUNwQyxNQUFNLHFDQUFxQyxDQUFDO0FBQ2hELENBQUMsQ0FBQyxDQUFDO0FBRUgsTUFBTSxNQUFNLEdBQWlEO0lBQzNELE9BQU8sRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQztJQUN6QyxRQUFRLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUM7SUFDM0MsYUFBYSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUMsd0JBQVMsQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO0lBQ25GLGVBQWUsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLHdCQUFTLENBQUMsS0FBSyxFQUFFLGVBQWUsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztDQUN4RixDQUFDO0FBN0J3Qyx3QkFBTTtBQStCaEQsU0FBUyxpQkFBaUIsQ0FBQyxLQUFrQjtJQUMzQyxRQUFRLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDckIsS0FBSyxRQUFRO1lBQUUsMEJBQVcsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQUMsTUFBTTtRQUM1RyxLQUFLLE9BQU87WUFBRSwwQkFBVyxDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQUMsTUFBTTtRQUN6RyxLQUFLLFlBQVk7WUFBRSwwQkFBVyxDQUFDLEtBQUssRUFBRSxvQkFBb0IsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQUMsTUFBTTtRQUM5RixPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQzNCO0FBQ0gsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsS0FBa0I7SUFDMUMsUUFBUSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ3JCLGlEQUFpRDtRQUNqRCxLQUFLLGNBQWM7WUFBRSwyQkFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQUMsTUFBTTtRQUNuRCxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQzNCO0FBQ0gsQ0FBQztBQUVELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyx1QkFBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFoREMsOEJBQVM7QUFtRTNEOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBQ0ksS0FBSyxVQUFVLFVBQVUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFLOUU7SUFDQyxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxXQUFXLEVBQUUsZUFBZSxDQUFDLFFBQVEsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFFNUcsb0dBQW9HO0lBQ3BHLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztJQUMzQixNQUFNLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQztJQUM3SCxNQUFNLE1BQU0sR0FBRyw0QkFBYSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0lBQ2pGLE1BQU0sZUFBZSxHQUFHLDRCQUFhLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0lBRXZELE1BQU0sdUJBQVMsQ0FBQyxLQUFLLENBQUM7SUFFdEIsa0JBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFcEQsMkJBQTJCO0lBQzNCLElBQUksR0FBMkUsQ0FBQztJQUNoRixJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLEtBQUssRUFBRTtRQUN4QyxNQUFNLE1BQU0sR0FBRyxnQkFBTSxDQUFDO1lBQ3BCLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsSUFBSSxTQUFTO1lBQ2hELFlBQVksRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCO1lBQzlFLGVBQWUsRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLGVBQWU7U0FDbEQsQ0FBQyxDQUFDO1FBQ0gsR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0tBQ3ZFO1NBQU07UUFDTCxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDdkM7SUFFRCxJQUFJLFlBQVksRUFBRTtRQUNoQixtREFBbUQ7UUFDbkQsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN0QixJQUFJLFVBQVU7WUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ2xDO1NBQU0sSUFBSSxpQkFBaUIsRUFBRTtRQUM1QiwyREFBMkQ7UUFDM0QsSUFBSSxNQUFNLEdBQUcsc0JBQWlCLEVBQUUsQ0FBQztRQUNqQyxJQUFJLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQzthQUNoQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQTRCLENBQUM7YUFDbkUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssTUFBTSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDO2FBQzFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN2QixLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUM7S0FDMUI7U0FBTTtRQUNMLGlDQUFpQztRQUNqQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUM7S0FDNUI7SUFDRCxJQUFJLGNBQWM7UUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBRTVDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDdEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO0tBQzFHO0lBQ0QsSUFBSSxPQUFPLEdBQW1DLEVBQUUsQ0FBQztJQUNqRCxPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixFQUFFLE9BQU8sYUFBYSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5RixJQUFJLENBQUMsYUFBYTtRQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUVBQWlFLENBQUMsQ0FBQztJQUVuRyxJQUFJLE9BQU8sR0FBRyxNQUFNLFVBQVUsQ0FBQyxLQUFLLEVBQ2xDLGFBQWEsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxZQUFZLEVBQ3ZELGlCQUFpQixFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFDM0QsSUFBSSxFQUFFLEtBQUssQ0FDWixDQUFDO0lBRUYsSUFBSSxPQUFPLEtBQUssS0FBSztRQUFFLE9BQU8sZUFBTyxDQUFDO0lBQ3RDLGdCQUFnQjtJQUNoQixlQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDcEUsSUFBSSxNQUFNLEdBQUcsc0JBQWlCLEVBQUUsQ0FBQztJQUNqQyxPQUFPLENBQUMsR0FBRyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7SUFDbkUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUNWLFlBQVk7UUFDVixDQUFDLENBQUMsbUJBQUksQ0FBQyxNQUFNLENBQUM7YUFDWCxNQUFNLENBQUMsQ0FBQyxDQUF5QixFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7YUFDakUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssTUFBTTtlQUN6QyxDQUFDLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxDQUFDLENBQUMsaUJBQWlCLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUM1RSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQ3RCLENBQUMsQ0FBQyxLQUFLLENBQ1YsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUU5RSxJQUFJLE1BQU07UUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7SUFDOUUsY0FBYztJQUNkLHFEQUFxRDtJQUNyRCxrQkFBa0I7SUFDbEIsTUFBTTtJQUVOLE9BQU8sZUFBTyxDQUFDO0FBQ2pCLENBQUM7QUFwRkQsZ0NBb0ZDO0FBQ0QsU0FBUyxVQUFVLENBQ2pCLEtBQWUsRUFDZixhQUFrRSxFQUNsRSxXQUEwRCxFQUMxRCxRQUFzQixFQUN0QixHQUEyRSxFQUMzRSxZQUFxQixFQUNyQixpQkFBMEIsRUFDMUIsTUFBaUUsRUFDakUsZUFBMEUsRUFDMUUsT0FBdUMsRUFDdkMsTUFBZSxFQUNmLElBQVksRUFDWixLQUFVO0lBRVYsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDeEMsSUFBSSxNQUFXLENBQUM7UUFDaEIsSUFBSSxPQUFPLGFBQWEsS0FBSyxVQUFVLEVBQUU7WUFDdkMsSUFBSTtnQkFDRixNQUFNLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzthQUNsRDtZQUNELE9BQU8sQ0FBQyxFQUFFO2dCQUNSLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0NBQXdDLEdBQUcsSUFBSSxDQUFDLENBQUM7Z0JBQzdELE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2YsTUFBTSxDQUFDLENBQUM7YUFDVDtTQUNGO2FBQ0k7WUFDSCxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQzlCO1FBQ0Qsa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwRSw0RkFBNEY7UUFDNUYsSUFBSSxZQUFZLElBQUksaUJBQWlCLEVBQUU7WUFDckMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtnQkFDakMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNO29CQUNyRixNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDakIsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDckIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUMzQixNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEYsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1FBQ2QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO1FBQ2xELE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDZixPQUFPLEtBQUssQ0FBQztJQUNmLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsWUFBcUIsRUFBRSxpQkFBMEIsRUFBRSxjQUF1QixFQUFFLFVBQW1CLEVBQUUsV0FBcUI7SUFDL0ksT0FBTztrQkFDUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7dUJBQzVCLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU87b0JBQ3ZDLGNBQWMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO2dCQUNyQyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTztpQkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztDQUNwRCxDQUFDO0FBQ0YsQ0FBQztBQUNEOzs7Ozs7Ozs7R0FTRztBQUNILFNBQWdCLGtCQUFrQixDQUNoQyxNQUFrQyxFQUNsQyxLQUFhLEVBQ2IsV0FBbUMsRUFDbkMsUUFBc0IsRUFDdEIsR0FBMkUsRUFDM0UsS0FBa0I7SUFFbEIsK0JBQStCO0lBQy9CLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztJQUVwQixNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRTtRQUNoQyxjQUFjLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUN4RSwyREFBMkQ7WUFDM0QsS0FBSyxDQUFDLENBQUMsRUFBRSx5Q0FBeUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN0RixtQ0FBbUM7WUFDbkMsSUFBSSxHQUFHLENBQUMsS0FBSztnQkFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO1FBQzFCLEtBQUssQ0FBQyxDQUFDLEVBQUUscUJBQXFCLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekMsQ0FBQyxDQUFDLENBQUE7SUFFRixNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFO1FBQ3pCLEtBQUssQ0FBQyxDQUFDLEVBQUUscUJBQXFCLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwRCxLQUFLLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEQsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2YsZUFBTyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDckMsQ0FBQyxDQUFDLENBQUE7SUFFRixNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7UUFDdEIsSUFBSSxDQUFDLE9BQU87WUFBRSxlQUFPLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNqRCxLQUFLLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLE9BQU8sR0FBRyxJQUFJLENBQUM7SUFDakIsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLEdBQUcsR0FBRyxJQUFJLGVBQWUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDNUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUMzRyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWEsRUFBRSxjQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRTVFLENBQUM7QUF6Q0QsZ0RBeUNDO0FBRUQsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixNQUFpQixFQUNqQixPQUE2QixFQUM3QixLQUFhLEVBQ2IsUUFBc0IsRUFDdEIsV0FBbUM7SUFFbkMsdUJBQXVCO0lBQ3ZCLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQ2hDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO0lBQ3ZDLGtEQUFrRDtJQUNsRCxJQUFJLEVBQUUsR0FBbUI7UUFDdkIsT0FBTyxFQUFFLEtBQUs7UUFDZCwwQkFBMEIsRUFBRSxFQUFFO1FBQzlCLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFO1FBQ2hDLGNBQWMsRUFBRSxFQUFFO1FBQ2xCLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFDakIsUUFBUSxFQUFFLEVBQUU7UUFDWixZQUFZO1FBQ1osV0FBVyxFQUFFLFNBQVM7UUFDdEIsT0FBTztRQUNQLE1BQU07UUFDTixRQUFRO0tBQ1QsQ0FBQztJQUVGLElBQUksR0FBRyxHQUFHLE1BQU0sNkJBQTZCLENBQWlCLEVBQUUsRUFBRSxXQUFXLENBQUMsQ0FBQSxDQUFBLGdCQUFnQjtJQUM5RixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxFQUFFLHdFQUF3RTtRQUMxRixJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxVQUFVO1lBQ3ZGLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQzs7WUFFZixlQUFPLENBQUMsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQzVDO0lBQ0QsS0FBSztBQUNQLENBQUM7QUFDRCxLQUFLLFVBQVUsY0FBYyxDQUMzQixPQUF3QixFQUN4QixRQUF3QixFQUN4QixLQUFhLEVBQ2IsV0FBK0MsRUFDL0MsR0FBOEUsRUFDOUUsUUFBc0I7SUFHdEIsbUZBQW1GO0lBQ25GLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQ2hDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO0lBQ3ZDLDZEQUE2RDtJQUM3RCx5Q0FBeUM7SUFDekMsTUFBTSxHQUFHLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFBO0lBQzVCLGdCQUFnQjtJQUNoQixJQUFJLEdBQUcsR0FBcUI7UUFDMUIsT0FBTyxFQUFFLEtBQUs7UUFDZCwwQkFBMEIsRUFBRSxFQUFFO1FBQzlCLGNBQWMsRUFBRSxFQUFFO1FBQ2xCLFFBQVEsRUFBRSxFQUFFO1FBQ1osYUFBYSxFQUFFLENBQUM7UUFDaEIsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUU7UUFDaEMsWUFBWTtRQUNaLFdBQVcsRUFBRSxTQUFTO1FBQ3RCLE9BQU87UUFDUCxRQUFRO1FBQ1IsUUFBUTtLQUNULENBQUM7SUFDRiw0QkFBNEI7SUFDNUIsSUFBSSxHQUFHLEdBQUcsTUFBTSw2QkFBNkIsQ0FBbUIsR0FBRyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ2xGLGtCQUFrQjtJQUNsQixzQ0FBc0M7SUFDdEMsSUFBSSxHQUFHLENBQUMsT0FBTztRQUFFLE9BQU87SUFDeEIseUJBQXlCO0lBQ3pCLE1BQU0sS0FBSyxHQUFHLElBQUksMEJBQVcsQ0FDM0IsR0FBRyxDQUFDLE9BQU8sRUFDWCxHQUFHLENBQUMsUUFBUSxFQUNaLGVBQU8sRUFDUCxHQUFHLENBQUMsMEJBQTBCLEVBQzlCLEdBQUcsQ0FBQyxjQUFjLEVBQ2xCLEdBQUcsQ0FBQyxhQUFhLEVBQ2pCLEdBQUcsQ0FBQyxRQUFRLEVBQ1osR0FBRyxDQUFDLFFBQVEsRUFDWixHQUFHLENBQUMsV0FBVyxDQUNoQixDQUFDO0lBQ0YseUJBQXlCO0lBQ3pCLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEMsa0JBQWtCO0lBQ2xCLElBQUksS0FBSztRQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN4QixtQ0FBbUM7O1FBQzlCLHNDQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRXRDLENBQUM7QUFDRDs7Ozs7R0FLRztBQUNILEtBQUssVUFBVSw2QkFBNkIsQ0FDMUMsRUFBcUMsRUFDckMsV0FBb0M7SUFFcEMsOEdBQThHO0lBQzlHLGlEQUFpRDtJQUNqRDtRQUNFLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUNsRCxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDckUsSUFBSSxXQUFXLEdBQUcsMEJBQVcsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVELElBQUksT0FBTyxHQUFHLDRCQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEQsSUFBSSxXQUFXLEVBQUU7WUFDZixFQUFFLENBQUMsMEJBQTBCLEdBQUcsV0FBVyxDQUFDO1NBQzdDO2FBQU0sSUFBSSxPQUFPLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxFQUFFO1lBQ2pDLEVBQUUsQ0FBQywwQkFBMEIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ3pEO2FBQU07WUFDTCxFQUFFLENBQUMsMEJBQTBCLEdBQUcsR0FBRyxDQUFDO1NBQ3JDO0tBQ0Y7SUFDRCx3RkFBd0Y7SUFDeEYsRUFBRSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDckIsa0NBQWtDO0lBQ2xDLElBQUksRUFBRSxjQUFjLEVBQUUsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLENBQUMsMEJBQTBCLENBQUMsQ0FBQztJQUNyRyxJQUFJLElBQUksR0FBRywyQkFBZSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDdkQsSUFBSSxJQUFJLEVBQUU7UUFBRSxFQUFFLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUFDLEVBQUUsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQUU7SUFFakUsa0NBQWtDO0lBQ2xDLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRXRFLElBQUksR0FBRyxDQUFDLE9BQU87UUFBRSxPQUFPLEdBQVUsQ0FBQyxDQUFDLCtCQUErQjtJQUNuRSxxQ0FBcUM7SUFDckMsc0VBQXNFO0lBQ3RFLFlBQVk7SUFDWixJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU07UUFDOUQsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0lBQzNELElBQUksR0FBRyxDQUFDLGFBQWEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQztRQUNsRCxNQUFNLGFBQU0sQ0FBQyxzREFBc0QsRUFBRSxHQUFHLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO0lBQ25ILElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUM7UUFDaEYsTUFBTSxhQUFNLENBQUMsa0RBQWtELEVBQUUsR0FBRyxDQUFDLDBCQUEwQixDQUFDLENBQUM7SUFDbkcsSUFBSSxHQUFHLENBQUMsY0FBYyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQztRQUN0RSxNQUFNLGFBQU0sQ0FBQyx1Q0FBdUMsRUFBRSxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7SUFFNUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXO1FBQUUsR0FBRyxDQUFDLFdBQVcsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RFLE9BQU8sR0FBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxRQUFRO0lBQy9CLE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFBO0lBRXJDLE9BQU8sSUFBSSxpQkFBUSxDQUFDO1FBQ2xCLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxRQUFRLEVBQUUsUUFBUTtZQUN4QyxrREFBa0Q7WUFDbEQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztnQkFBRSxLQUFLLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzRCwyQ0FBMkM7WUFDM0MsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFNUYsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRTtnQkFDN0IsRUFBRSxDQUFDLGNBQWMsQ0FDZixRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFDekIsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLE1BQU0sRUFDcEYsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLENBQ3JCLENBQUM7YUFDSDtZQUNELElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFO2dCQUNuRSxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ3BCO1lBQ0QsUUFBUSxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztLQUNGLENBQUMsQ0FBQztJQUFBLENBQUM7QUFDTixDQUFDO0FBR0QseUNBQXlDO0FBQ3pDLGVBQU8sQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDakMsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDO1FBQzlCLDBCQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbEYsUUFBUSxDQUFDO0FBQ1gsQ0FBQyxDQUFDLENBQUE7QUFDRixlQUFPLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ2pDLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQztRQUM5QiwwQkFBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDckYsQ0FBQyxDQUFDLENBQUE7QUFFRixTQUFTLGVBQWUsQ0FBQyxLQUFrQixFQUFFLFFBQWdEO0lBQzNGLG9EQUFvRDtJQUNwRCxvQ0FBb0M7SUFDcEMsb0NBQW9DO0lBQ3BDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUMxRCxNQUFNLEtBQUssR0FBRyxDQUFDLE1BQTBCLEVBQUUsRUFBRSxDQUMzQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM3QyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFDdkMsMEJBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1FBQzdFLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLGtCQUFrQixFQUFFLDRCQUE0QixFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25ILE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFDRCwwQkFBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLHlCQUF5QixDQUFDLENBQUM7SUFDOUUsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFHLGlCQUFpQjtJQUM5RSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQXNCLDZCQUE2QjtJQUMxRixJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFnQixzQkFBc0I7SUFDbkYsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQXNDLGlCQUFpQjtJQUM5RSxRQUFRLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUNuQixRQUFRLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RCLElBQUksUUFBUSxLQUFLLFFBQVEsQ0FBQyxRQUFRLElBQUksUUFBUSxLQUFLLFFBQVEsQ0FBQyxRQUFRLEVBQUU7UUFDcEUsMEJBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSx1Q0FBdUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDaEgsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsOEJBQThCLENBQUMsQ0FBQztRQUN2RCxPQUFPLEtBQUssQ0FBQztLQUNkO0lBQ0QsMEJBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSwwQkFBMEIsQ0FBQyxDQUFBO0lBQzlFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyJ9