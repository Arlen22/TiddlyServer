"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const rx_1 = require("../lib/rx");
const path = require("path");
const fs = require("fs");
//import { TiddlyWiki } from 'tiddlywiki';
const events_1 = require("events");
const url_1 = require("url");
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
                //event to give the client to the data folder
                const loadClient = () => loadedFolders[mount].events.emit('ws-client-connect', client, request);
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
                    clientsList[pathname].forEach(e => {
                        if (e !== client)
                            e.send(event.data);
                    });
                });
                client.addEventListener('error', (event) => {
                    debug(-2, 'WS-ERROR %s %s', pathname, event.type);
                    clientsList[pathname].splice(clientsList[pathname].indexOf(client), 1);
                    client.close();
                });
                client.addEventListener('close', (event) => {
                    debug(-2, 'WS-CLOSE %s %s %s', pathname, event.code, event.reason);
                    clientsList[pathname].splice(clientsList[pathname].indexOf(client), 1);
                });
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
    if (isFullpath && (!settings.useTW5path !== !state.url.pathname.endsWith("/"))
        || state.url.query.reload) {
        let redirect = mount + (settings.useTW5path ? "/" : "");
        state.res.writeHead(302, {
            'Location': redirect
        });
        state.res.end();
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
    if (reload === "plugins")
        initPluginLoader();
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
    // const dynreq = "tiddlywiki";
    const $tw = require("../tiddlywiki/boot/boot.js").TiddlyWiki(require("../tiddlywiki/boot/bootprefix.js").bootprefix({
        packageInfo: JSON.parse(fs.readFileSync(path.join(__dirname, '../tiddlywiki/package.json'), 'utf8'))
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
        var serverCommand;
        try {
            serverCommand = $tw.modules.execute('$:/core/modules/commands/server.js').Command;
        }
        catch (e) {
            doError(mount, folder, e);
            return;
        }
        var command = new serverCommand([], { wiki: $tw.wiki });
        var server = command.server;
        //If the username is changed the datafolder will just have to be reloaded
        server.set({
            rootTiddler: "$:/core/save/all",
            renderType: "text/plain",
            serveType: "text/html",
            username: settings.username,
            password: "",
            pathprefix: mount
        });
        //websocket requests coming in here will need to be handled 
        //with $tw.hooks.invokeHook('th-websocket-message', event);
        const requests = loadedFolders[mount].handler;
        loadedFolders[mount].handler = (state) => {
            //pretend to the handler like the path really has a trailing slash
            let req = new Object(state.req);
            req.url += ((state.url.pathname === mount && !state.url.pathname.endsWith("/")) ? "/" : "");
            server.requestHandler(state.req, state.res);
        };
        //invoke the server start hook so plugins can extend the server or attach to the event handler
        $tw.hooks.invokeHook('th-server-command-post-start', server, loadedFolders[mount].events, "tiddlyserver");
        //tell the socket handler to send any clients that have already connected
        loadedFolders[mount].events.emit('ws-client-preload');
        //send the requests to the handler
        requests.forEach(e => loadedFolders[mount].handler(e));
    }
}
;
function doError(mount, folder, err) {
    debug(3, 'error starting %s at %s: %s', mount, folder, err.stack);
    const requests = loadedFolders[mount].handler;
    loadedFolders[mount] = {
        handler: function (state) {
            state.res.writeHead(500, "TW5 data folder failed");
            state.res.write("The Tiddlywiki data folder failed to load. The error has been logged to the " +
                "terminal with priority level 2. " +
                "To try again, use ?reload=true after making any necessary corrections.");
            state.res.end();
        }
    };
    requests.forEach(([req, res]) => {
        loadedFolders[mount].handler(req, res);
    });
}
let counter = 0;
let pluginCache;
let coreCache;
let bootCache;
let pluginLoader;
let global_tw;
function initPluginLoader() {
    pluginCache = {};
    const $tw = global_tw = boot_startup_1.TiddlyWiki.loadCore();
    const pluginConfig = {
        plugins: [$tw.config.pluginsPath, $tw.config.pluginsEnvVar],
        themes: [$tw.config.themesPath, $tw.config.themesEnvVar],
        languages: [$tw.config.languagesPath, $tw.config.languagesEnvVar]
    };
    Object.keys(pluginConfig).forEach(type => {
        pluginCache[type] = {};
    });
    coreCache = {
        plugin: $tw.loadPluginFolder($tw.boot.corePath),
        cacheTime: new Date().valueOf()
    };
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
            else
                pluginCache[type][name] = { plugin, cacheTime: new Date().valueOf() };
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
    if (['plugins', 'themes', 'languages', 'core', 'boot'].indexOf(state.path[mountLength]) === -1) {
        state.throw(404);
    }
    else if (state.path[mountLength] === "core") {
        sendPluginResponse(state, coreCache);
    }
    else if (state.path[mountLength] === "boot") {
        serveBootFolder.next(state);
    }
    else {
        sendPluginResponse(state, pluginLoader(state.path[mountLength], decodeURIComponent(state.path[mountLength + 1])));
    }
}
exports.handleTiddlyWikiRoute = handleTiddlyWikiRoute;
function sendPluginResponse(state, pluginCache) {
    const { req, res } = state;
    if (pluginCache === "null") {
        res.writeHead(404);
        res.end();
        return;
    }
    let text = pluginCache.plugin.text;
    delete pluginCache.plugin.text;
    let meta = JSON.stringify(pluginCache.plugin);
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
    var maxAge = Math.min(Math.max(0, settings.maxAge.tw_plugins), MAX_MAXAGE);
    var cacheControl = 'public, max-age=' + Math.floor(settings.maxAge.tw_plugins / 1000);
    debug(-3, 'cache-control %s', cacheControl);
    res.setHeader('Cache-Control', cacheControl);
    var modified = new Date(pluginCache.cacheTime).toUTCString();
    debug(-3, 'modified %s', modified);
    res.setHeader('Last-Modified', modified);
    var etagStr = bundled_lib_1.etag(body);
    debug(-3, 'etag %s', etagStr);
    res.setHeader('ETag', etagStr);
    if (bundled_lib_1.fresh(req.headers, { 'etag': etagStr, 'last-modified': modified })) {
        res.writeHead(304);
        res.end();
    }
    else {
        server_types_1.sendResponse(res, body, { doGzip: server_types_1.canAcceptGzip(req) });
    }
}
function loadTiddlyServerAdapter(mount, folder, reload, wikiInfo) {
    let cacheRequests = [];
    let cachePrepared = (settings.tsa.alwaysRefreshCache || reload === "tsacache")
        ? false : fs.existsSync(path.join(folder, 'cache'));
    if (!wikiInfo)
        return doError(mount, folder, new Error("WikiInfo not loaded"));
    const { $tw } = boot_startup_1.TiddlyWiki.loadWiki(folder);
    const files = $tw.boot.files;
    /*
    * tiddlyserver datafolder type is a subset of tiddlywiki datafolder type
    * - no local plugin/theme/language folders
    * - no server-side plugins (obviously)
    * - no builds
    * - no config (none is needed)
    * - includeWikis must be tiddlyserver type, or are read only
    * - tiddlers are all stored in the same directory
    * - cache is sent with the tiddler PUT request, and is either the text of the tiddler,
    *   or is sent separately, according to a marker
    */
    // the second line in the PUT request contains: content encoding, cache marker (cache-[name]) specifying the cache area to use
    initTiddlyServerAdapterCache(mount, folder).then(() => {
        cachePrepared = true;
        cacheRequests.forEach((state) => sendCacheFolder.next(state));
        cacheRequests = [];
    });
    const sendCacheFolder = new rx_1.Subject();
    server_types_1.serveFolderObs(sendCacheFolder.asObservable(), mount + "/cache", folder + "/cache");
    function handler(state) {
        const { req, res } = state;
        const tsa = new TSASO(state, wikiInfo, folder, mount, files);
        // GET the mount, which has no trailing slash
        if (!tsa.localPath.length) {
            if (req.method === "GET")
                sendLoader(tsa);
            else {
                res.writeHead(405);
                res.end();
            }
        }
        else if (tsa.localPathParts[1] === "startup.json") {
            // GET /startup.json - load all tiddlers for the wiki and send them
            if (req.method === "GET")
                sendAllTiddlers(tsa);
            else {
                res.writeHead(405);
                res.end();
            }
        }
        else if (tsa.localPathParts[1] === "tiddlers.json") {
            // GET /tiddlers.json - get the skinny list of tiddlers in the files hashmap
            if (req.method === "GET")
                sendSkinnyTiddlers(tsa);
            else {
                res.writeHead(405);
                res.end();
            }
        }
        else if (tsa.localPathParts[1] === "tiddlers") {
            // ALL /tiddlers/* - load and save the files tiddlers
            handleTiddlersRoute(tsa);
        }
        else if (tsa.localPathParts[1] === "cache") {
            // ALL /cache/*
            if (['GET', 'HEAD'].indexOf(req.method) > -1) {
                if (!cachePrepared)
                    cacheRequests.push(state);
                else
                    sendCacheFolder.next(state);
            }
            else if (['PUT', 'DELETE'].indexOf(req.method) > -1) {
                handleCacheRoute(tsa);
            }
            else if (req.method === "OPTIONS") {
                state.res.writeHead(200);
                state.res.write("GET,HEAD,PUT,DELETE,OPTIONS");
                state.res.end();
            }
            else {
                res.writeHead(405);
                res.end();
            }
        }
        else {
            res.writeHead(404);
            res.end();
        }
    }
    const requests = loadedFolders[mount];
    loadedFolders[mount] = { handler, folder, mount, sockets: [] };
    requests.forEach((state) => handler(state));
}
function initTiddlyServerAdapterCache(mount, folder) {
    return new Promise(resolve => DataFolder(mount, folder, (err, $tw) => {
        //render the different caches here and save them to disk
    }));
}
class TSASO {
    constructor(state, wikiInfo, folder, mount, 
        /** Hashmap keyed to tiddler title */
        files) {
        this.state = state;
        this.wikiInfo = wikiInfo;
        this.folder = folder;
        this.mount = mount;
        this.files = files;
        this.localPath = state.url.pathname.slice(mount.length);
        this.localPathParts = this.localPath.split('/');
    }
}
const globalRegex = /\$\{mount\}/g;
//just save it here so we don't have to keep reloading it
const loaderText = fs.readFileSync(path.join(__dirname, './datafolder-template.html'), 'utf8');
function sendLoader(tsa) {
    server_types_1.sendResponse(tsa.state.res, loaderText.replace(globalRegex, tsa.mount), { doGzip: server_types_1.canAcceptGzip(tsa.state.req), contentType: "text/html; charset=utf-8" });
}
function sendAllTiddlers(tsa) {
    const { $tw, wikiInfo } = boot_startup_1.TiddlyWiki.loadWiki(tsa.folder);
    const tiddlers = [];
    /** @type {string[]} */
    const skipFields = ["",];
    $tw.wiki.each((tiddler, title) => {
        let fields = {};
        let keys = Object.keys(tiddler.fields).forEach(key => {
            if (skipFields.indexOf(key) === -1)
                fields[key] = tiddler.fields[key];
        });
        tiddlers.push(fields);
    });
    let text = JSON.stringify(tiddlers);
    var cacheControl = 'no-cache';
    debug(-3, 'cache-control %s', cacheControl);
    tsa.state.res.setHeader('Cache-Control', cacheControl);
    var etag = etag(text);
    debug(-3, 'etag %s', etag);
    tsa.state.res.setHeader('ETag', etag);
    if (bundled_lib_1.fresh(tsa.state.req.headers, { 'etag': etag })) {
        tsa.state.res.writeHead(304);
        tsa.state.res.end();
    }
    else {
        server_types_1.sendResponse(tsa.state.res, text, {
            doGzip: server_types_1.canAcceptGzip(tsa.state.req),
            contentType: "application/json; charset=utf-8"
        });
    }
}
function sendSkinnyTiddlers(tsa) {
}
const newLineBuffer = Buffer.from('\n');
function handleTiddlersRoute(tsa) {
    //GET HEAD PUT DELETE
    let title = decodeURIComponent(tsa.localPathParts[2]);
    if (tsa.state.req.method === "GET") {
    }
    return ((tsa.state.req.method === "PUT")
        ? tsa.state.recieveBody(true).mapTo(tsa)
        : rx_1.Observable.of(tsa)).map(tsa => {
    });
}
function loadTiddler(filepath) {
    var ext = path.extname(filepath), extensionInfo = global_tw.utils.getFileExtensionInfo(ext), type = extensionInfo ? extensionInfo.type : null, typeInfo = type ? global_tw.config.contentTypeInfo[type] : null, encoding = typeInfo ? typeInfo.encoding : "utf8";
    return server_types_1.obs_readFile()(filepath, encoding).concatMap(([err, data]) => {
        var tiddlers = global_tw.wiki.deserializeTiddlers(ext, data, {});
        if (ext !== ".json" && tiddlers.length === 1)
            return server_types_1.obs_readFile(tiddlers)(filepath + ".meta", 'utf8');
        else
            return rx_1.Observable.of([undefined, undefined, tiddlers]);
    }).map(([err, data, tiddlers]) => {
        let metadata = data ? global_tw.utils.parseFields(data) : {};
        tiddlers = (!err && data) ? [global_tw.utils.extend({}, tiddlers[0], metadata)] : tiddlers;
        return { tiddlers, encoding };
    });
}
function getSkinnyTiddlers(tsa) {
    // let title = decodeURIComponent(tsa.localPathParts[2]);
    // if (!tsa.files[title]) { tsa.state.throw(404); return; }
    // var filepath = tsa.files[title].filepath;
    const files = Object.keys(tsa.files).map(e => tsa.files[e].filepath);
    rx_1.Observable.from(files).mergeMap(loadTiddler).subscribe(({ tiddlers, encoding }) => {
        if (tiddlers.length !== 1) {
            tsa.state.throw(404);
        }
        else {
            let tiddler = tiddlers[0];
            let { res } = tsa.state;
            let text = Buffer.from(tiddler.text, encoding);
            delete tiddler.text;
            //use utf16 so we can convert straight back to a string in the browser
            let header = Buffer.from(JSON.stringify(tiddler), 'utf8');
            let body = Buffer.concat([
                header, newLineBuffer, Buffer.from(encoding, 'binary'), newLineBuffer, text
            ]);
            server_types_1.sendResponse(res, body, {
                doGzip: server_types_1.canAcceptGzip(tsa.state.req),
                contentType: "application/octet-stream"
            });
        }
    });
}
function handleCacheRoute(tsa) {
    //stores library and rawmarkup code sections as the full javascript to be returned
    //the source tiddlers are sent separately to allow editing later. Only the javascript
    //is stored in the cache. If we do not have a cache, we temporarily load the entire
    //folder during the mount sequence to generate it. 
    //PUT DELETE
}
