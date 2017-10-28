import {
    Observable, Subject, Subscription, BehaviorSubject, Subscriber
} from '../lib/rx';

import {
    StateObject, DebugLogger, ErrorLogger, sanitizeJSON, keys, ServerConfig, serveStatic,
    obs_stat, colors, obsTruthy
} from "./server-types";

import * as http from 'http'
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { format, inspect } from 'util';
import { EventEmitter } from 'events';
import { parse as jsonParse } from 'jsonlint';

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
const error = ErrorLogger('APP');
const logger = require('../lib/morgan.js').handler;

const settingsFile = path.normalize(process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../settings.json'));

console.log("Settings file: %s", settingsFile);

var settings: ServerConfig;
{
    function findJSONError(message: string, json: string) {

        const match = /position (\d+)/gi.exec(message);
        if (!match) return;
        const position = +match[1];
        const lines = json.split('\n');
        let current = 1;
        let i = 0;
        for (; i < lines.length; i++) {
            current += lines[i].length + 1; //add one for the new line
            console.log(lines[i]);
            if (current > position) break;
        }
        const linePos = lines[i].length - (current - position) - 1; //take the new line off again
        //not sure why I need the +4 but it seems to hold out.
        console.log(new Array(linePos + 4).join('-') + '^  ' + message);
        for (i++; i < lines.length; i++) {
            console.log(lines[i]);
        }
    }
    const settingsString = fs.readFileSync(settingsFile, 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
    try {
        settings = JSON.parse(settingsString) as ServerConfig;
    } catch (e) {
        console.error(/*colors.BgWhite + */colors.FgRed + "The settings file could not be parsed: %s" + colors.Reset, e.message);
        findJSONError(e.message, settingsString);
        throw "The settings file could not be parsed: Invalid JSON";
    }
}
if (!settings.tree) throw "tree is not specified in the settings file";

const settingsDir = path.dirname(settingsFile);

(function normalizeTree(item) {
    keys(item).forEach(e => {
        if (typeof item[e] === 'string') item[e] = path.resolve(settingsDir, item[e]);
        else if (typeof item[e] === 'object') normalizeTree(item[e]);
        else throw 'Invalid item: ' + e + ': ' + item[e];
    })
})(settings.tree)

if (settings.backupDirectory) {
    settings.backupDirectory = path.resolve(settingsDir, settings.backupDirectory);
}

if (!settings.port) settings.port = 8080;
if (!settings.host) settings.host = "127.0.0.1";
if (!settings.types) settings.types = {
    "htmlfile": ["htm", "html"]
}
if (!settings.etagWindow) settings.etagWindow = 0;

if (settings.etag === "disabled" && !settings.backupDirectory)
    console.log('Etag checking is disabled, but a backup folder is not set. \
    Changes made in multiple tabs/windows/browsers/computers can overwrite each \
    other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED \
    BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can \
    also set the etagWindow setting to allow files to be modified if not newer than \
    so many seconds from the copy being saved.')
//import and init api-access
import { doAPIAccessRoute, init as initAPIAccess } from './api-access';
initAPIAccess(eventer);

//emit settings to everyone (I know, this could be an observable)
eventer.emit('settings', settings);

const serveIcons = (function () {
    const nodeStatic = require('../lib/node-static');
    var serve = new nodeStatic.Server(path.join(__dirname, '../assets/icons'), { mount: '/icons' });
    return Observable.bindCallback<http.IncomingMessage, http.ServerResponse, any>(
        function () {
            return serve.serve.apply(serve, arguments);
        }, (err, res) => [err, res]
    );
})();

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
    'favicon.ico': doFaviconRoute,
    'directory.css': doStylesheetRoute,
    'icons': doIconRoute,
    'admin': doAdminRoute
};
Observable.merge(
    (Observable.fromEvent(serverLocalHost, 'request', (req: http.IncomingMessage, res: http.ServerResponse) => {
        if (!req || !res) console.log('blank req or res');
        return new StateObject(req, res, debug, true);
    }) as Observable<StateObject>).takeUntil(serverClose).concatMap(state => {
        return log(state.req, state.res).mapTo(state);
    }),
    (Observable.fromEvent(serverNetwork, 'request', (req: http.IncomingMessage, res: http.ServerResponse) => {
        if (!req || !res) console.log('blank req or res');
        return new StateObject(req, res, debug, false);
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
}, routes, doAPIAccessRoute).subscribe((state: StateObject) => {
    if (!state) return;// console.log('blank item');
    if (!state.res.finished) {
        const timeout = setTimeout(function () {
            state.error('RESPONSE FINISH TIMED OUT');
            state.error('%s %s ', state.req.method, state.req.url)
            state.throw(500, "Response timed out");
        }, 60000);
        Observable.fromEvent(state.res, 'finish').take(1).subscribe(() => clearTimeout(timeout));
    }
}, err => {
    console.error('Uncaught error in the server route: ' + err.message);
    console.error(err.stack);
    console.error("the server will now close");
    serverNetwork.close();
    serverLocalHost.close();
}, () => {
    //theoretically we could rebind the listening port without restarting the process, 
    //but I don't know what would be the point of that. If this actually happens, 
    //there will be no more listeners so the process will probably exit.
    //In practice, the only reason this should happen is if the server close event fires.
    console.log('finished processing for some reason');
})

function doFaviconRoute(obs: Observable<StateObject>): any {
    return obs.mergeMap((state: StateObject) => {
        return obs_stat(state)(favicon).mergeMap(([err, stat]): any => {
            if (err) return state.throw(404);
            return serveStatic(favicon, state, stat).map(([isErr, res]) => {
                if (isErr) state.throw(res.status, res.message, res.headers);
            }).ignoreElements();
        })
    })
}
function doStylesheetRoute(obs: Observable<StateObject>): any {
    return obs.mergeMap(state => {
        return obs_stat(state)(stylesheet).mergeMap(([err, stat]): any => {
            if (err) return state.throw(404);
            return serveStatic(stylesheet, state, stat).map(([isErr, res]) => {
                if (isErr) state.throw(res.status, res.message, res.headers);
            }).ignoreElements();
        });
    })
}
function doIconRoute(obs: Observable<StateObject>): any {
    return obs.mergeMap(state => {
        return serveIcons(state.req, state.res).do(([err, res]: [{ status: number, message: string, headers: any }, any]) => {
            if (err) state.throw(err.status, err.message);
        }).mapTo(state);
    })
}

function doAdminRoute(obs: Observable<StateObject>): any {
    return obs.mergeMap(state => {
        if (!state.isLocalHost)
            return state.throw(403, "Admin is only accessible from localhost");

        return state.throw(404, "Reserved for future use");
    })
}

function serverListenCB(err: any, res: any) {
    if (err) { console.error('error on app.listen', err); return; }
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

serverLocalHost.listen(settings.port, "127.0.0.1", (err, res) => {
    if (settings.host !== "127.0.0.1")
        serverNetwork.listen(settings.port, settings.host, serverListenCB);
    else
        serverListenCB(err, res);
});


/**
 * to be used with concatMap, mergeMap, etc.
 * @param state 
 */
export function recieveBody(state: StateObject) {
    //get the data from the request
    return Observable.fromEvent<Buffer>(state.req, 'data')
        //only take one since we only need one. this will dispose the listener
        .takeUntil(Observable.fromEvent(state.req, 'end').take(1))
        //accumulate all the chunks until it completes
        .reduce<Buffer>((n, e) => { n.push(e); return n; }, [])
        //convert to json and return state for next part
        .map(e => {
            state.body = Buffer.concat(e).toString('utf8');
            //console.log(state.body);
            if (state.body.length === 0)
                return state;
            try {
                state.json = JSON.parse(state.body);
            } catch (e) {
                //state.json = buf;
            }
            return state;
        });
}
