"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const $tw = require("tiddlywiki/boot/boot.js");
const path = require("path");
const fs = require("fs");
const events_1 = require("events");
const url_1 = require("url");
const util_1 = require("util");
const loadedFolders = {};
const otherSocketPaths = {};
const clientsList = {};
let eventer;
function init(e) {
    eventer = e;
    eventer.on("settings", function (set) { });
    eventer.on("settingsChanged", keys => { });
    eventer.on("websocket-connection", async function (data) {
        const { request, client, settings, treeHostIndex, debugOutput } = data;
        const debug = server_types_1.StateObject.DebugLogger("WEBSOCK").bind({
            settings,
            debugOutput
        });
        const root = settings.tree[treeHostIndex].$mount;
        let pathname = url_1.parse(request.url).pathname; // new URL(request.url as string);
        if (!pathname) {
            console.error("[ERROR]: parsing pathname");
            return;
        }
        let result = server_types_1.resolvePath(pathname.split("/"), root);
        if (!result)
            return client.close(404);
        let statPath = await server_types_1.statWalkPath(result);
        //if this is a datafolder, we hand the client and request off directly to it
        //otherwise we stick it in its own section
        if (statPath.itemtype === "datafolder") {
            const target = settings.__targetTW;
            //trigger the datafolder to load in case it isn't
            const { mount, folder } = loadDataFolderTrigger(result, statPath, pathname, "", target, settings.datafolder);
            const subpath = pathname.slice(mount.length);
            //event to give the client to the data folder
            const loadClient = () => {
                debug(-1, "ws-client-connect %s", mount);
                loadedFolders[mount].events.emit("ws-client-connect", client, request, subpath);
            };
            //if the data folder is still loading, we wait, otherwise give immediately
            if (Array.isArray(loadedFolders[mount].handler)) {
                loadedFolders[mount].events.once("ws-client-preload", loadClient);
            }
            else {
                loadClient();
            }
        }
        else {
            client.addEventListener("message", event => {
                console.log("message", event);
                debug(-3, "WS-MESSAGE %s", util_1.inspect(event));
                clientsList[pathname].forEach(e => {
                    if (e !== client)
                        e.send(event.data);
                });
            });
            client.addEventListener("error", event => {
                debug(-2, "WS-ERROR %s %s", pathname, event.type);
                let index = clientsList[pathname].indexOf(client);
                if (index > -1)
                    clientsList[pathname].splice(index, 1);
                client.close();
            });
            client.addEventListener("close", event => {
                debug(-2, "WS-CLOSE %s %s %s", pathname, event.code, event.reason);
                let index = clientsList[pathname].indexOf(client);
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
    return typeof obj.length === "number";
}
function handleDataFolderRequest(result, state) {
    const target = state.settings.__targetTW;
    const { mount, folder } = loadDataFolderTrigger(result, state.statPath, state.url.pathname, state.url.query.reload || "", target, state.settings.datafolder);
    const isFullpath = result.filepathPortion.length === state.statPath.index;
    //set the trailing slash correctly if this is the actual page load
    //redirect ?reload requests to the same, to prevent it being
    //reloaded multiple times for the same page load.
    if ((isFullpath &&
        state.pathOptions.noTrailingSlash !==
            !state.url.pathname.endsWith("/")) ||
        state.url.query.reload) {
        let redirect = mount + (!state.pathOptions.noTrailingSlash ? "/" : "");
        state
            .respond(302, "", {
            Location: redirect
        })
            .empty();
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
    let filepathPrefix = result.filepathPortion
        .slice(0, statPath.index)
        .join("/");
    //get the tree path, and add the file path (none if the tree path is a datafolder)
    let fullPrefix = ["", result.treepathPortion.join("/")];
    if (statPath.index > 0)
        fullPrefix.push(filepathPrefix);
    //join the parts and split into an array
    fullPrefix = fullPrefix.join("/").split("/");
    //use the unaltered path in the url as the tiddlywiki prefix
    let mount = pathname
        .split("/")
        .slice(0, fullPrefix.length)
        .join("/");
    //get the full path to the folder as specified in the tree
    let folder = statPath.statpath;
    // reload the plugin cache if requested
    // if (reload === "plugins") initPluginLoader();
    //initialize the tiddlywiki instance
    if (!loadedFolders[mount] || reload === "true") {
        loadedFolders[mount] = {
            mount,
            folder,
            events: new events_1.EventEmitter(),
            handler: []
        };
        loadDataFolderType(mount, folder, reload, target, vars);
        // loadTiddlyServerAdapter(prefixURI, folder, state.url.query.reload);
        // loadTiddlyWiki(prefixURI, folder);
    }
    return { mount, folder };
}
function loadDataFolderType(mount, folder, reload, target, vars) {
    util_1.promisify(fs.readFile)(path.join(folder, "tiddlywiki.info"), "utf8").then(data => {
        const wikiInfo = server_types_1.tryParseJSON(data, e => {
            throw e;
        });
        if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
            loadDataFolderTiddlyWiki(mount, folder, reload, target, vars);
        }
        else if (wikiInfo.type === "tiddlyserver") {
            // loadTiddlyServerAdapter(mount, folder, reload)
        }
    });
}
function loadDataFolderTiddlyWiki(mount, folder, reload, target, vars) {
    console.time("twboot-" + folder);
    let _wiki = undefined;
    const tw = $tw.TiddlyWiki();
    tw.boot.argv = [folder];
    tw.preloadTiddler({
        text: "$protocol$//$host$" + mount + "/",
        title: "$:/config/tiddlyweb/host"
    });
    try {
        tw.boot.boot(() => {
            complete(null, tw);
        });
    }
    catch (err) {
        complete(err, null);
    }
    function complete(err, $tw) {
        console.timeEnd("twboot-" + folder);
        if (err) {
            return console.log(mount, folder, err);
        }
        //we use $tw.modules.execute so that the module has its respective $tw variable.
        let Server;
        try {
            Server = $tw.modules.execute("$:/core/modules/server/server.js").Server;
        }
        catch (e) {
            console.log(mount, folder, e);
            return;
        }
        let server = new Server({
            wiki: $tw.wiki,
            variables: Object.assign({ "path-prefix": mount, "root-tiddler": "$:/core/save/all", gzip: "yes" }, vars)
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
        $tw.hooks.invokeHook("th-server-command-post-start", server, loadedFolders[mount].events, "tiddlyserver");
        //add the event emitter to the $tw variable
        $tw.wss = loadedFolders[mount].events;
        //set the request handler, indicating we are now ready to recieve requests
        const requests = loadedFolders[mount].handler;
        loadedFolders[mount].handler = (state) => {
            //pretend to the handler like the path really has a trailing slash
            let req = new Object(state.req);
            req.url +=
                state.url.pathname === mount && !state.url.pathname.endsWith("/")
                    ? "/"
                    : "";
            req.tsstate = Symbol("state object pointer");
            queue[req.tsstate] = state;
            server.requestHandler(req, state.res);
        };
        //send queued websocket clients to the event emitter
        loadedFolders[mount].events.emit("ws-client-preload");
        //send the queued requests to the handler
        requests.forEach(e => loadedFolders[mount].handler(e));
    }
}
function doError(debug, mount, folder, err) {
    debug(3, "error starting %s at %s: %s", mount, folder, err.stack);
    const requests = loadedFolders[mount].handler;
    loadedFolders[mount] = {
        handler: function (state) {
            state
                .respond(500, "TW5 data folder failed")
                .string("The Tiddlywiki data folder failed to load. The error has been logged to the " +
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWZvbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9kYXRhZm9sZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaURBU3dCO0FBQ3hCLCtDQUErQztBQUUvQyw2QkFBNkI7QUFFN0IseUJBQXlCO0FBRXpCLG1DQUFzQztBQUN0Qyw2QkFBNEI7QUFDNUIsK0JBQTBDO0FBUTFDLE1BQU0sYUFBYSxHQUF3QixFQUFFLENBQUM7QUFDOUMsTUFBTSxnQkFBZ0IsR0FBeUIsRUFBRSxDQUFDO0FBQ2xELE1BQU0sV0FBVyxHQUF5QixFQUFFLENBQUM7QUFDN0MsSUFBSSxPQUEyQixDQUFDO0FBRWhDLFNBQWdCLElBQUksQ0FBQyxDQUFxQjtJQUN4QyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBQ1osT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBUyxHQUFpQixJQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELE9BQU8sQ0FBQyxFQUFFLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEVBQUUsR0FBRSxDQUFDLENBQUMsQ0FBQztJQUMxQyxPQUFPLENBQUMsRUFBRSxDQUFDLHNCQUFzQixFQUFFLEtBQUssV0FBVSxJQUFvQjtRQUNwRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQztRQUN2RSxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDcEQsUUFBUTtZQUNSLFdBQVc7U0FDWixDQUFDLENBQUM7UUFDSCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUNqRCxJQUFJLFFBQVEsR0FBdUIsV0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFhLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxrQ0FBa0M7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