"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const path = require("path");
const fs = require("fs");
//import { TiddlyWiki } from 'tiddlywiki';
const events_1 = require("events");
const url_1 = require("url");
const util_1 = require("util");
const bundled_lib_1 = require("../lib/bundled-lib");
// var settings: ServerConfig = {} as any;
// const debug = DebugLogger('DAT');
const loadedFolders = {};
const otherSocketPaths = {};
const clientsList = {};
let eventer;
function init(e) {
    eventer = e;
    eventer.on('settings', function (set) {
        // settings = set;
    });
    eventer.on('settingsChanged', (keys) => {
        // if (keys.indexOf("username") > -1) {
        //     debug(1, "The username will not be updated on currently loaded data folders. " +
        //         "To apply the new username you will need to reload the data folders or restart the server."
        //     );
        // }
    });
    eventer.on('websocket-connection', function (data) {
        const { request, client, settings, treeHostIndex, debugOutput } = data;
        const debug = server_types_1.StateObject.DebugLogger("WEBSOCK").bind({ settings, debugOutput });
        const root = settings.tree[treeHostIndex].$mount;
        let pathname = url_1.parse(request.url).pathname; // new URL(request.url as string);
        var result = server_types_1.resolvePath(pathname.split('/'), root);
        if (!result)
            return client.close(404);
        server_types_1.statWalkPath(result).then(statPath => {
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
let pluginCache;
let coreCache;
let bootCache;
let pluginLoader;
let global_tw;
function initPluginLoader() {
    pluginCache = {};
    throw "plugin cache not implemented";
    const $tw = global_tw; // = TiddlyWiki.loadCore();
    const pluginConfig = {
        plugin: [$tw.config.pluginsPath, $tw.config.pluginsEnvVar],
        theme: [$tw.config.themesPath, $tw.config.themesEnvVar],
        language: [$tw.config.languagesPath, $tw.config.languagesEnvVar]
    };
    Object.keys(pluginConfig).forEach(type => {
        pluginCache[type] = {};
    });
    let core = $tw.loadPluginFolder($tw.boot.corePath);
    coreCache = {
        text: core.text,
        meta: core,
        cacheTime: new Date().valueOf()
    };
    delete core.text;
    // bootCache = {};
    // $tw.loadTiddlersFromPath($tw.boot.bootPath).forEach(tiddlerFile => {
    //     tiddlerFile.tiddlers.forEach(tiddlerFields => {
    //         bootCache[tiddlerFields.title] = tiddlerFields;
    //     })
    // });
    // $tw.loadTiddlersFromPath($tw.boot.bootPath) as { tiddlers: any[] }[];
    pluginLoader = function getPlugin(type, name) {
        if (!pluginCache[type][name]) {
            const typeInfo = pluginConfig[type];
            var paths = $tw.getLibraryItemSearchPaths(typeInfo[0], typeInfo[1]);
            let pluginPath = $tw.findLibraryItem(name, paths);
            let plugin = $tw.loadPluginFolder(pluginPath);
            if (!plugin)
                pluginCache[type][name] = "null";
            else {
                let text = plugin.text, meta = plugin;
                delete plugin.text;
                pluginCache[type][name] = { meta, text, cacheTime: new Date().valueOf() };
            }
        }
        return pluginCache[type][name];
    };
    // return function (wikiInfo: WikiInfo) {
    //     return ['plugins', 'themes', 'languages'].map(type => {
    //         var pluginList = wikiInfo[type];
    //         if (!Array.isArray(pluginList)) return [] as never;
    //         else return pluginList.map(name => getPlugin(type, name));
    //     }).reduce((n, e) => n.concat(e), [] as PluginCache[]);
    // }
}
// initPluginLoader();
// mounted at /assets/tiddlywiki
function handleTiddlyWikiRoute(state) {
    state.throw(500);
    throw "tiddlywiki route not implemented";
    //number of elements on state.path that are part of the mount path.
    //the zero-based index of the first subpath is the same as the number of elements
    let mountLength = 3;
    console.log(state.path);
    if (['plugin', 'theme', 'language', 'core', 'boot'].indexOf(state.path[mountLength]) === -1) {
        console.log('throw', state.responseSent);
        state.throw(404);
    }
    else if (state.path[mountLength] === "core") {
        sendPluginResponse(state, coreCache);
    }
    else if (state.path[mountLength] === "boot") {
        server_types_1.serveFolder(state, '/assets/tiddlywiki/boot', path.join(__dirname, "../tiddlywiki/boot"), server_types_1.serveFolderIndex({ type: 'json' }));
    }
    else if (!state.path[mountLength]) {
        const folder = path.join(__dirname, "../tiddlywiki");
        const folderPaths = [];
        const processFolder = async (dirpath) => {
            let files = await util_1.promisify(fs.readdir)(dirpath);
            await Promise.all(files.map(subpath => util_1.promisify(fs.stat)(path.join(dirpath, subpath)).then(stat => {
                folderPaths.push(subpath.slice(folder.length));
                return stat.isDirectory() ? processFolder(subpath) : Promise.resolve();
            })));
            // return obs_readdir()(dirpath).mergeMap(([err, files, tag, dirpath]) => {
            // 	return Observable.from(files).mergeMap(file => obs_stat()(path.join(dirpath, file)))
            // }).mergeMap(([err, stat, tag, subpath]) => {
            // 	folderPaths.push(subpath.slice(folder.length));
            // 	return stat.isDirectory() ? processFolder(subpath) : Observable.empty<never>();
            // });
        };
        processFolder(folder).then(() => {
            state.respond(200).json(folderPaths);
        });
    }
    else {
        sendPluginResponse(state, pluginLoader(state.path[mountLength], decodeURIComponent(state.path[mountLength + 1])));
    }
}
exports.handleTiddlyWikiRoute = handleTiddlyWikiRoute;
function sendPluginResponse(state, pluginCache) {
    // const { req, res } = state;
    if (pluginCache === "null") {
        state.respond(404).empty();
        return;
    }
    // console.log('pluginCache', pluginCache.plugin.text && pluginCache.plugin.text.length);
    // let text = pluginCache.plugin.text;
    // delete pluginCache.plugin.text;
    let meta = JSON.stringify(pluginCache.meta), text = pluginCache.text;
    // Just an experiment
    // let tiddlersArray = (() => {
    //     let gkeys: string[] = [];
    //     let { tiddlers } = JSON.parse(text1);
    //     let keys = Object.keys(tiddlers);
    //     let tiddlersArray = keys.map(k => {
    //         let tkeys = Object.keys(tiddlers[k]);
    //         let vals = {};
    //         tkeys.forEach(tk => {
    //             let index = gkeys.indexOf(tk);
    //             if (index === -1) {
    //                 vals[gkeys.length] = tiddlers[k][tk];
    //                 gkeys.push(tk);
    //             } else {
    //                 vals[index] = tiddlers[k][tk];
    //             }
    //         });
    //         return vals;
    //     });
    //     return { keys: gkeys, vals: tiddlersArray };
    // })();
    const body = meta + '\n\n' + text;
    var MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000; //1 year
    var maxageSetting = state.settings.EXPERIMENTAL_clientside_datafolders.maxAge_tw_plugins;
    var maxAge = Math.min(Math.max(0, maxageSetting), MAX_MAXAGE);
    var cacheControl = 'public, max-age=' + Math.floor(maxageSetting / 1000);
    server_types_1.StateObject.DebugLogger("").call(state, -3, 'cache-control %s', cacheControl);
    state.setHeader('Cache-Control', cacheControl);
    var modified = new Date(pluginCache.cacheTime).toUTCString();
    server_types_1.StateObject.DebugLogger("").call(state, -3, 'modified %s', modified);
    state.setHeader('Last-Modified', modified);
    var etagStr = bundled_lib_1.etag(body);
    server_types_1.StateObject.DebugLogger("").call(state, -3, 'etag %s', etagStr);
    state.setHeader('ETag', etagStr);
    if (bundled_lib_1.fresh(state.req.headers, { 'etag': etagStr, 'last-modified': modified })) {
        server_types_1.StateObject.DebugLogger("").call(state, -1, "client plugin still fresh");
        state.respond(304).empty();
    }
    else {
        server_types_1.StateObject.DebugLogger("").call(state, -1, "sending plugin");
        server_types_1.sendResponse(state, body, { doGzip: server_types_1.canAcceptGzip(state.req) });
    }
}
// function loadTiddlyServerAdapter(mount: string, folder: string, reload: string, wikiInfo: WikiInfo) {
//     let cacheRequests: StateObject[] = [];
//     let cachePrepared = (settings.tsa.alwaysRefreshCache || reload === "tsacache")
//         ? false : fs.existsSync(path.join(folder, 'cache'));
//     if (!wikiInfo) return doError(mount, folder, new Error("WikiInfo not loaded"));
//     const { $tw } = TiddlyWiki.loadWiki(folder);
//     const files = $tw.boot.files;
//     /* 
//     * tiddlyserver datafolder type is a subset of tiddlywiki datafolder type
//     * - no local plugin/theme/language folders
//     * - no server-side plugins (obviously)
//     * - no builds
//     * - no config (none is needed)
//     * - includeWikis must be tiddlyserver type, or are read only
//     * - tiddlers are all stored in the same directory
//     * - cache is sent with the tiddler PUT request, and is either the text of the tiddler, 
//     *   or is sent separately, according to a marker
//     */
//     // the second line in the PUT request contains: content encoding, cache marker (cache-[name]) specifying the cache area to use
//     initTiddlyServerAdapterCache(mount, folder).then(() => {
//         cachePrepared = true;
//         cacheRequests.forEach((state) => sendCacheFolder.next(state));
//         cacheRequests = [];
//     });
//     const sendCacheFolder = new Subject<StateObject>();
//     serveFolderObs(sendCacheFolder.asObservable(), mount + "/cache", folder + "/cache");
//     function handler(state: StateObject) {
//         const { req, res } = state;
//         const tsa = new TSASO(state, wikiInfo, folder, mount, files);
//         // GET the mount, which has no trailing slash
//         if (!tsa.localPath.length) {
//             if (req.method === "GET") sendLoader(tsa);
//             else { res.writeHead(405); res.end(); }
//         } else if (tsa.localPathParts[1] === "startup.json") {
//             // GET /startup.json - load all tiddlers for the wiki and send them
//             if (req.method === "GET") sendAllTiddlers(tsa);
//             else { res.writeHead(405); res.end(); }
//         } else if (tsa.localPathParts[1] === "tiddlers.json") {
//             // GET /tiddlers.json - get the skinny list of tiddlers in the files hashmap
//             if (req.method === "GET") sendSkinnyTiddlers(tsa);
//             else { res.writeHead(405); res.end(); }
//         } else if (tsa.localPathParts[1] === "tiddlers") {
//             // ALL /tiddlers/* - load and save the files tiddlers
//             handleTiddlersRoute(tsa);
//         } else if (tsa.localPathParts[1] === "cache") {
//             // ALL /cache/*
//             if (['GET', 'HEAD'].indexOf(req.method as string) > -1) {
//                 if (!cachePrepared) cacheRequests.push(state);
//                 else sendCacheFolder.next(state);
//             } else if (['PUT', 'DELETE'].indexOf(req.method as string) > -1) {
//                 handleCacheRoute(tsa);
//             } else if (req.method === "OPTIONS") {
//                 state.res.writeHead(200);
//                 state.res.write("GET,HEAD,PUT,DELETE,OPTIONS");
//                 state.res.end();
//             } else {
//                 res.writeHead(405); res.end();
//             }
//         }
//         // Status 404
//         else { res.writeHead(404); res.end(); }
//     }
//     const requests = loadedFolders[mount] as StateObject[];
//     loadedFolders[mount] = { handler, folder, mount, sockets: [] };
//     requests.forEach((state) => handler(state));
// }
// function initTiddlyServerAdapterCache(mount: string, folder: string) {
//     return new Promise(resolve => DataFolder(mount, folder, (err, $tw) => {
//         //render the different caches here and save them to disk
//     }));
// }
// class TSASO {
//     public localPath: string;
//     public localPathParts: string[];
//     constructor(
//         public state: StateObject,
//         public wikiInfo: WikiInfo,
//         public folder: string,
//         public mount: string,
//         /** Hashmap keyed to tiddler title */
//         public files: { [K: string]: TiddlerInfo }
//     ) {
//         this.localPath = state.url.pathname.slice(mount.length);
//         this.localPathParts = this.localPath.split('/');
//     }
// }
// const globalRegex = /\$\{mount\}/g;
// //just save it here so we don't have to keep reloading it
// const loaderText = fs.readFileSync(path.join(__dirname, './datafolder-template.html'), 'utf8');
// function sendLoader(tsa: TSASO) {
//     sendResponse(
//         tsa.state.res,
//         loaderText.replace(globalRegex, tsa.mount),
//         { doGzip: canAcceptGzip(tsa.state.req), contentType: "text/html; charset=utf-8" }
//     );
// }
// function sendAllTiddlers(tsa: TSASO) {
//     const { $tw, wikiInfo } = TiddlyWiki.loadWiki(tsa.folder);
//     const tiddlers: any[] = [];
//     /** @type {string[]} */
//     const skipFields = ["",/* "text" */];
//     $tw.wiki.each((tiddler, title) => {
//         let fields = {};
//         let keys = Object.keys(tiddler.fields).forEach(key => {
//             if (skipFields.indexOf(key) === -1)
//                 fields[key] = tiddler.fields[key];
//         })
//         tiddlers.push(fields);
//     });
//     let text = JSON.stringify(tiddlers);
//     var cacheControl = 'no-cache';
//     debug(-3, 'cache-control %s', cacheControl)
//     tsa.state.res.setHeader('Cache-Control', cacheControl)
//     var etag = etag(text);
//     debug(-3, 'etag %s', etag)
//     tsa.state.res.setHeader('ETag', etag)
//     if (fresh(tsa.state.req.headers, { 'etag': etag })) {
//         tsa.state.res.writeHead(304);
//         tsa.state.res.end();
//     } else {
//         sendResponse(tsa.state.res, text, {
//             doGzip: canAcceptGzip(tsa.state.req),
//             contentType: "application/json; charset=utf-8"
//         });
//     }
// }
// function sendSkinnyTiddlers(tsa: TSASO) {
// }
// const newLineBuffer = Buffer.from('\n');
// interface TiddlerInfo { filepath: string, type: string, hasMetaFile: boolean }
// function handleTiddlersRoute(tsa: TSASO) {
//     //GET HEAD PUT DELETE
//     let title = decodeURIComponent(tsa.localPathParts[2]);
//     if (tsa.state.req.method === "GET") {
//     }
//     return ((tsa.state.req.method === "PUT")
//         ? tsa.state.recieveBody(true).mapTo(tsa)
//         : Observable.of(tsa)
//     ).map(tsa => {
//     })
// }
// function loadTiddler(filepath: string) {
//     var ext = path.extname(filepath),
//         extensionInfo = global_tw.utils.getFileExtensionInfo(ext),
//         type = extensionInfo ? extensionInfo.type : null,
//         typeInfo = type ? global_tw.config.contentTypeInfo[type] : null,
//         encoding = typeInfo ? typeInfo.encoding : "utf8";
//     return obs_readFile()(filepath, encoding).concatMap(([err, data]) => {
//         var tiddlers = global_tw.wiki.deserializeTiddlers(ext, data, {});
//         if (ext !== ".json" && tiddlers.length === 1)
//             return obs_readFile(tiddlers)(filepath + ".meta", 'utf8');
//         else return Observable.of([undefined, undefined, tiddlers]);
//     }).map(([err, data, tiddlers]) => {
//         let metadata = data ? global_tw.utils.parseFields(data) : {};
//         tiddlers = (!err && data) ? [global_tw.utils.extend({}, tiddlers[0], metadata)] : tiddlers;
//         return { tiddlers, encoding };
//     })
// }
// function getSkinnyTiddlers(tsa) {
//     // let title = decodeURIComponent(tsa.localPathParts[2]);
//     // if (!tsa.files[title]) { tsa.state.throw(404); return; }
//     // var filepath = tsa.files[title].filepath;
//     const files = Object.keys(tsa.files).map(e => tsa.files[e].filepath);
//     Observable.from(files).mergeMap(loadTiddler).subscribe(({ tiddlers, encoding }) => {
//         if (tiddlers.length !== 1) {
//             tsa.state.throw(404);
//         } else {
//             let tiddler = tiddlers[0];
//             let { res } = tsa.state;
//             let text = Buffer.from(tiddler.text, encoding);
//             delete tiddler.text
//             //use utf16 so we can convert straight back to a string in the browser
//             let header = Buffer.from(JSON.stringify(tiddler), 'utf8');
//             let body = Buffer.concat([
//                 header, newLineBuffer, Buffer.from(encoding, 'binary'), newLineBuffer, text
//             ]);
//             sendResponse(res, body, {
//                 doGzip: canAcceptGzip(tsa.state.req),
//                 contentType: "application/octet-stream"
//             });
//         }
//     })
// }
// function handleCacheRoute(tsa: TSASO) {
//     //stores library and rawmarkup code sections as the full javascript to be returned
//     //the source tiddlers are sent separately to allow editing later. Only the javascript
//     //is stored in the cache. If we do not have a cache, we temporarily load the entire
//     //folder during the mount sequence to generate it. 
//     //PUT DELETE
// }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWZvbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGFmb2xkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxpREFBbVI7QUFLblIsNkJBQTZCO0FBRTdCLHlCQUF5QjtBQUd6QiwwQ0FBMEM7QUFDMUMsbUNBQXNDO0FBQ3RDLDZCQUE0QjtBQUM1QiwrQkFBMEM7QUFLMUMsb0RBQWtFO0FBRWxFLDBDQUEwQztBQUUxQyxvQ0FBb0M7QUFFcEMsTUFBTSxhQUFhLEdBQWdDLEVBQUUsQ0FBQztBQUN0RCxNQUFNLGdCQUFnQixHQUFpQyxFQUFFLENBQUM7QUFDMUQsTUFBTSxXQUFXLEdBQWlDLEVBQUUsQ0FBQztBQUNyRCxJQUFJLE9BQTJCLENBQUM7QUFFaEMsU0FBZ0IsSUFBSSxDQUFDLENBQXFCO0lBQ3hDLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDWixPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQ2hELGtCQUFrQjtJQUNwQixDQUFDLENBQUMsQ0FBQTtJQUNGLE9BQU8sQ0FBQyxFQUFFLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNyQyx1Q0FBdUM7UUFDdkMsdUZBQXVGO1FBQ3ZGLHNHQUFzRztRQUN0RyxTQUFTO1FBQ1QsSUFBSTtJQUNOLENBQUMsQ0FBQyxDQUFBO0lBQ0YsT0FBTyxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsRUFBRSxVQUFVLElBQW9CO1FBRS9ELE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3ZFLE1BQU0sS0FBSyxHQUFHLDBCQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQ2pGLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFB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