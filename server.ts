
import { Observable, Subject, Subscription, BehaviorSubject, Subscriber } from './lib/rx';

import { StateObject, DebugLogger, ErrorLogger, sanitizeJSON, keys, ServerConfig, serveStatic, obs_stat } from "./server-types";

import * as http from 'http'
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { format } from 'util';
import { EventEmitter } from 'events';

Error.stackTraceLimit = Infinity;

console.debug = function () { }; //noop console debug;

//setup global objects
const eventer = new EventEmitter();
const debug = DebugLogger('APP');
const error = ErrorLogger('APP');
const logger = require('./lib/morgan.js').handler;

const settingsFile = path.resolve(process.argv[2] || 'settings.json');

var settings: {
    tree: any,
    watch: string[],
    username?: string,
    password?: string
} = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as ServerConfig;

(function normalizeTree(item) {
    keys(item).forEach(e => {
        if (typeof item[e] === 'string') item[e] = path.resolve(__dirname, item[e]);
        else if (typeof item[e] === 'object') normalizeTree(item[e]);
        else throw 'Invalid item: ' + e + ': ' + item[e];
    })
})(settings.tree)

//import and init api-access
import { doAPIAccessRoute, init as initAPIAccess } from './api-access';
initAPIAccess(eventer);

//emit settings to everyone (I know, this could be an observable)
eventer.emit('settings', settings);

const serveIcons = (function () {
    const nodeStatic = require('./lib/node-static');
    var serve = new nodeStatic.Server(path.join(__dirname, 'icons'), { mount: '/icons' });
    return Observable.bindCallback<http.IncomingMessage, http.ServerResponse, any>(
        function () {
            return serve.serve.apply(serve, arguments);
        }, (err, res) => [err, res]
    );
})();

const favicon = path.resolve(__dirname, 'assets', 'favicon.ico');
const stylesheet = path.resolve(__dirname, 'assets', 'directory.css');


const server = http.createServer();

const un = settings.username;
const pw = settings.password;

const log = Observable.bindNodeCallback<http.IncomingMessage, http.ServerResponse, void>(logger);

const serverClose = Observable.fromEvent(server, 'close').take(1).multicast<StateObject>(new Subject()).refCount();

(Observable.fromEvent(server, 'request', (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (!req || !res) console.log('blank req or res');
    return new StateObject(req, res, debug, error);
}) as Observable<StateObject>).takeUntil(serverClose).concatMap(state => {
    return log(state.req, state.res).mapTo(state);
}).map(state => {
    //check authentication and do sanity/security checks
    //https://github.com/hueniverse/iron
    //auth headers =====================
    if (!un && !pw) return state;

    if (!state.req.headers['authorization']) {
        debug('authorization required');
        state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Protocol App"', 'Content-Type': 'text/plain' });
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
}).filter(state => !!state).routeCase<StateObject>(state => {
    return state.path[1];
}, {
        'favicon.ico': doFaviconRoute,
        'directory.css': doStylesheetRoute,
        'icons': doIconRoute,
        'admin': StateObject.errorRoute(404, 'Reserved for future use')
    }, doAPIAccessRoute).subscribe((state: StateObject) => {
        if (!state) return console.log('blank item');
        if (!state.res.finished) {
            const timeout = setTimeout(function () {
                state.error('RESPONSE FINISH TIMED OUT');
                state.error('%s %s ', state.req.method, state.req.url)
                state.throw(500, "Response timed out");
            }, 60000);
            Observable.fromEvent(state.res, 'finish').take(1).subscribe(() => clearTimeout(timeout));
        }
    }, err => {
        console.error('Uncaught error in the processing stack: ' + err.message);
        console.error(err.stack);
        server.close();
    }, () => {
        //theoretically we could rebind the listening port without restarting the process, 
        //but I don't know what would be the point of that. If this actually happens, 
        //there will be no more listeners so the process will probably exit.
        //In practice, the only reason this should happen is if the server close event fires.
        console.log('finished processing for some reason');
    })

function doFaviconRoute(obs: Observable<StateObject>) {
    return obs.mergeMap((state: StateObject) => {
        return obs_stat(state)(favicon).mergeMap(([err, stat]): any => {
            if (err) return state.throw(404);
            return serveStatic(favicon, state, stat).map(([isErr, res]) => {
                if (isErr) state.throw(res.status, res.message, res.headers);
            }).ignoreElements();
        })
    })
}
function doStylesheetRoute(obs: Observable<StateObject>) {
    return obs.mergeMap(state => {
        return obs_stat(state)(stylesheet).mergeMap(([err, stat]): any => {
            if (err) return state.throw(404);
            return serveStatic(stylesheet, state, stat).map(([isErr, res]) => {
                if (isErr) state.throw(res.status, res.message, res.headers);
            }).ignoreElements();
        })
    })
}
function doIconRoute(obs: Observable<StateObject>) {
    return obs.mergeMap(state => {
        return serveIcons(state.req, state.res).do(([err, res]: [{ status: number, message: string, headers: any }, any]) => {
            if (err) state.throw(err.status, err.message);
        }).mapTo(state);
    })
}
const PORT = 80;
server.listen(PORT, function (err: any, res: any) {
    if (err) { console.error('error on app.listen', err); return; }
    console.log('Open you browswer (Chrome or Firefox) and type in one of the following:');
    //console.log('3000 on one of the following IP addresses.');
    var os = require('os');
    var ifaces = os.networkInterfaces();
    //console.log(ifaces);
    for (var dev in ifaces) {
        var alias = 0;
        ifaces[dev].forEach(function (details: any) {
            if (details.family == 'IPv4' && details.internal === false) {
                //dev+(alias?':'+alias:'')
                console.log(details.address + (PORT !== 80 ? ':' + PORT : ''));
                ++alias;
            }
        });
    }
});
/**
 * to be used with concatMap, mergeMap, etc.
 * @param state 
 */
export function recieveBody(state: StateObject) {
    //get the data from the request
    return Observable.fromEvent(state.req, 'data')
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
