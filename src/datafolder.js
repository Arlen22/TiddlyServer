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
        if (keys.indexOf("username") > -1) {
            debug(1, "The username will not be updated on currently loaded data folders. " +
                "To apply the new username you will need to reload the data folders or restart the server.");
        }
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
    const { mount, folder } = loadDataFolderTrigger(result, state.statPath, state.url.pathname, state.url.query.reload);
    const isFullpath = result.filepathPortion.length === state.statPath.index;
    //set the trailing slash correctly if this is the actual page load
    //redirect ?reload=true requests to the same, to prevent it being 
    //reloaded multiple times for the same page load.
    if (isFullpath && (!settings.tiddlyserver.useTW5path !== !state.url.pathname.endsWith("/"))
        || state.url.query.reload) {
        let redirect = mount + (settings.tiddlyserver.useTW5path ? "/" : "");
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
        const wikiInfo = server_types_1.tryParseJSON(data);
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
    const $tw = require(target + "/boot/boot.js").TiddlyWiki(require(target + "/boot/bootprefix.js").bootprefix({
        packageInfo: JSON.parse(fs.readFileSync(path.join(__dirname, target + '/package.json'), 'utf8'))
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
        var server;
        try {
            server = $tw.modules.execute('$:/core/modules/server/server.js').Server;
        }
        catch (e) {
            doError(mount, folder, e);
            return;
        }
        var server = new server({
            wiki: $tw.wiki,
            variables: {
                "username": settings.username,
                "path-prefix": mount
            }
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWZvbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGFmb2xkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxpREFHd0I7QUFDeEIsa0NBQWdEO0FBRWhELDZCQUE2QjtBQUU3Qix5QkFBeUI7QUFFekIsMENBQTBDO0FBQzFDLG1DQUFzQztBQUN0Qyw2QkFBNEI7QUFDNUIsK0JBQStCO0FBSS9CLGlEQUFnRjtBQUNoRixvREFBaUQ7QUFFakQsSUFBSSxRQUFRLEdBQWlCLEVBQVMsQ0FBQztBQUV2QyxNQUFNLEtBQUssR0FBRywwQkFBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRWpDLE1BQU0sYUFBYSxHQUFnQyxFQUFFLENBQUM7QUFDdEQsTUFBTSxnQkFBZ0IsR0FBaUMsRUFBRSxDQUFDO0FBQzFELE1BQU0sV0FBVyxHQUFpQyxFQUFFLENBQUM7QUFDckQsSUFBSSxPQUEyQixDQUFDO0FBRWhDLGNBQXFCLENBQXFCO0lBQ3RDLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDWixPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQWlCO1FBQzlDLFFBQVEsR0FBRyxHQUFHLENBQUM7SUFDbkIsQ0FBQyxDQUFDLENBQUE7SUFDRixPQUFPLENBQUMsRUFBRSxDQUFDLGlCQUFpQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDbkMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO1lBQy9CLEtBQUssQ0FBQyxDQUFDLEVBQUUscUVBQXFFO2dCQUMxRSwyRkFBMkYsQ0FDOUYsQ0FBQztTQUNMO0lBQ0wsQ0FBQyxDQUFDLENBQUE7SUFDRixPQUFPLENBQUMsRUFBRSxDQUFDLHNCQUFzQixFQUFFLFVBQVUsTUFBaUIsRUFBRSxPQUE2QjtRQUN6RixJQUFJLFFBQVEsR0FBRyxXQUFLLENBQUMsT0FBTyxDQUFDLEdBQWEsQ0FBQyxDQUFDLFFBQWtCLENBQUMsQ0FB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