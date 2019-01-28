"use strict";
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
const settingsPage_1 = require("./settingsPage");
const os_1 = require("os");
server_types_1.init(exports.eventer);
tiddlyserver_1.init(exports.eventer);
settingsPage_1.initSettings(exports.eventer);
exports.eventer.on("settings", (set) => { settings = set; });
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
exports.eventer.on('settings', () => { log = setLog(); });
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
    // settings = options.settings;
    if (!settings)
        throw "The settings object must be emitted on eventer before starting the server";
    // const { preflighter, env, listenCB, settingshttps } = options;
    // eventer.emit('settings', settings);
    const hosts = [];
    const bindWildcard = settings.server.bindWildcard;
    const tester = server_types_1.parseHostList([...settings.server.bindAddress, "-127.0.0.0/8"]);
    const localhostTester = server_types_1.parseHostList(["127.0.0.0/8"]);
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
            server = https.createServer(settingshttps(host));
        }
        else if (settingshttps) {
            const httpsOptions = {};
            let { requestClientCertificate, rejectUnauthorizedCertificate, key, cert, pfx } = settingshttps;
            if (requestClientCertificate) {
                if (typeof requestClientCertificate === "object")
                    httpsOptions.ca = requestClientCertificate;
                httpsOptions.requestCert = !!requestClientCertificate;
                httpsOptions.rejectUnauthorized = !!rejectUnauthorizedCertificate;
            }
            if ((!key || !cert) && !pfx)
                throw "key+cert or pfx are required in `settings.server.https` for https to work correctly";
            //just use both if provided and let node sort it out
            if (key && cert) {
                httpsOptions.key = key && key.map(({ buff, passphrase }) => passphrase ? { pem: buff, passphrase } : buff);
                httpsOptions.cert = cert && cert.map(({ buff }) => buff);
            }
            if (pfx) {
                httpsOptions.pfx = pfx && pfx.map(({ buff, passphrase }) => passphrase ? { buf: buff, passphrase } : buff);
            }
            httpsOptions.passphrase = settingshttps.passphrase;
            server = https.createServer(httpsOptions);
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
    }).subscribe(item => { }, x => { }, () => {
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
    //determine authAccount to be applied
    let basicAuth = ((request) => {
        const first = (header) => Array.isArray(header) ? header[0] : header;
        var header = first(request.headers['authorization']) || '', // get the header
        token = header.split(/\s+/).pop() || '', // and the encoded auth token
        auth = new Buffer(token, 'base64').toString(), // convert from base64
        parts = auth.split(/:/), // split on colon
        username = parts[0], password = parts[1];
        if (username && password)
            debug(-3, "Basic Auth recieved");
        return { username, password };
    })(ev.request);
    let cookies = ((request) => {
        if (!request.headers.cookie)
            return;
        var list = {}, rc = request.headers.cookie;
        rc.split(';').forEach(function (cookie) {
            var parts = cookie.split('=');
            list[parts.shift().trim()] = parts.length ? decodeURI(parts.join('=')) : "";
        });
        return list;
    })(ev.request);
    let clientCert = ((request) => {
        request;
    })(ev.request);
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
        case "settings":
            settingsPage_1.handleSettings(state);
            break;
        default: state.throw(404);
    }
}
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsb0RBQW1EO0FBQ25ELE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUd2QixrQ0FFbUI7QUFFbkIsaURBZXdCO0FBaUNmLHVCQWxDUiwyQkFBWSxDQWtDUTtBQS9CckIsNkJBQTRCO0FBQzVCLCtCQUE4QjtBQUU5Qiw2QkFBNkI7QUFFN0IsK0JBQXVDO0FBQ3ZDLG1DQUFzQztBQUd0QyxpREFBaUQ7QUFFakQsNENBQTRDO0FBRTVDLE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsZ0JBQUUsQ0FBQztBQUV2QyxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUU5RCxLQUFLLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQztBQUVqQyxPQUFPLENBQUMsS0FBSyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMscUJBQXFCO0FBRXRELHNCQUFzQjtBQUNULFFBQUEsT0FBTyxHQUFHLElBQUkscUJBQVksRUFBd0IsQ0FBQztBQUNoRSxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRWpDLElBQVUsR0FBRyxDQUVaO0FBRkQsV0FBVSxHQUFHO0lBQ0Qsb0JBQWdCLEdBQVksS0FBSyxDQUFDO0FBQzlDLENBQUMsRUFGUyxHQUFHLEtBQUgsR0FBRyxRQUVaO0FBQUEsQ0FBQztBQUVGLElBQUksUUFBc0IsQ0FBQztBQU0zQiw0QkFBNEI7QUFDNUIsaURBQTBHO0FBQzFHLGlEQUE4RDtBQUc5RCwyQkFBNkQ7QUFFN0QsbUJBQWUsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUN6QixtQkFBZ0IsQ0FBQyxlQUFPLENBQUMsQ0FBQztBQUMxQiwyQkFBWSxDQUFDLGVBQU8sQ0FBQyxDQUFDO0FBQ3RCLGVBQU8sQ0FB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