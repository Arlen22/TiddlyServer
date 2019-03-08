"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const rx_1 = require("../lib/rx");
const path = require("path");
const fs = require("fs");
//import { TiddlyWiki } from 'tiddlywiki';
const events_1 = require("events");
const url_1 = require("url");
const util_1 = require("util");
const boot_startup_1 = require("./boot-startup");
const bundled_lib_1 = require("../lib/bundled-lib");
var settings = {};
const debug = server_types_1.DebugLogger('DAT');
const loadedFolders = {};
const otherSocketPaths = {};
const clientsList = {};
let eventer;
function init(e) {
    eventer = e;
    eventer.on('settings', function (set) {
        settings = set;
    });
    eventer.on('settingsChanged', (keys) => {
        // if (keys.indexOf("username") > -1) {
        //     debug(1, "The username will not be updated on currently loaded data folders. " +
        //         "To apply the new username you will need to reload the data folders or restart the server."
        //     );
        // }
    });
    eventer.on('websocket-connection', function (client, request) {
        let pathname = url_1.parse(request.url).pathname; // new URL(request.url as string);
        var result = server_types_1.resolvePath(pathname.split('/'), settings.tree);
        if (!result)
            return client.close(404);
        server_types_1.statWalkPath(result).subscribe(statPath => {
            //if this is a datafolder, we hand the client and request off directly to it
            //otherwise we stick it in its own section
            if (statPath.itemtype === "datafolder") {
                //trigger the datafolder to load in case it isn't
                const { mount, folder } = loadDataFolderTrigger(result, statPath, pathname, '');
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
    const { mount, folder } = loadDataFolderTrigger(result, state.statPath, state.url.pathname, state.url.query.reload || "");
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
function loadDataFolderTrigger(result, statPath, pathname, reload) {
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
        loadDataFolderType(mount, folder, reload);
        // loadTiddlyServerAdapter(prefixURI, folder, state.url.query.reload);
        // loadTiddlyWiki(prefixURI, folder);
    }
    return { mount, folder };
}
function loadDataFolderType(mount, folder, reload) {
    server_types_1.obs_readFile()(path.join(folder, "tiddlywiki.info"), 'utf8').subscribe(([err, data]) => {
        const wikiInfo = server_types_1.tryParseJSON(data, e => { throw e; });
        if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
            loadDataFolderTiddlyWiki(mount, folder, reload);
        }
        else if (wikiInfo.type === "tiddlyserver") {
            // loadTiddlyServerAdapter(mount, folder, reload)
        }
    });
}
function loadDataFolderTiddlyWiki(mount, folder, reload) {
    console.time('twboot-' + folder);
    const target = "../tiddlywiki";
    let _wiki = undefined;
    const $tw = require(target + "/boot/boot.js").TiddlyWiki(require(target + "/boot/bootprefix.js").bootprefix({
        packageInfo: JSON.parse(fs.readFileSync(path.join(__dirname, target + '/package.json'), 'utf8')),
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
            return doError(mount, folder, err);
        }
        //we use $tw.modules.execute so that the module has its respective $tw variable.
        var Server;
        try {
            Server = $tw.modules.execute('$:/core/modules/server/server.js').Server;
        }
        catch (e) {
            doError(mount, folder, e);
            return;
        }
        var server = new Server({
            wiki: $tw.wiki,
            variables: {
                "path-prefix": mount,
                "root-tiddler": "$:/core/save/all-external-js"
            }
        });
        // server.TS_StateObject_Queue = [];
        // server.TS_Request_Queue = [];
        let auth = new TiddlyServerAuthentication(server);
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
            req.tsstate = state;
            // let index = server.TS_Request_Queue.findIndex(undefined as any);
            // //we reuse array indices to presumably save CPU cycles and memory
            // if(index !== -1){
            // 	server.TS_Request_Queue[index] = req;
            // 	server.TS_StateObject_Queue[index] = state;
            // } else {
            // 	server.TS_Request_Queue.push(req);
            // 	server.TS_StateObject_Queue.push(state);
            // }
            server.requestHandler(state.req, state.res);
        };
        //send queued websocket clients to the event emitter
        loadedFolders[mount].events.emit('ws-client-preload');
        //send the queued requests to the handler
        requests.forEach(e => loadedFolders[mount].handler(e));
    }
}
;
function doError(mount, folder, err) {
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
    constructor(server) {
        this.server = server;
    }
    /**
     * Returns true if the authenticator is active, false if it is inactive,
     * or a string if there is an error
     */
    init() {
        return true;
    }
    /**
     * Returns true if the request is authenticated and
     * assigns the "authenticatedUsername" state variable.
     *
     * Returns false if the request couldn't be authenticated,
     * having sent an appropriate response to the browser
     */
    authenticateRequest(request, response, state) {
        // let index = this.server.TS_Request_Queue.indexOf(request);
        let tsstate = request.tsstate;
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
    }
}
let pluginCache;
let coreCache;
let bootCache;
let pluginLoader;
let global_tw;
function initPluginLoader() {
    pluginCache = {};
    const $tw = global_tw = boot_startup_1.TiddlyWiki.loadCore();
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
initPluginLoader();
// mounted at /tiddlywiki
const serveBootFolder = new rx_1.Subject();
server_types_1.serveFolderObs(serveBootFolder.asObservable(), '/assets/tiddlywiki/boot', path.join(__dirname, "../tiddlywiki/boot"), server_types_1.serveFolderIndex({ type: 'json' }));
function handleTiddlyWikiRoute(state) {
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
        serveBootFolder.next(state);
    }
    else if (!state.path[mountLength]) {
        const folder = path.join(__dirname, "../tiddlywiki");
        const folderPaths = [];
        const processFolder = (dirpath) => {
            return server_types_1.obs_readdir()(dirpath).mergeMap(([err, files, tag, dirpath]) => {
                return rx_1.Observable.from(files).mergeMap(file => server_types_1.obs_stat()(path.join(dirpath, file)));
            }).mergeMap(([err, stat, tag, subpath]) => {
                folderPaths.push(subpath.slice(folder.length));
                return stat.isDirectory() ? processFolder(subpath) : rx_1.Observable.empty();
            });
        };
        processFolder(folder).subscribe({
            complete: () => {
                state.respond(200).json(folderPaths);
            }
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
    var maxageSetting = settings.EXPERIMENTAL_clientside_datafolders.maxAge_tw_plugins;
    var maxAge = Math.min(Math.max(0, maxageSetting), MAX_MAXAGE);
    var cacheControl = 'public, max-age=' + Math.floor(maxageSetting / 1000);
    debug(-3, 'cache-control %s', cacheControl);
    state.setHeader('Cache-Control', cacheControl);
    var modified = new Date(pluginCache.cacheTime).toUTCString();
    debug(-3, 'modified %s', modified);
    state.setHeader('Last-Modified', modified);
    var etagStr = bundled_lib_1.etag(body);
    debug(-3, 'etag %s', etagStr);
    state.setHeader('ETag', etagStr);
    if (bundled_lib_1.fresh(state.req.headers, { 'etag': etagStr, 'last-modified': modified })) {
        debug(-1, "client plugin still fresh");
        state.respond(304).empty();
    }
    else {
        debug(-1, "sending plugin");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWZvbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGFmb2xkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxpREFHd0I7QUFDeEIsa0NBQWdEO0FBRWhELDZCQUE2QjtBQUU3Qix5QkFBeUI7QUFFekIsMENBQTBDO0FBQzFDLG1DQUFzQztBQUN0Qyw2QkFBNEI7QUFDNUIsK0JBQStCO0FBSS9CLGlEQUFnRjtBQUNoRixvREFBa0U7QUFFbEUsSUFBSSxRQUFRLEdBQWlCLEVBQVMsQ0FBQztBQUV2QyxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRWpDLE1BQU0sYUFBYSxHQUFnQyxFQUFFLENBQUM7QUFDdEQsTUFBTSxnQkFBZ0IsR0FBaUMsRUFBRSxDQUFDO0FBQzFELE1BQU0sV0FBVyxHQUFpQyxFQUFFLENBQUM7QUFDckQsSUFBSSxPQUEyQixDQUFDO0FBRWhDLGNBQXFCLENBQXFCO0lBQ3pDLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDWixPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQ2pELFFBQVEsR0FBRyxHQUFHLENBQUM7SUFDaEIsQ0FBQyxDQUFDLENBQUE7SUFDRixPQUFPLENBQUMsRUFBRSxDQUFDLGlCQUFpQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDdEMsdUNBQXVDO1FBQ3ZDLHVGQUF1RjtRQUN2RixzR0FBc0c7UUFDdEcsU0FBUztRQUNULElBQUk7SUFDTCxDQUFDLENBQUMsQ0FBQTtJQUNGLE9BQU8sQ0FBQyxFQUFFLENBQUMsc0JBQXNCLEVBQUUsVUFBVSxNQUFpQixFQUFFLE9BQTZCO1FBQzVGLElBQUksUUFBUSxHQUFHLFdBQUssQ0FBQyxPQUFPLENBQUMsR0FBYSxDQUFDLENBQUMsUUFBa0IsQ0FBQyxDQUFBLGtDQUFrQztRQUVqRyxJQUFJLE1BQU0sR0FBRywwQkFBVyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FB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