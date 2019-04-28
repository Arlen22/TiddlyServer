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
    //The bundle in the Tiddlyserver folder
    // const target = "../tiddlywiki";
    //The source code the 5.1.19 bundle was compiled from
    // const target = "..\\..\\TiddlyWiki5-compiled\\Source\\TiddlyWiki5-5.1.19";
    //Jermolene/TiddlyWiki5@master
    // const target = "..\\..\\_reference\\TiddlyWiki5-Arlen22";
    const target = settings._datafoldertarget
        ? path.resolve(settings.__dirname, settings._datafoldertarget)
        : "../tiddlywiki";
    let _wiki = undefined;
    const $tw = require(target + "/boot/boot.js").TiddlyWiki(require(target + "/boot/bootprefix.js").bootprefix({
        packageInfo: JSON.parse(fs.readFileSync(path.resolve(__dirname, target + '/package.json'), 'utf8')),
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
                "root-tiddler": "$:/core/save/all"
                // "root-tiddler": "$:/core/save/all-external-js"
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWZvbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGFmb2xkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxpREFHd0I7QUFDeEIsa0NBQWdEO0FBRWhELDZCQUE2QjtBQUU3Qix5QkFBeUI7QUFHekIsMENBQTBDO0FBQzFDLG1DQUFzQztBQUN0Qyw2QkFBNEI7QUFDNUIsK0JBQStCO0FBSS9CLGlEQUFnRjtBQUNoRixvREFBa0U7QUFFbEUsSUFBSSxRQUFRLEdBQWlCLEVBQVMsQ0FBQztBQUV2QyxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRWpDLE1BQU0sYUFBYSxHQUFnQyxFQUFFLENBQUM7QUFDdEQsTUFBTSxnQkFBZ0IsR0FBaUMsRUFBRSxDQUFDO0FBQzFELE1BQU0sV0FBVyxHQUFpQyxFQUFFLENBQUM7QUFDckQsSUFBSSxPQUEyQixDQUFDO0FBRWhDLFNBQWdCLElBQUksQ0FBQyxDQUFxQjtJQUN6QyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBQ1osT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxHQUFpQjtRQUNqRCxRQUFRLEdBQUcsR0FBRyxDQUFDO0lBQ2hCLENBQUMsQ0FBQyxDQUFBO0lBQ0YsT0FBTyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO1FBQ3RDLHVDQUF1QztRQUN2Qyx1RkFBdUY7UUFDdkYsc0dBQXNHO1FBQ3RHLFNBQVM7UUFDVCxJQUFJO0lBQ0wsQ0FBQyxDQUFDLENBQUE7SUFDRixPQUFPLENBQUMsRUFBRSxDQUFDLHNCQUFzQixFQUFFLFVBQVUsTUFBaUIsRUFBRSxPQUE2QjtRQUM1RixJQUFJLFFBQVEsR0FBRyxXQUFLLENBQUMsT0FBTyxDQUFDLEdBQWEsQ0FBQyxDQUFDLFFBQWtCLENBQUMsQ0FBQSxrQ0FBa0M7UUFFakcsSUFBSSxNQUFNLEdBQUcsMEJBQVcsQ0FBQyxRQUFRLENBQUMsS0FB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