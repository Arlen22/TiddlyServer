require("../lib/source-map-support-lib");

import { send, ws } from '../lib/bundled-lib';
const sendOptions = {};


import {
    Observable, Subject, Subscription, BehaviorSubject, Subscriber
} from '../lib/rx';

import {
    StateObject, DebugLogger, sanitizeJSON, keys, ServerConfig,
    obs_stat, colors, obsTruthy, Hashmap, obs_readdir, serveFolderObs, serveFileObs, serveFolderIndex,
    init as initServerTypes,
    tryParseJSON,
    JsonError,
    ServerEventEmitter,
    normalizeSettings,
    serveFolder,
    serveFile
} from "./server-types";

import * as http from 'http'
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { format, inspect } from 'util';
import { EventEmitter } from 'events';
// import { parse as jsonParse } from 'jsonlint';

// import send = require('../lib/send-lib');

const { Server: WebSocketServer } = ws;

__dirname = path.dirname(module.filename || process.execPath);

Error.stackTraceLimit = Infinity;

process.on('uncaughtException', err => {
    console.error(inspect(err));
    console.error("caught process uncaughtException");
    fs.appendFile(path.join(__dirname, 'uncaughtException.log'),
        new Date().toISOString() + "\r\n" + inspect(err) + "\r\n\r\n", (err) => {
            if (err) console.log('Could not write to uncaughtException.log');
        });
    if (process.argv[2] !== "--close-on-error" && process.argv[3] !== "--close-on-error")
        setInterval(function () { }, 1000); //hold it open because all other listeners should close
});


console.debug = function () { }; //noop console debug;

//setup global objects
const eventer = new EventEmitter() as ServerEventEmitter;
const debug = DebugLogger('APP');


const settingsFile = path.normalize(process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../settings.json'));

console.log("Settings file: %s", settingsFile);

var settings: ServerConfig;

const settingsString = fs.readFileSync(settingsFile, 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
settings = tryParseJSON<ServerConfig>(settingsString, (e) => {
    console.error(/*colors.BgWhite + */colors.FgRed + "The settings file could not be parsed: %s" + colors.Reset, e.originalError.message);
    console.error(e.errorPosition);
    throw "The settings file could not be parsed: Invalid JSON";
});


if (!settings.tree) throw "tree is not specified in the settings file";

normalizeSettings(settings, settingsFile);

if (["string", "undefined"].indexOf(typeof settings.username) === -1)
    throw "username must be a JSON string if specified";
if (["string", "undefined"].indexOf(typeof settings.password) === -1)
    throw "password must be a JSON string if specified";


namespace ENV {
    export let disableLocalHost: boolean = false;
};

if (process.env.TiddlyServer_disableLocalHost || settings._disableLocalHost)
    ENV.disableLocalHost = true;

//import and init api-access
import { handleTiddlyServerRoute, init as initTiddlyServer, handleTiddlyWikiRoute } from './tiddlyserver';
import { handleSettings, initSettings } from './settingsPage';

import { ServerResponse } from 'http';

initServerTypes(eventer);
initTiddlyServer(eventer);
initSettings(eventer);

//emit settings to everyone (I know, this could be an observable)

const assets = path.resolve(__dirname, '../assets');
const favicon = path.resolve(__dirname, '../assets/favicon.ico');
const stylesheet = path.resolve(__dirname, '../assets/directory.css');

settings.__assetsDir = assets;

eventer.emit('settings', settings);

let serverLocalHost, serverNetwork;


process.on('uncaughtException', () => {
    serverNetwork.close();
    serverLocalHost.close();
    console.log('closing server');
})

// const un = settings.username;
// const pw = settings.password;
// fs.createWriteStream()

const morgan = require('../lib/morgan.js');
function setLog() {
    const logger = morgan.handler({
        logFile: settings.logAccess || undefined,
        logToConsole: !settings.logAccess || settings.logToConsoleAlso,
        logColorsToFile: settings.logColorsToFile
    });
    return settings.logAccess === false ? ((...args: any[]) => Observable.of({}).map(() => { }))
        : Observable.bindNodeCallback<http.IncomingMessage, http.ServerResponse, void>(logger);
}
let log = setLog();
eventer.on('settingsChanged', (keys) => {
    let watch: (keyof ServerConfig)[] = ["logAccess", "logToConsoleAlso", "logColorsToFile"];
    if (watch.some(e => keys.indexOf(e) > -1)) log = setLog();
})

const routes = {
    'admin': state => handleAdminRoute(state),
    'assets': state => handleAssetsRoute(state),
    'favicon.ico': state => serveFile(state, 'favicon.ico', assets),
    'directory.css': state => serveFile(state, 'directory.css', assets),
};
if (typeof settings.tree === "object") {
    let keys = Object.keys(settings.tree);
    let routeKeys = Object.keys(routes);
    let conflict = keys.filter(k => routeKeys.indexOf(k) > -1);
    if (conflict.length) console.log("The paths %s are reserved for use by TiddlyServer", conflict.join(', '));
}

function initServer() {

    serverLocalHost = http.createServer();
    serverNetwork = http.createServer();

    const serverClose = Observable.merge(
        Observable.fromEvent(serverLocalHost, 'close').take(1),
        Observable.fromEvent(serverNetwork, 'close').take(1)
    ).multicast(new Subject()).refCount();

    Observable.merge(
        (Observable.fromEvent(serverLocalHost, 'request', (req: http.IncomingMessage, res: http.ServerResponse) => {
            if (!req || !res) console.log('blank req or res');
            return new StateObject(req, res, debug, eventer, true);
        }) as Observable<StateObject>).takeUntil(serverClose).concatMap(state => {
            return log(state.req, state.res).mapTo(state);
        }),
        (Observable.fromEvent(serverNetwork, 'request', (req: http.IncomingMessage, res: http.ServerResponse) => {
            if (!req || !res) console.log('blank req or res');
            return new StateObject(req, res, debug, eventer, false);
        }) as Observable<StateObject>).takeUntil(serverClose).concatMap(state => {
            return log(state.req, state.res).mapTo(state);
        })
    ).subscribe((state: StateObject) => {
        if (!handleBasicAuth(state)) return;
        const route = routes[state.path[1]];
        if (route) route(state);
        else handleTiddlyServerRoute(state);
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

    if (ENV.disableLocalHost) {
        serverNetwork.listen(settings.port, settings.host, serverListenCB);
    } else {
        serverLocalHost.listen(settings.port, "127.0.0.1", (err, res) => {
            if (settings.host !== "127.0.0.1") {
                serverNetwork.listen(settings.port, settings.host, serverListenCB);
            } else {
                serverListenCB(err, res);
            }
        });
    }
}
initServer();

const errLog = DebugLogger('STATE_ERR');
eventer.on("stateError", (state) => {
    if (state.doneMessage.length > 0)
        dbgLog(2, state.doneMessage.join('\n'));
})
const dbgLog = DebugLogger('STATE_DBG');
eventer.on("stateDebug", (state) => {
    if (state.doneMessage.length > 0)
        dbgLog(-2, state.doneMessage.join('\n'));
})


function handleAssetsRoute(state: StateObject) {
    switch (state.path[2]) {
        case "static": serveFolder(state, '/assets/static', path.join(assets, "static")); break;
        case "icons": serveFolder(state, '/assets/icons', path.join(assets, "icons")); break;
        case "tiddlywiki": handleTiddlyWikiRoute(state); break;
        default: state.throw(404);
    }
}

function handleAdminRoute(state: StateObject) {
    switch (state.path[2]) {
        case "settings": handleSettings(state); break;
        default: state.throw(404);
    }
}
function serverListenCB(err: any, res: any) {
    function connection(client: WebSocket, request: http.IncomingMessage) {
        eventer.emit('websocket-connection', client, request);
    }
    function error(error) {
        debug(-2, 'WS-ERROR %s', inspect(error));
    }

    if (err) { console.error('error on app.listen', err); return; }

    const wssl = new WebSocketServer({ server: serverLocalHost });
    wssl.on('connection', connection);
    wssl.on('error', error);

    const wssn = new WebSocketServer({ server: serverNetwork });
    wssn.on('connection', connection);
    wssn.on('error', error);
    console.log('Open your browser and type in one of the following:');

    if (!settings.host || settings.host === '0.0.0.0') {
        var os = require('os');
        var ifaces = os.networkInterfaces();
        for (var dev in ifaces) {
            var alias = 0;
            ifaces[dev].forEach(function (details: any) {
                if (details.family == 'IPv4' && details.internal === false) {
                    console.log(details.address + (settings.port !== 80 ? ':' + settings.port : ''));
                    ++alias;
                }
            });
        }
    } else {
        console.log(settings.host + (settings.port !== 80 ? ':' + settings.port : ''));
    }
    
}



function handleBasicAuth(state: StateObject): boolean {
    //check authentication and do sanity/security checks
    //https://github.com/hueniverse/iron
    //auth headers =====================
    if (!settings.username && !settings.password) return true;
    const first = (header?: string | string[]) => 
        Array.isArray(header) ? header[0] : header;
    if (!state.req.headers['authorization']) {
        debug(-2, 'authorization required');
        state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' });
        state.res.end();
        return false;
    }
    debug(-3, 'authorization requested');
    var header = first(state.req.headers['authorization']) || '',  // get the header
        token = header.split(/\s+/).pop() || '',                   // and the encoded auth token
        auth = new Buffer(token, 'base64').toString(),             // convert from base64
        parts = auth.split(/:/),                                   // split on colon
        username = parts[0],
        password = parts[1];
    if (username !== settings.username || password !== settings.password) {
        debug(-2, 'authorization invalid - UN:%s - PW:%s', username, password);
        state.throwReason(401, 'Invalid username or password');
        return false;
    }
    debug(-3, 'authorization successful')
    // securityChecks =====================

    return true;
}

// .map((state: StateObject) => {
//     //check authentication and do sanity/security checks
//     //https://github.com/hueniverse/iron
//     //auth headers =====================
//     if (!settings.username && !settings.password) return state;

//     if (!state.req.headers['authorization']) {
//         debug(-2, 'authorization required');
//         state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' });
//         state.res.end();
//         return;
//     }
//     debug(-3, 'authorization requested');
//     var header = state.req.headers['authorization'] || '',        // get the header
//         token = header.split(/\s+/).pop() || '',            // and the encoded auth token
//         auth = new Buffer(token, 'base64').toString(),    // convert from base64
//         parts = auth.split(/:/),                          // split on colon
//         username = parts[0],
//         password = parts[1];
//     if (username !== settings.username || password !== settings.password) {
//         debug(-2, 'authorization invalid - UN:%s - PW:%s', username, password);
//         state.throwReason(401, 'Invalid username or password');
//         return;
//     }
//     debug(-3, 'authorization successful')
//     // securityChecks =====================

//     return state;
// }).filter(obsTruthy).routeCase<StateObject>(
//     state => state.path[1], routes, doTiddlyServerRoute
// )