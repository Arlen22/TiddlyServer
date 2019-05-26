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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWZvbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGFmb2xkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxpREFHd0I7QUFDeEIsa0NBQWdEO0FBRWhELDZCQUE2QjtBQUU3Qix5QkFBeUI7QUFHekIsMENBQTBDO0FBQzFDLG1DQUFzQztBQUN0Qyw2QkFBNEI7QUFDNUIsK0JBQStCO0FBSS9CLGlEQUFnRjtBQUNoRixvREFBa0U7QUFFbEUsSUFBSSxRQUFRLEdBQWlCLEVBQVMsQ0FBQztBQUV2QyxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRWpDLE1BQU0sYUFBYSxHQUFnQyxFQUFFLENBQUM7QUFDdEQsTUFBTSxnQkFBZ0IsR0FBaUMsRUFBRSxDQUFDO0FBQzFELE1BQU0sV0FBVyxHQUFpQyxFQUFFLENBQUM7QUFDckQsSUFBSSxPQUEyQixDQUFDO0FBRWhDLGNBQXFCLENBQXFCO0lBQ3pDLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDWixPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQ2pELFFBQVEsR0FBRyxHQUFHLENBQUM7SUFDaEIsQ0FBQyxDQUFDLENBQUE7SUFDRixPQUFPLENBQUMsRUFBRSxDQUFDLGlCQUFpQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDdEMsdUNBQXVDO1FBQ3ZDLHVGQUF1RjtRQUN2RixzR0FBc0c7UUFDdEcsU0FBUztRQUNULElBQUk7SUFDTCxDQUFDLENBQUMsQ0FBQTtJQUNGLE9BQU8sQ0FBQyxFQUFFLENBQUMsc0JBQXNCLEVBQUUsVUFBVSxNQUFpQixFQUFFLE9BQTZCO1FBQzVGLElBQUksUUFBUSxHQUFHLFdBQUssQ0FBQyxPQUFPLENBQUMsR0FBYSxDQUFDLENBQUMsUUFBa0IsQ0FBQyxDQUFBLGtDQUFrQztRQUVqRyxJQUFJLE1BQU0sR0FBRywwQkFBVyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FB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