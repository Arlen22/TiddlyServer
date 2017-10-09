"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("../lib/rx");
const server_types_1 = require("./server-types");
const http = require("http");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const events_1 = require("events");
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
const error = server_types_1.ErrorLogger('APP');
const logger = require('../lib/morgan.js').handler;
const settingsFile = path.normalize(process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../settings.json'));
console.log("Settings file: %s", settingsFile);
var settings;
{
    function findJSONError(message, json) {
        const match = /position (\d+)/gi.exec(message);
        if (!match)
            return;
        const position = +match[1];
        const lines = json.split('\n');
        let current = 1;
        let i = 0;
        for (; i < lines.length; i++) {
            current += lines[i].length + 1; //add one for the new line
            console.log(lines[i]);
            if (current > position)
                break;
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
        settings = JSON.parse(settingsString);
    }
    catch (e) {
        console.error(/*colors.BgWhite + */ server_types_1.colors.FgRed + "The settings file could not be parsed: %s" + server_types_1.colors.Reset, e.message);
        findJSONError(e.message, settingsString);
        throw "The settings file could not be parsed: Invalid JSON";
    }
}
if (!settings.tree)
    throw "tree is not specified in the settings file";
const settingsDir = path.dirname(settingsFile);
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
//import and init api-access
const api_access_1 = require("./api-access");
api_access_1.init(eventer);
//emit settings to everyone (I know, this could be an observable)
eventer.emit('settings', settings);
const serveIcons = (function () {
    const nodeStatic = require('../lib/node-static');
    var serve = new nodeStatic.Server(path.join(__dirname, '../assets/icons'), { mount: '/icons' });
    return rx_1.Observable.bindCallback(function () {
        return serve.serve.apply(serve, arguments);
    }, (err, res) => [err, res]);
})();
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
    'favicon.ico': doFaviconRoute,
    'directory.css': doStylesheetRoute,
    'icons': doIconRoute,
    'admin': doAdminRoute
};
rx_1.Observable.merge(rx_1.Observable.fromEvent(serverLocalHost, 'request', (req, res) => {
    if (!req || !res)
        console.log('blank req or res');
    return new server_types_1.StateObject(req, res, debug, true);
}).takeUntil(serverClose).concatMap(state => {
    return log(state.req, state.res).mapTo(state);
}), rx_1.Observable.fromEvent(serverNetwork, 'request', (req, res) => {
    if (!req || !res)
        console.log('blank req or res');
    return new server_types_1.StateObject(req, res, debug, false);
}).takeUntil(serverClose).concatMap(state => {
    return log(state.req, state.res).mapTo(state);
})).map(state => {
    //check authentication and do sanity/security checks
    //https://github.com/hueniverse/iron
    //auth headers =====================
    if (!un && !pw)
        return state;
    if (!state.req.headers['authorization']) {
        debug('authorization required');
        state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' });
        state.res.end();
        return;
    }
    debug('authorization requested');
    var header = state.req.headers['authorization'] || '', // get the header
    token = header.split(/\s+/).pop() || '', // and the encoded auth token
    auth = new Buffer(token, 'base64').toString(), // convert from base64
    parts = auth.split(/:/), // split on colon
    username = parts[0], password = parts[1];
    if (username != un || password != pw) {
        debug('authorization invalid - UN:%s - PW:%s', username, password);
        state.throw(401, 'Invalid username or password');
        return;
    }
    debug('authorization successful');
    // securityChecks =====================
    return state;
}).filter(server_types_1.obsTruthy).routeCase(state => {
    return state.path[1];
}, routes, api_access_1.doAPIAccessRoute).subscribe((state) => {
    if (!state)
        return; // console.log('blank item');
    if (!state.res.finished) {
        const timeout = setTimeout(function () {
            state.error('RESPONSE FINISH TIMED OUT');
            state.error('%s %s ', state.req.method, state.req.url);
            state.throw(500, "Response timed out");
        }, 60000);
        rx_1.Observable.fromEvent(state.res, 'finish').take(1).subscribe(() => clearTimeout(timeout));
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
});
function doFaviconRoute(obs) {
    return obs.mergeMap((state) => {
        return server_types_1.obs_stat(state)(favicon).mergeMap(([err, stat]) => {
            if (err)
                return state.throw(404);
            return server_types_1.serveStatic(favicon, state, stat).map(([isErr, res]) => {
                if (isErr)
                    state.throw(res.status, res.message, res.headers);
            }).ignoreElements();
        });
    });
}
function doStylesheetRoute(obs) {
    return obs.mergeMap(state => {
        return server_types_1.obs_stat(state)(stylesheet).mergeMap(([err, stat]) => {
            if (err)
                return state.throw(404);
            return server_types_1.serveStatic(stylesheet, state, stat).map(([isErr, res]) => {
                if (isErr)
                    state.throw(res.status, res.message, res.headers);
            }).ignoreElements();
        });
    });
}
function doIconRoute(obs) {
    return obs.mergeMap(state => {
        return serveIcons(state.req, state.res).do(([err, res]) => {
            if (err)
                state.throw(err.status, err.message);
        }).mapTo(state);
    });
}
function doAdminRoute(obs) {
    return obs.mergeMap(state => {
        if (!state.isLocalHost)
            return state.throw(403, "Admin is only accessible from localhost");
        return state.throw(404, "Reserved for future use");
    });
}
function serverListenCB(err, res) {
    if (err) {
        console.error('error on app.listen', err);
        return;
    }
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
function recieveBody(state) {
    //get the data from the request
    return rx_1.Observable.fromEvent(state.req, 'data')
        .takeUntil(rx_1.Observable.fromEvent(state.req, 'end').take(1))
        .reduce((n, e) => { n.push(e); return n; }, [])
        .map(e => {
        state.body = Buffer.concat(e).toString('utf8');
        //console.log(state.body);
        if (state.body.length === 0)
            return state;
        try {
            state.json = JSON.parse(state.body);
        }
        catch (e) {
            //state.json = buf;
        }
        return state;
    });
}
exports.recieveBody = recieveBody;
