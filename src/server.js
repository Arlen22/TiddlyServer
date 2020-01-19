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
    if (interfacechecker_1.checkServerConfig(set, false) !== true)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsbUNBQXNDO0FBQ3RDLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFFN0IsK0JBQStCO0FBQy9CLDJCQUE2RDtBQUM3RCw2QkFBNkI7QUFDN0IsbUNBQWtDO0FBQ2xDLCtCQUF1QztBQUN2QyxvREFBc0U7QUFDdEUsMENBQWtEO0FBQ2xELDJDQUE4RTtBQUM5RSx5REFBdUQ7QUFrQjlDLDRCQWxCQSxvQ0FBaUIsQ0FrQkE7QUFqQjFCLGlEQWN3QjtBQUdJLHVCQWQxQiwyQkFBWSxDQWMwQjtBQUZ4QyxpREFBbUY7QUFHbkYsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsR0FBRyxnQkFBUyxDQUFDO0FBRTlDLGtCQUFrQjtBQUNsQixLQUFLLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQztBQUNqQyxPQUFPLENBQUMsS0FBSyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMscUJBQXFCO0FBRXRELG9DQUFvQztBQUN2QixRQUFBLE9BQU8sR0FBRyxJQUFJLHFCQUFZLEVBQXdCLENBQUM7QUFFaEUsOEJBQThCO0FBQzlCLElBQVUsR0FBRyxDQUVaO0FBRkQsV0FBVSxHQUFHO0lBQ0Esb0JBQWdCLEdBQVksS0FBSyxDQUFDO0FBQy9DLENBQUMsRUFGUyxHQUFHLEtBQUgsR0FBRyxRQUVaO0FBQUEsQ0FBQztBQUVGLG1CQUFlLENBQUMsZUFBTyxDQUFDLENBQUM7QUFDekIsbUJBQWdCLENBQUMsZUFBTyxDQUFDLENBQUM7QUFDMUIseUJBQWEsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUV2QixlQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFO0lBQzdCLElBQUksb0NBQWlCLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxLQUFLLElBQUk7UUFDeEMsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRCxDQUFDLENBQUMsQ0FBQztBQUVILE1BQU0sTUFBTSxHQUFpRDtJQUMzRCxPQUFPLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7SUFDekMsUUFBUSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDO0lBQzNDLGFBQWEsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLHdCQUFTLENBQUMsS0FBSyxFQUFFLGFBQWEsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztJQUNuRixlQUFlLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyx3QkFBUyxDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7Q0FDeEYsQ0FBQztBQTdCd0Msd0JBQU07QUErQmhELFNBQVMsaUJBQWlCLENBQUMsS0FBa0I7SUFDM0MsUUFBUSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ3JCLEtBQUssUUFBUTtZQUFFLDBCQUFXLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUFDLE1BQU07UUFDNUcsS0FBSyxPQUFPO1lBQUUsMEJBQVcsQ0FBQyxLQUFLLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUFDLE1BQU07UUFDekcsS0FBSyxZQUFZO1lBQUUsMEJBQVcsQ0FBQyxLQUFLLEVBQUUsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUFDLE1BQU07UUFDOUYsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUMzQjtBQUNILENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLEtBQWtCO0lBQzFDLFFBQVEsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUNyQixpREFBaUQ7UUFDakQsS0FBSyxjQUFjO1lBQUUsMkJBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUFDLE1BQU07UUFDbkQsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUMzQjtBQUNILENBQUM7QUFFRCxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsdUJBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBaERDLDhCQUFTO0FBbUUzRDs7Ozs7Ozs7Ozs7Ozs7R0FjRztBQUNJLEtBQUssVUFBVSxVQUFVLENBQUMsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBSzlFO0lBQ0MsTUFBTSxLQUFLLEdBQUcsMEJBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBRTVHLG9HQUFvRztJQUNwRyxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7SUFDM0IsTUFBTSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUM7SUFDN0gsTUFBTSxNQUFNLEdBQUcsNEJBQWEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUNqRixNQUFNLGVBQWUsR0FBRyw0QkFBYSxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUV2RCxNQUFNLHVCQUFTLENBQUMsS0FBSyxDQUFDO0lBRXRCLGtCQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBRXBELDJCQUEyQjtJQUMzQixJQUFJLEdBQTJFLENBQUM7SUFDaEYsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxLQUFLLEVBQUU7UUFDeEMsTUFBTSxNQUFNLEdBQUcsZ0JBQU0sQ0FBQztZQUNwQixPQUFPLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLElBQUksU0FBUztZQUNoRCxZQUFZLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLGdCQUFnQjtZQUM5RSxlQUFlLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxlQUFlO1NBQ2xELENBQUMsQ0FBQztRQUNILEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztLQUN2RTtTQUFNO1FBQ0wsR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3ZDO0lBRUQsSUFBSSxZQUFZLEVBQUU7UUFDaEIsbURBQW1EO1FBQ25ELEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdEIsSUFBSSxVQUFVO1lBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNsQztTQUFNLElBQUksaUJBQWlCLEVBQUU7UUFDNUIsMkRBQTJEO1FBQzNELElBQUksTUFBTSxHQUFHLHNCQUFpQixFQUFFLENBQUM7UUFDakMsSUFBSSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7YUFDaEMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUE0QixDQUFDO2FBQ25FLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQzthQUMxRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkIsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0tBQzFCO1NBQU07UUFDTCxpQ0FBaUM7UUFDakMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDO0tBQzVCO0lBQ0QsSUFBSSxjQUFjO1FBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUU1QyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3RCLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsWUFBWSxFQUFFLGlCQUFpQixFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztLQUMxRztJQUNELElBQUksT0FBTyxHQUFtQyxFQUFFLENBQUM7SUFDakQsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsRUFBRSxPQUFPLGFBQWEsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDOUYsSUFBSSxDQUFDLGFBQWE7UUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7SUFFbkcsSUFBSSxPQUFPLEdBQUcsTUFBTSxVQUFVLENBQUMsS0FBSyxFQUNsQyxhQUFhLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsWUFBWSxFQUN2RCxpQkFBaUIsRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQzNELElBQUksRUFBRSxLQUFLLENBQ1osQ0FBQztJQUVGLElBQUksT0FBTyxLQUFLLEtBQUs7UUFBRSxPQUFPLGVBQU8sQ0FBQztJQUN0QyxnQkFBZ0I7SUFDaEIsZUFBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3BFLElBQUksTUFBTSxHQUFHLHNCQUFpQixFQUFFLENBQUM7SUFDakMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO0lBQ25FLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FDVixZQUFZO1FBQ1YsQ0FBQyxDQUFDLG1CQUFJLENBQUMsTUFBTSxDQUFDO2FBQ1gsTUFBTSxDQUFDLENBQUMsQ0FBeUIsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO2FBQ2pFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLE1BQU07ZUFDekMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxNQUFNLElBQUksQ0FBQyxDQUFDLGlCQUFpQixJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDNUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUN0QixDQUFDLENBQUMsS0FBSyxDQUNWLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFOUUsSUFBSSxNQUFNO1FBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO0lBQzlFLGNBQWM7SUFDZCxxREFBcUQ7SUFDckQsa0JBQWtCO0lBQ2xCLE1BQU07SUFFTixPQUFPLGVBQU8sQ0FBQztBQUNqQixDQUFDO0FBcEZELGdDQW9GQztBQUNELFNBQVMsVUFBVSxDQUNqQixLQUFlLEVBQ2YsYUFBa0UsRUFDbEUsV0FBMEQsRUFDMUQsUUFBc0IsRUFDdEIsR0FBMkUsRUFDM0UsWUFBcUIsRUFDckIsaUJBQTBCLEVBQzFCLE1BQWlFLEVBQ2pFLGVBQTBFLEVBQzFFLE9BQXVDLEVBQ3ZDLE1BQWUsRUFDZixJQUFZLEVBQ1osS0FBVTtJQUVWLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3hDLElBQUksTUFBVyxDQUFDO1FBQ2hCLElBQUksT0FBTyxhQUFhLEtBQUssVUFBVSxFQUFFO1lBQ3ZDLElBQUk7Z0JBQ0YsTUFBTSxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDbEQ7WUFDRCxPQUFPLENBQUMsRUFBRTtnQkFDUixPQUFPLENBQUMsR0FBRyxDQUFDLHdDQUF3QyxHQUFHLElBQUksQ0FBQyxDQUFDO2dCQUM3RCxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNmLE1BQU0sQ0FBQyxDQUFDO2FBQ1Q7U0FDRjthQUNJO1lBQ0gsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztTQUM5QjtRQUNELGtCQUFrQixDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDcEUsNEZBQTRGO1FBQzVGLElBQUksWUFBWSxJQUFJLGlCQUFpQixFQUFFO1lBQ3JDLE1BQU0sQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUU7Z0JBQ2pDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTTtvQkFDckYsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ2pCLENBQUMsQ0FBQyxDQUFDO1NBQ0o7UUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JCLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDM0IsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsR0FBRyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xGLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtRQUNkLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUNsRCxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2YsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLFlBQXFCLEVBQUUsaUJBQTBCLEVBQUUsY0FBdUIsRUFBRSxVQUFtQixFQUFFLFdBQXFCO0lBQy9JLE9BQU87a0JBQ1MsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO3VCQUM1QixpQkFBaUIsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO29CQUN2QyxjQUFjLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTztnQkFDckMsVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU87aUJBQzVCLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7Q0FDcEQsQ0FBQztBQUNGLENBQUM7QUFDRDs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFnQixrQkFBa0IsQ0FDaEMsTUFBa0MsRUFDbEMsS0FBYSxFQUNiLFdBQW1DLEVBQ25DLFFBQXNCLEVBQ3RCLEdBQTJFLEVBQzNFLEtBQWtCO0lBRWxCLCtCQUErQjtJQUMvQixJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFcEIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUU7UUFDaEMsY0FBYyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDeEUsMkRBQTJEO1lBQzNELEtBQUssQ0FBQyxDQUFDLEVBQUUseUNBQXlDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEYsbUNBQW1DO1lBQ25DLElBQUksR0FBRyxDQUFDLEtBQUs7Z0JBQUUsS0FBSyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtRQUMxQixLQUFLLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3pDLENBQUMsQ0FBQyxDQUFBO0lBRUYsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUN6QixLQUFLLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEQsS0FBSyxDQUFDLENBQUMsRUFBRSxxQkFBcUIsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xELE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNmLGVBQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3JDLENBQUMsQ0FBQyxDQUFBO0lBRUYsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO1FBQ3RCLElBQUksQ0FBQyxPQUFPO1lBQUUsZUFBTyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDakQsS0FBSyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSxlQUFlLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzVDLEdBQUcsQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDM0csR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLEVBQUUsY0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUU1RSxDQUFDO0FBekNELGdEQXlDQztBQUVELEtBQUssVUFBVSxnQkFBZ0IsQ0FDN0IsTUFBaUIsRUFDakIsT0FBNkIsRUFDN0IsS0FBYSxFQUNiLFFBQXNCLEVBQ3RCLFdBQW1DO0lBRW5DLHVCQUF1QjtJQUN2QixJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUNoQyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztJQUN2QyxrREFBa0Q7SUFDbEQsSUFBSSxFQUFFLEdBQW1CO1FBQ3ZCLE9BQU8sRUFBRSxLQUFLO1FBQ2QsMEJBQTBCLEVBQUUsRUFBRTtRQUM5QixTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRTtRQUNoQyxjQUFjLEVBQUUsRUFBRTtRQUNsQixhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLFFBQVEsRUFBRSxFQUFFO1FBQ1osWUFBWTtRQUNaLFdBQVcsRUFBRSxTQUFTO1FBQ3RCLE9BQU87UUFDUCxNQUFNO1FBQ04sUUFBUTtLQUNULENBQUM7SUFFRixJQUFJLEdBQUcsR0FBRyxNQUFNLDZCQUE2QixDQUFpQixFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUEsQ0FBQSxnQkFBZ0I7SUFDOUYsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSx3RUFBd0U7UUFDMUYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLDBCQUEwQixDQUFDLENBQUMsVUFBVTtZQUN2RixNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7O1lBRWYsZUFBTyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxFQUFFLENBQUMsQ0FBQztLQUM1QztJQUNELEtBQUs7QUFDUCxDQUFDO0FBQ0QsS0FBSyxVQUFVLGNBQWMsQ0FDM0IsT0FBd0IsRUFDeEIsUUFBd0IsRUFDeEIsS0FBYSxFQUNiLFdBQStDLEVBQy9DLEdBQThFLEVBQzlFLFFBQXNCO0lBR3RCLG1GQUFtRjtJQUNuRixJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUNoQyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztJQUN2Qyw2REFBNkQ7SUFDN0QseUNBQXlDO0lBQ3pDLE1BQU0sR0FBRyxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQTtJQUM1QixnQkFBZ0I7SUFDaEIsSUFBSSxHQUFHLEdBQXFCO1FBQzFCLE9BQU8sRUFBRSxLQUFLO1FBQ2QsMEJBQTBCLEVBQUUsRUFBRTtRQUM5QixjQUFjLEVBQUUsRUFBRTtRQUNsQixRQUFRLEVBQUUsRUFBRTtRQUNaLGFBQWEsRUFBRSxDQUFDO1FBQ2hCLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFO1FBQ2hDLFlBQVk7UUFDWixXQUFXLEVBQUUsU0FBUztRQUN0QixPQUFPO1FBQ1AsUUFBUTtRQUNSLFFBQVE7S0FDVCxDQUFDO0lBQ0YsNEJBQTRCO0lBQzVCLElBQUksR0FBRyxHQUFHLE1BQU0sNkJBQTZCLENBQW1CLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUNsRixrQkFBa0I7SUFDbEIsc0NBQXNDO0lBQ3RDLElBQUksR0FBRyxDQUFDLE9BQU87UUFBRSxPQUFPO0lBQ3hCLHlCQUF5QjtJQUN6QixNQUFNLEtBQUssR0FBRyxJQUFJLDBCQUFXLENBQzNCLEdBQUcsQ0FBQyxPQUFPLEVBQ1gsR0FBRyxDQUFDLFFBQVEsRUFDWixlQUFPLEVBQ1AsR0FBRyxDQUFDLDBCQUEwQixFQUM5QixHQUFHLENBQUMsY0FBYyxFQUNsQixHQUFHLENBQUMsYUFBYSxFQUNqQixHQUFHLENBQUMsUUFBUSxFQUNaLEdBQUcsQ0FBQyxRQUFRLEVBQ1osR0FBRyxDQUFDLFdBQVcsQ0FDaEIsQ0FBQztJQUNGLHlCQUF5QjtJQUN6QixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BDLGtCQUFrQjtJQUNsQixJQUFJLEtBQUs7UUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDeEIsbUNBQW1DOztRQUM5QixzQ0FBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUV0QyxDQUFDO0FBQ0Q7Ozs7O0dBS0c7QUFDSCxLQUFLLFVBQVUsNkJBQTZCLENBQzFDLEVBQXFDLEVBQ3JDLFdBQW9DO0lBRXBDLDhHQUE4RztJQUM5RyxpREFBaUQ7SUFDakQ7UUFDRSxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7UUFDbEQsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ3JFLElBQUksV0FBVyxHQUFHLDBCQUFXLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RCxJQUFJLE9BQU8sR0FBRyw0QkFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2hELElBQUksV0FBVyxFQUFFO1lBQ2YsRUFBRSxDQUFDLDBCQUEwQixHQUFHLFdBQVcsQ0FBQztTQUM3QzthQUFNLElBQUksT0FBTyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFBRTtZQUNqQyxFQUFFLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUN6RDthQUFNO1lBQ0wsRUFBRSxDQUFDLDBCQUEwQixHQUFHLEdBQUcsQ0FBQztTQUNyQztLQUNGO0lBQ0Qsd0ZBQXdGO0lBQ3hGLEVBQUUsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLGtDQUFrQztJQUNsQyxJQUFJLEVBQUUsY0FBYyxFQUFFLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLDBCQUEwQixDQUFDLENBQUM7SUFDckcsSUFBSSxJQUFJLEdBQUcsMkJBQWUsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ3ZELElBQUksSUFBSSxFQUFFO1FBQUUsRUFBRSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFBQyxFQUFFLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUFFO0lBRWpFLGtDQUFrQztJQUNsQyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUV0RSxJQUFJLEdBQUcsQ0FBQyxPQUFPO1FBQUUsT0FBTyxHQUFVLENBQUMsQ0FBQywrQkFBK0I7SUFDbkUscUNBQXFDO0lBQ3JDLHNFQUFzRTtJQUN0RSxZQUFZO0lBQ1osSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNO1FBQzlELE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQztJQUMzRCxJQUFJLEdBQUcsQ0FBQyxhQUFhLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUM7UUFDbEQsTUFBTSxhQUFNLENBQUMsc0RBQXNELEVBQUUsR0FBRyxDQUFDLGFBQWEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtJQUNuSCxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLDBCQUEwQixDQUFDO1FBQ2hGLE1BQU0sYUFBTSxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQ25HLElBQUksR0FBRyxDQUFDLGNBQWMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUM7UUFDdEUsTUFBTSxhQUFNLENBQUMsdUNBQXVDLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBRTVFLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVztRQUFFLEdBQUcsQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0RSxPQUFPLEdBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsUUFBUTtJQUMvQixNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQTtJQUVyQyxPQUFPLElBQUksaUJBQVEsQ0FBQztRQUNsQixLQUFLLEVBQUUsVUFBVSxLQUFLLEVBQUUsUUFBUSxFQUFFLFFBQVE7WUFDeEMsa0RBQWtEO1lBQ2xELElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7Z0JBQUUsS0FBSyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0QsMkNBQTJDO1lBQzNDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTVGLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUU7Z0JBQzdCLEVBQUUsQ0FBQyxjQUFjLENBQ2YsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQ3pCLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQ3BGLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUNyQixDQUFDO2FBQ0g7WUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDbkUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUNwQjtZQUNELFFBQVEsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUN2QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7S0FDRixDQUFDLENBQUM7SUFBQSxDQUFDO0FBQ04sQ0FBQztBQUdELHlDQUF5QztBQUN6QyxlQUFPLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ2pDLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQztRQUM5QiwwQkFBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLFFBQVEsQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFBO0FBQ0YsZUFBTyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNqQyxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUM7UUFDOUIsMEJBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3JGLENBQUMsQ0FBQyxDQUFBO0FBRUYsU0FBUyxlQUFlLENBQUMsS0FBa0IsRUFBRSxRQUFnRDtJQUMzRixvREFBb0Q7SUFDcEQsb0NBQW9DO0lBQ3BDLG9DQUFvQztJQUNwQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDMUQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUEwQixFQUFFLEVBQUUsQ0FDM0MsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDN0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBQ3ZDLDBCQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztRQUM3RSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSw0QkFBNEIsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuSCxPQUFPLEtBQUssQ0FBQztLQUNkO0lBQ0QsMEJBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSx5QkFBeUIsQ0FBQyxDQUFDO0lBQzlFLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRyxpQkFBaUI7SUFDOUUsS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFzQiw2QkFBNkI7SUFDMUYsSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBZ0Isc0JBQXNCO0lBQ25GLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFzQyxpQkFBaUI7SUFDOUUsUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFDbkIsUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0QixJQUFJLFFBQVEsS0FBSyxRQUFRLENBQUMsUUFBUSxJQUFJLFFBQVEsS0FBSyxRQUFRLENBQUMsUUFBUSxFQUFFO1FBQ3BFLDBCQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsdUNBQXVDLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2hILEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLDhCQUE4QixDQUFDLENBQUM7UUFDdkQsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUNELDBCQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsMEJBQTBCLENBQUMsQ0FBQTtJQUM5RSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMifQ==