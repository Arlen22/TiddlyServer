require("../lib/source-map-support-lib");

import {
    Observable, Subject, Subscription, BehaviorSubject, Subscriber
} from '../lib/rx';

import {
    StateObject, DebugLogger, sanitizeJSON, keys, ServerConfig,
    obs_stat, colors, obsTruthy, Hashmap, obs_readdir, serveFolder, serveFile, serveFolderIndex,
    init as initServerTypes,
    tryParseJSON,
    JsonError
} from "./server-types";

import * as http from 'http'
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { format, inspect } from 'util';
import { EventEmitter } from 'events';
import { parse as jsonParse } from 'jsonlint';

import send = require('../lib/send-lib');
const sendOptions = {};

import { Server as WebSocketServer } from '../lib/websocket-server/WS';

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
const eventer = new EventEmitter();
const debug = DebugLogger('APP');
const logger = require('../lib/morgan.js').handler;

const settingsFile = path.normalize(process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../settings.json'));

console.log("Settings file: %s", settingsFile);

var settings: ServerConfig;
{
    const settingsString = fs.readFileSync(settingsFile, 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
    let settingsError: { error?: JsonError } = {} as any;
    settings = tryParseJSON(settingsString, settingsError);
    if (!settings && settingsError.error) {
        let e = settingsError.error;
        console.error(/*colors.BgWhite + */colors.FgRed + "The settings file could not be parsed: %s" + colors.Reset, e.originalError.message);
        console.error(e.errorPosition);
        throw "The settings file could not be parsed: Invalid JSON";
    }
}
if (!settings.tree) throw "tree is not specified in the settings file";

const settingsDir = path.dirname(settingsFile);

if (typeof settings.tree === "object")
    (function normalizeTree(item) {
        keys(item).forEach(e => {
            if (typeof item[e] === 'string') item[e] = path.resolve(settingsDir, item[e]);
            else if (typeof item[e] === 'object') normalizeTree(item[e]);
            else throw 'Invalid item: ' + e + ': ' + item[e];
        })
    })(settings.tree);
else settings.tree = path.resolve(settingsDir, settings.tree);

if (settings.backupDirectory) {
    settings.backupDirectory = path.resolve(settingsDir, settings.backupDirectory);
}

if (!settings.port) settings.port = 8080;
if (!settings.host) settings.host = "127.0.0.1";
if (!settings.types) settings.types = {
    "htmlfile": ["htm", "html"]
}
if (!settings.etag) settings.etag = "";
if (!settings.etagWindow) settings.etagWindow = 0;
if (!settings.useTW5path) settings.useTW5path = false;

if (settings.etag === "disabled" && !settings.backupDirectory)
    console.log("Etag checking is disabled, but a backup folder is not set. "
        + "Changes made in multiple tabs/windows/browsers/computers can overwrite each "
        + "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED "
        + "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can "
        + "also set the etagWindow setting to allow files to be modified if not newer than "
        + "so many seconds from the copy being saved.");

namespace ENV {
    export let disableLocalHost: boolean = false;
};

if (process.env.TiddlyServer_disableLocalHost || settings._disableLocalHost)
    ENV.disableLocalHost = true;

//import and init api-access
import { doTiddlyServerRoute, init as initTiddlyServer, doTiddlyWikiRoute } from './tiddlyserver';
import { ServerResponse } from 'http';
initServerTypes(eventer);
initTiddlyServer(eventer);

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
})

const un = settings.username;
const pw = settings.password;

const log = Observable.bindNodeCallback<http.IncomingMessage, http.ServerResponse, void>(logger);

const serverClose = Observable.merge(
    Observable.fromEvent(serverLocalHost, 'close').take(1),
    Observable.fromEvent(serverNetwork, 'close').take(1)
).multicast(new Subject()).refCount();

const routes = {
    'favicon.ico': obs => serveFile(obs, 'favicon.ico', assets),
    'directory.css': obs => serveFile(obs, 'directory.css', assets),
    'static': obs => serveFolder(obs, '/static', path.join(assets, "static")),
    'icons': obs => serveFolder(obs, '/icons', path.join(assets, "icons")),
    'tiddlywiki': doTiddlyWikiRoute,
    'admin': doAdminRoute
};

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
).map(state => {
    //check authentication and do sanity/security checks
    //https://github.com/hueniverse/iron
    //auth headers =====================
    if (!un && !pw) return state;

    if (!state.req.headers['authorization']) {
        debug('authorization required');
        state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' });
        state.res.end();
        return;
    }
    debug('authorization requested');
    var header = state.req.headers['authorization'] || '',        // get the header
        token = header.split(/\s+/).pop() || '',            // and the encoded auth token
        auth = new Buffer(token, 'base64').toString(),    // convert from base64
        parts = auth.split(/:/),                          // split on colon
        username = parts[0],
        password = parts[1];
    if (username != un || password != pw) {
        debug('authorization invalid - UN:%s - PW:%s', username, password);
        state.throw(401, 'Invalid username or password');
        return;
    }
    debug('authorization successful')
    // securityChecks =====================

    return state;
}).filter(obsTruthy).map(state => {
    return state;
}).routeCase<StateObject>(state => {
    return state.path[1];
}, routes, doTiddlyServerRoute).subscribe((state: StateObject) => {
    if (!state) return;// console.log('blank item');
    if (!state.res.finished) {
        const interval = setInterval(function () {
            state.log(-2, 'LONG RUNNING RESPONSE');
            state.log(-2, '%s %s ', state.req.method, state.req.url)
        }, 60000);
        Observable.fromEvent(state.res, 'finish').take(1).subscribe(() => clearInterval(interval));
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
})

function doAdminRoute(obs: Observable<StateObject>): any {
    return obs.mergeMap(state => {
        if (!state.isLocalHost) return state.throw(403, "Admin is only accessible from localhost");
        return state.throw(404, "Reserved for future use");
    }) as Observable<StateObject>
}

function serverListenCB(err: any, res: any) {
    function connection(client: WebSocket, request: http.IncomingMessage) {
        eventer.emit('websocket-connection', client, request);
    }
    function error(error) {
        debug('WS-ERROR %s', inspect(error));
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



