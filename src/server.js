"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("../lib/source-map-support-lib");
const sendOptions = {};
const rx_1 = require("../lib/rx");
const server_types_1 = require("./server-types");
const http = require("http");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const events_1 = require("events");
// import send = require('../lib/send-lib');
const WS_1 = require("../lib/websocket-server/WS");
__dirname = path.dirname(module.filename || process.execPath);
Error.stackTraceLimit = Infinity;
process.on('uncaughtException', err => {
    console.error(util_1.inspect(err));
    console.error("caught process uncaughtException");
    fs.appendFile(path.join(__dirname, 'uncaughtException.log'), new Date().toISOString() + "\r\n" + util_1.inspect(err) + "\r\n\r\n", (err) => {
        if (err)
            console.log('Could not write to uncaughtException.log');
    });
    if (process.argv[2] !== "--close-on-error" && process.argv[3] !== "--close-on-error")
        setInterval(function () { }, 1000); //hold it open because all other listeners should close
});
console.debug = function () { }; //noop console debug;
//setup global objects
const eventer = new events_1.EventEmitter();
const debug = server_types_1.DebugLogger('APP');
const logger = require('../lib/morgan.js').handler;
const settingsFile = path.normalize(process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../settings.json'));
console.log("Settings file: %s", settingsFile);
var settings;
{
    const settingsString = fs.readFileSync(settingsFile, 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
    let settingsError = {};
    settings = server_types_1.tryParseJSON(settingsString, settingsError);
    if (!settings && settingsError.error) {
        let e = settingsError.error;
        console.error(/*colors.BgWhite + */ server_types_1.colors.FgRed + "The settings file could not be parsed: %s" + server_types_1.colors.Reset, e.originalError.message);
        console.error(e.errorPosition);
        throw "The settings file could not be parsed: Invalid JSON";
    }
}
if (!settings.tree)
    throw "tree is not specified in the settings file";
const settingsDir = path.dirname(settingsFile);
if (typeof settings.tree === "object")
    (function normalizeTree(item) {
        server_types_1.keys(item).forEach(e => {
            if (typeof item[e] === 'string')
                item[e] = path.resolve(settingsDir, item[e]);
            else if (typeof item[e] === 'object')
                normalizeTree(item[e]);
            else
                throw 'Invalid item: ' + e + ': ' + item[e];
        });
    })(settings.tree);
else
    settings.tree = path.resolve(settingsDir, settings.tree);
if (settings.backupDirectory) {
    settings.backupDirectory = path.resolve(settingsDir, settings.backupDirectory);
}
if (!settings.port)
    settings.port = 8080;
if (!settings.host)
    settings.host = "127.0.0.1";
if (!settings.types)
    settings.types = {
        "htmlfile": ["htm", "html"]
    };
if (!settings.etag)
    settings.etag = "";
if (!settings.etagWindow)
    settings.etagWindow = 0;
if (!settings.useTW5path)
    settings.useTW5path = false;
if (settings.etag === "disabled" && !settings.backupDirectory)
    console.log("Etag checking is disabled, but a backup folder is not set. "
        + "Changes made in multiple tabs/windows/browsers/computers can overwrite each "
        + "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED "
        + "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can "
        + "also set the etagWindow setting to allow files to be modified if not newer than "
        + "so many seconds from the copy being saved.");
var ENV;
(function (ENV) {
    ENV.disableLocalHost = false;
})(ENV || (ENV = {}));
;
if (process.env.TiddlyServer_disableLocalHost || settings._disableLocalHost)
    ENV.disableLocalHost = true;
//import and init api-access
const tiddlyserver_1 = require("./tiddlyserver");
server_types_1.init(eventer);
tiddlyserver_1.init(eventer);
//emit settings to everyone (I know, this could be an observable)
eventer.emit('settings', settings);
const assets = path.resolve(__dirname, '../assets');
const favicon = path.resolve(__dirname, '../assets/favicon.ico');
const stylesheet = path.resolve(__dirname, '../assets/directory.css');
const serverLocalHost = http.createServer();
const serverNetwork = http.createServer();
process.on('uncaughtException', () => {
    serverNetwork.close();
    serverLocalHost.close();
    console.log('closing server');
});
const un = settings.username;
const pw = settings.password;
const log = rx_1.Observable.bindNodeCallback(logger);
const serverClose = rx_1.Observable.merge(rx_1.Observable.fromEvent(serverLocalHost, 'close').take(1), rx_1.Observable.fromEvent(serverNetwork, 'close').take(1)).multicast(new rx_1.Subject()).refCount();
const routes = {
    'favicon.ico': obs => server_types_1.serveFile(obs, 'favicon.ico', assets),
    'directory.css': obs => server_types_1.serveFile(obs, 'directory.css', assets),
    'static': obs => server_types_1.serveFolder(obs, '/static', path.join(assets, "static")),
    'icons': obs => server_types_1.serveFolder(obs, '/icons', path.join(assets, "icons")),
    'tiddlywiki': tiddlyserver_1.doTiddlyWikiRoute,
    'admin': doAdminRoute
};
rx_1.Observable.merge(rx_1.Observable.fromEvent(serverLocalHost, 'request', (req, res) => {
    if (!req || !res)
        console.log('blank req or res');
    return new server_types_1.StateObject(req, res, debug, eventer, true);
}).takeUntil(serverClose).concatMap(state => {
    return log(state.req, state.res).mapTo(state);
}), rx_1.Observable.fromEvent(serverNetwork, 'request', (req, res) => {
    if (!req || !res)
        console.log('blank req or res');
    return new server_types_1.StateObject(req, res, debug, eventer, false);
}).takeUntil(serverClose).concatMap(state => {
    return log(state.req, state.res).mapTo(state);
})).map(state => {
    //check authentication and do sanity/security checks
    //https://github.com/hueniverse/iron
    //auth headers =====================
    if (!un && !pw)
        return state;
    if (!state.req.headers['authorization']) {
        debug(-2, 'authorization required');
        state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' });
        state.res.end();
        return;
    }
    debug(-3, 'authorization requested');
    var header = state.req.headers['authorization'] || '', // get the header
    token = header.split(/\s+/).pop() || '', // and the encoded auth token
    auth = new Buffer(token, 'base64').toString(), // convert from base64
    parts = auth.split(/:/), // split on colon
    username = parts[0], password = parts[1];
    if (username != un || password != pw) {
        debug(-2, 'authorization invalid - UN:%s - PW:%s', username, password);
        state.throw(401, 'Invalid username or password');
        return;
    }
    debug(-3, 'authorization successful');
    // securityChecks =====================
    return state;
}).filter(server_types_1.obsTruthy).map(state => {
    return state;
}).routeCase(state => {
    return state.path[1];
}, routes, tiddlyserver_1.doTiddlyServerRoute).subscribe((state) => {
    if (!state)
        return; // console.log('blank item');
    if (!state.res.finished) {
        const interval = setInterval(function () {
            state.log(-2, 'LONG RUNNING RESPONSE');
            state.log(-2, '%s %s ', state.req.method, state.req.url);
        }, 60000);
        rx_1.Observable.fromEvent(state.res, 'finish').take(1).subscribe(() => clearInterval(interval));
    }
}, err => {
    debug(4, 'Uncaught error in the server route: ' + err.message);
    debug(4, err.stack);
    debug(4, "the server will now close");
    serverNetwork.close();
    serverLocalHost.close();
}, () => {
    //theoretically we could rebind the listening port without restarting the process, 
    //but I don't know what would be the point of that. If this actually happens, 
    //there will be no more listeners so the process will probably exit.
    //In practice, the only reason this should happen is if the server close event fires.
    console.log('finished processing for some reason');
});
function doAdminRoute(obs) {
    return obs.mergeMap(state => {
        if (!state.isLocalHost)
            return state.throw(403, "Admin is only accessible from localhost");
        return state.throw(404, "Reserved for future use");
    });
}
function serverListenCB(err, res) {
    function connection(client, request) {
        eventer.emit('websocket-connection', client, request);
    }
    function error(error) {
        debug(-2, 'WS-ERROR %s', util_1.inspect(error));
    }
    if (err) {
        console.error('error on app.listen', err);
        return;
    }
    const wssl = new WS_1.Server({ server: serverLocalHost });
    wssl.on('connection', connection);
    wssl.on('error', error);
    const wssn = new WS_1.Server({ server: serverNetwork });
    wssn.on('connection', connection);
    wssn.on('error', error);
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
if (ENV.disableLocalHost) {
    serverNetwork.listen(settings.port, settings.host, serverListenCB);
}
else {
    serverLocalHost.listen(settings.port, "127.0.0.1", (err, res) => {
        if (settings.host !== "127.0.0.1") {
            serverNetwork.listen(settings.port, settings.host, serverListenCB);
        }
        else {
            serverListenCB(err, res);
        }
    });
}
