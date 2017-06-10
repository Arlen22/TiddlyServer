"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("./lib/rx");
const server_types_1 = require("./server-types");
const http = require("http");
const fs = require("fs");
const path = require("path");
const events_1 = require("events");
Error.stackTraceLimit = Infinity;
console.debug = function () { }; //noop console debug;
//setup global objects
const eventer = new events_1.EventEmitter();
const debug = server_types_1.DebugLogger('APP');
const error = server_types_1.ErrorLogger('APP');
const logger = require('./lib/morgan.js').handler;
const settingsFile = path.resolve(process.argv[2] || 'settings.json');
var settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
(function normalizeTree(item) {
    server_types_1.keys(item).forEach(e => {
        if (typeof item[e] === 'string')
            item[e] = path.resolve(__dirname, item[e]);
        else if (typeof item[e] === 'object')
            normalizeTree(item[e]);
        else
            throw 'Invalid item: ' + e + ': ' + item[e];
    });
})(settings.tree);
//import and init api-access
const api_access_1 = require("./api-access");
api_access_1.init(eventer);
//emit settings to everyone (I know, this could be an observable)
eventer.emit('settings', settings);
const serveIcons = (function () {
    const nodeStatic = require('./lib/node-static');
    var serve = new nodeStatic.Server(path.join(__dirname, 'icons'), { mount: '/icons' });
    return rx_1.Observable.bindCallback(function () {
        return serve.serve.apply(serve, arguments);
    }, (err, res) => [err, res]);
})();
const favicon = path.resolve(__dirname, 'assets', 'favicon.ico');
const stylesheet = path.resolve(__dirname, 'assets', 'directory.css');
const server = http.createServer();
const un = settings.username;
const pw = settings.password;
const log = rx_1.Observable.bindNodeCallback(logger);
const serverClose = rx_1.Observable.fromEvent(server, 'close').take(1).multicast(new rx_1.Subject()).refCount();
rx_1.Observable.fromEvent(server, 'request', (req, res) => {
    if (!req || !res)
        console.log('blank req or res');
    return new server_types_1.StateObject(req, res, debug, error);
}).takeUntil(serverClose).concatMap(state => {
    return log(state.req, state.res).mapTo(state);
}).map(state => {
    //check authentication and do sanity/security checks
    //https://github.com/hueniverse/iron
    //auth headers =====================
    if (!un && !pw)
        return state;
    if (!state.req.headers['authorization']) {
        debug('authorization required');
        state.res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Protocol App"', 'Content-Type': 'text/plain' });
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
}).filter(state => !!state).routeCase(state => {
    return state.path[1];
}, {
    'favicon.ico': doFaviconRoute,
    'directory.css': doStylesheetRoute,
    'icons': doIconRoute,
    'admin': server_types_1.StateObject.errorRoute(404, 'Reserved for future use')
}, api_access_1.doAPIAccessRoute).subscribe((state) => {
    if (!state)
        return console.log('blank item');
    if (!state.res.finished) {
        const timeout = setTimeout(function () {
            state.error('RESPONSE FINISH TIMED OUT');
            state.error('%s %s ', state.req.method, state.req.url);
            state.throw(500, "Response timed out");
        }, 60000);
        rx_1.Observable.fromEvent(state.res, 'finish').take(1).subscribe(() => clearTimeout(timeout));
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
const PORT = 80;
server.listen(PORT, function (err, res) {
    if (err) {
        console.error('error on app.listen', err);
        return;
    }
    console.log('Open you browswer (Chrome or Firefox) and type in one of the following:');
    //console.log('3000 on one of the following IP addresses.');
    var os = require('os');
    var ifaces = os.networkInterfaces();
    //console.log(ifaces);
    for (var dev in ifaces) {
        var alias = 0;
        ifaces[dev].forEach(function (details) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0EsaUNBQTBGO0FBRTFGLGlEQUFnSTtBQUVoSSw2QkFBNEI7QUFDNUIseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUc3QixtQ0FBc0M7QUFFdEMsS0FBSyxDQUFDLGVBQWUsR0FBRyxRQUFRLENBQUM7QUFFakMsT0FBTyxDQUFDLEtBQUssR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLHFCQUFxQjtBQUV0RCxzQkFBc0I7QUFDdEIsTUFBTSxPQUFPLEdBQUcsSUFBSSxxQkFBWSxFQUFFLENBQUM7QUFDbkMsTUFBTSxLQUFLLEdBQUcsMEJBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNqQyxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2pDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUVsRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUM7QUFFdEUsSUFBSSxRQUFRLEdBS1IsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBaUIsQ0FBQztBQUV0RSxDQUFDLHVCQUF1QixJQUFJO0lBQ3hCLG1CQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDaEIsRUFBRSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssUUFBUSxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVFLElBQUksQ0FBQyxFQUFFLENBQUMs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