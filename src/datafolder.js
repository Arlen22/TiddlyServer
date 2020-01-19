"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const path = require("path");
const fs = require("fs");
//import { TiddlyWiki } from 'tiddlywiki';
const events_1 = require("events");
const url_1 = require("url");
const util_1 = require("util");
// var settings: ServerConfig = {} as any;
// const debug = DebugLogger('DAT');
const loadedFolders = {};
const otherSocketPaths = {};
const clientsList = {};
let eventer;
function init(e) {
    eventer = e;
    eventer.on('settings', function (set) {
    });
    eventer.on('settingsChanged', (keys) => {
    });
    eventer.on('websocket-connection', async function (data) {
        const { request, client, settings, treeHostIndex, debugOutput } = data;
        const debug = server_types_1.StateObject.DebugLogger("WEBSOCK").bind({ settings, debugOutput });
        const root = settings.tree[treeHostIndex].$mount;
        let pathname = url_1.parse(request.url).pathname; // new URL(request.url as string);
        var result = server_types_1.resolvePath(pathname.split('/'), root);
        if (!result)
            return client.close(404);
        let statPath = await server_types_1.statWalkPath(result);
        //if this is a datafolder, we hand the client and request off directly to it
        //otherwise we stick it in its own section
        if (statPath.itemtype === "datafolder") {
            const target = settings.__targetTW;
            //trigger the datafolder to load in case it isn't
            const { mount, folder } = loadDataFolderTrigger(result, statPath, pathname, '', target, settings.datafolder);
            const subpath = pathname.slice(mount.length);
            //event to give the client to the data folder
            const loadClient = () => {
                debug(-1, 'ws-client-connect %s', mount);
                loadedFolders[mount].events.emit('ws-client-connect', client, request, subpath);
            };
            //if the data folder is still loading, we wait, otherwise give immediately
            if (Array.isArray(loadedFolders[mount].handler)) {
                loadedFolders[mount].events.once('ws-client-preload', loadClient);
            }
            else {
                loadClient();
            }
        }
        else {
            client.addEventListener('message', (event) => {
                console.log('message', event);
                debug(-3, 'WS-MESSAGE %s', util_1.inspect(event));
                clientsList[pathname].forEach(e => {
                    if (e !== client)
                        e.send(event.data);
                });
            });
            client.addEventListener('error', (event) => {
                debug(-2, 'WS-ERROR %s %s', pathname, event.type);
                var index = clientsList[pathname].indexOf(client);
                if (index > -1)
                    clientsList[pathname].splice(index, 1);
                client.close();
            });
            client.addEventListener('close', (event) => {
                debug(-2, 'WS-CLOSE %s %s %s', pathname, event.code, event.reason);
                var index = clientsList[pathname].indexOf(client);
                if (index > -1)
                    clientsList[pathname].splice(index, 1);
            });
            if (!clientsList[pathname])
                clientsList[pathname] = [];
            clientsList[pathname].push(client);
        }
    });
}
exports.init = init;
function quickArrayCheck(obj) {
    return typeof obj.length === 'number';
}
function handleDataFolderRequest(result, state) {
    const target = state.settings.__targetTW;
    const { mount, folder } = loadDataFolderTrigger(result, state.statPath, state.url.pathname, state.url.query.reload || "", target, state.settings.datafolder);
    const isFullpath = result.filepathPortion.length === state.statPath.index;
    //set the trailing slash correctly if this is the actual page load
    //redirect ?reload requests to the same, to prevent it being 
    //reloaded multiple times for the same page load.
    if (isFullpath && (state.pathOptions.noTrailingSlash !== !state.url.pathname.endsWith("/"))
        || state.url.query.reload) {
        let redirect = mount + (!state.pathOptions.noTrailingSlash ? "/" : "");
        state.respond(302, "", {
            'Location': redirect
        }).empty();
        return;
        // return Observable.empty();
    }
    const load = loadedFolders[mount];
    if (Array.isArray(load.handler)) {
        load.handler.push(state);
    }
    else {
        load.handler(state);
    }
}
exports.handleDataFolderRequest = handleDataFolderRequest;
function loadDataFolderTrigger(result, statPath, pathname, reload, target, vars) {
    let filepathPrefix = result.filepathPortion.slice(0, statPath.index).join('/');
    //get the tree path, and add the file path (none if the tree path is a datafolder)
    let fullPrefix = ["", result.treepathPortion.join('/')];
    if (statPath.index > 0)
        fullPrefix.push(filepathPrefix);
    //join the parts and split into an array
    fullPrefix = fullPrefix.join('/').split('/');
    //use the unaltered path in the url as the tiddlywiki prefix
    let mount = pathname.split('/').slice(0, fullPrefix.length).join('/');
    //get the full path to the folder as specified in the tree
    let folder = statPath.statpath;
    // reload the plugin cache if requested
    // if (reload === "plugins") initPluginLoader();
    //initialize the tiddlywiki instance
    if (!loadedFolders[mount] || reload === "true") {
        loadedFolders[mount] = { mount, folder, events: new events_1.EventEmitter(), handler: [] };
        loadDataFolderType(mount, folder, reload, target, vars);
        // loadTiddlyServerAdapter(prefixURI, folder, state.url.query.reload);
        // loadTiddlyWiki(prefixURI, folder);
    }
    return { mount, folder };
}
function loadDataFolderType(mount, folder, reload, target, vars) {
    util_1.promisify(fs.readFile)(path.join(folder, "tiddlywiki.info"), 'utf8').then((data) => {
        const wikiInfo = server_types_1.tryParseJSON(data, e => { throw e; });
        if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
            loadDataFolderTiddlyWiki(mount, folder, reload, target, vars);
        }
        else if (wikiInfo.type === "tiddlyserver") {
            // loadTiddlyServerAdapter(mount, folder, reload)
        }
    });
}
function loadDataFolderTiddlyWiki(mount, folder, reload, target, vars) {
    console.time('twboot-' + folder);
    //The bundle in the Tiddlyserver folder
    // const target = "../tiddlywiki";
    //The source code the 5.1.19 bundle was compiled from
    // const target = "..\\..\\TiddlyWiki5-compiled\\Source\\TiddlyWiki5-5.1.19";
    //Jermolene/TiddlyWiki5@master
    // const target = "..\\..\\_reference\\TiddlyWiki5-Arlen22";
    let nodeRequire = typeof __non_webpack_require__ !== "undefined" ? __non_webpack_require__ : require;
    let _wiki = undefined;
    // console.log(nodeRequire.resolve(target + "/package.json"));
    const $tw = nodeRequire(target + "/boot/boot.js").TiddlyWiki(nodeRequire(target + "/boot/bootprefix.js").bootprefix({
        packageInfo: nodeRequire(target + '/package.json')
    }));
    $tw.boot.argv = [folder];
    $tw.preloadTiddler({
        "text": "$protocol$//$host$" + mount + "/",
        "title": "$:/config/tiddlyweb/host"
    });
    try {
        $tw.boot.boot(() => {
            complete(null, $tw);
        });
    }
    catch (err) {
        complete(err, null);
    }
    function complete(err, $tw) {
        console.timeEnd('twboot-' + folder);
        if (err) {
            return console.log(mount, folder, err);
        }
        //we use $tw.modules.execute so that the module has its respective $tw variable.
        var Server;
        try {
            Server = $tw.modules.execute('$:/core/modules/server/server.js').Server;
        }
        catch (e) {
            console.log(mount, folder, e);
            return;
        }
        var server = new Server({
            wiki: $tw.wiki,
            variables: Object.assign({ "path-prefix": mount, "root-tiddler": "$:/core/save/all", "gzip": "yes" }, vars)
        });
        // server.TS_StateObject_Queue = [];
        // server.TS_Request_Queue = [];
        let queue = {};
        let auth = new TiddlyServerAuthentication(server, (sym) => {
            let res = queue[sym];
            delete queue[sym];
            return res;
        });
        auth.init();
        server.authenticators.unshift(auth);
        //invoke the server start hook so plugins can extend the server or attach to the event handler
        $tw.hooks.invokeHook('th-server-command-post-start', server, loadedFolders[mount].events, "tiddlyserver");
        //add the event emitter to the $tw variable
        $tw.wss = loadedFolders[mount].events;
        //set the request handler, indicating we are now ready to recieve requests
        const requests = loadedFolders[mount].handler;
        loadedFolders[mount].handler = (state) => {
            //pretend to the handler like the path really has a trailing slash
            let req = new Object(state.req);
            req.url += ((state.url.pathname === mount && !state.url.pathname.endsWith("/")) ? "/" : "");
            req.tsstate = Symbol("state object pointer");
            queue[req.tsstate] = state;
            server.requestHandler(req, state.res);
        };
        //send queued websocket clients to the event emitter
        loadedFolders[mount].events.emit('ws-client-preload');
        //send the queued requests to the handler
        requests.forEach(e => loadedFolders[mount].handler(e));
    }
}
;
function doError(debug, mount, folder, err) {
    debug(3, 'error starting %s at %s: %s', mount, folder, err.stack);
    const requests = loadedFolders[mount].handler;
    loadedFolders[mount] = {
        handler: function (state) {
            state.respond(500, "TW5 data folder failed").string("The Tiddlywiki data folder failed to load. The error has been logged to the " +
                "terminal with priority level 2. " +
                "To try again, use ?reload=true after making any necessary corrections.");
        }
    };
    requests.forEach(([req, res]) => {
        loadedFolders[mount].handler(req, res);
    });
}
class TiddlyServerAuthentication {
    /**
     *
     * @param server The server instance that instantiated this authenticator
     */
    constructor(server, retrieve) {
        this.server = server;
        //make sure nothing can access the state object!
        this.authenticateRequest = (request, response, state) => {
            let tsstate = retrieve(request.tsstate);
            if (!tsstate.authAccountsKey && state.allowAnon) {
                return true;
            }
            else if (tsstate.authAccountsKey) {
                state.authenticatedUsername = tsstate.username;
                return true;
            }
            else {
                //The wiki itself may specify that anonymous users cannot access it
                tsstate.throwReason(403, "Unauthenticated users cannot access this wiki");
                return false;
            }
        };
    }
    /**
     * Returns true if the authenticator is active, false if it is inactive,
     * or a string if there is an error
     */
    init() {
        return true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWZvbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGFmb2xkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxpREFBbVI7QUFLblIsNkJBQTZCO0FBRTdCLHlCQUF5QjtBQUd6QiwwQ0FBMEM7QUFDMUMsbUNBQXNDO0FBQ3RDLDZCQUE0QjtBQUM1QiwrQkFBMEM7QUFPMUMsMENBQTBDO0FBRTFDLG9DQUFvQztBQUVwQyxNQUFNLGFBQWEsR0FBZ0MsRUFBRSxDQUFDO0FBQ3RELE1BQU0sZ0JBQWdCLEdBQWlDLEVBQUUsQ0FBQztBQUMxRCxNQUFNLFdBQVcsR0FBaUMsRUFBRSxDQUFDO0FBQ3JELElBQUksT0FBMkIsQ0FBQztBQUVoQyxTQUFnQixJQUFJLENBQUMsQ0FBcUI7SUFDeEMsT0FBTyxHQUFHLENBQUMsQ0FBQztJQUNaLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLFVBQVUsR0FBaUI7SUFFbEQsQ0FBQyxDQUFDLENBQUE7SUFDRixPQUFPLENBQUMsRUFBRSxDQUFDLGlCQUFpQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7SUFFdkMsQ0FBQyxDQUFDLENBQUE7SUFDRixPQUFPLENBQUMsRUFBRSxDQUFDLHNCQUFzQixFQUFFLEtBQUssV0FBVyxJQUFvQjtRQUVyRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQztRQUN2RSxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNqRixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUNqRCxJQUFJLFFBQVEsR0FBRyxXQUFLLENBQUMsT0FBTyxDQUFDLEdBQWEsQ0FBQyxDQUFDLFFB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