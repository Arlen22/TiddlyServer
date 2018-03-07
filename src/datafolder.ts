import {
    StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag, DebugLogger,
    PathResolverResult, obs_readFile, tryParseJSON, obs_readdir, JsonError, serveFolder, serveFolderIndex,
} from "./server-types";
import { Observable, Subject } from "../lib/rx";

import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';

//import { TiddlyWiki } from 'tiddlywiki';
import { EventEmitter } from "events";
import { parse } from "url";
import { inspect } from "util";

var settings: ServerConfig = {} as any;

const debug = DebugLogger('DAT');

const loadedFolders: { [k: string]: FolderData | StateObject[] } = {};
const otherSocketPaths: { [k: string]: WebSocket[] } = {};

export function init(eventer: EventEmitter) {
    eventer.on('settings', function (set: ServerConfig) {
        settings = set;
    })
    eventer.on('websocket-connection', function (client: WebSocket, request: http.IncomingMessage) {
        let reqURL = parse(request.url as string);// new URL(request.url as string);
        let datafolder = loadedFolders[reqURL.pathname as string] as FolderData;
        // debug(-2, [reqURL.pathname as string, !!datafolder].join(' '));
        if (!datafolder) {
            if (!otherSocketPaths[reqURL.pathname as string])
                otherSocketPaths[reqURL.pathname as string] = [];
            let other = otherSocketPaths[reqURL.pathname as string]
            other.push(client);
            client.addEventListener('message', event => {
                other.forEach(e => {
                    if (e === client) return;
                    e.send(event.data);
                })
            });
            client.addEventListener('error', (event) => {
                debug(-2, 'WS-ERROR %s %s', reqURL.pathname, event.type)
                other.splice(other.indexOf(client), 1);
                client.close();
            });
            client.addEventListener('close', (event) => {
                debug(-2, 'WS-CLOSE %s %s %s', reqURL.pathname, event.code, event.reason);
                other.splice(other.indexOf(client), 1);
            });
            return;
        }
        datafolder.sockets.push(client);

        client.addEventListener('message', (event) => {
            // const message = new WebSocketMessageEvent(event, client);
            // (datafolder.$tw.wss as WebSocket);
            // datafolder.$tw.hooks.invokeHook('th-websocket-message', event.data, client);
        })
        client.addEventListener('error', (event) => {
            debug(-2, 'WS-ERROR %s %s', reqURL.pathname, event.type)
            datafolder.sockets.splice(datafolder.sockets.indexOf(client), 1);
            client.close();
        })
        client.addEventListener('close', (event) => {
            debug(-2, 'WS-CLOSE %s %s %s', reqURL.pathname, event.code, event.reason);
            datafolder.sockets.splice(datafolder.sockets.indexOf(client), 1);
        })
    })
}

type FolderData = {
    mount: string,
    folder: string,
    handler: (state: StateObject) => void;
    sockets: WebSocket[];
};

function quickArrayCheck(obj: any): obj is Array<any> {
    return typeof obj.length === 'number';
}

export function datafolder(result: PathResolverResult) {
    //warm the cache
    //require("tiddlywiki/boot/boot.js").TiddlyWiki();

    // Observable.of(result).mergeMap(res => {

    /**
     * reqpath  is the prefix for the folder in the folder tree
     * item     is the folder string in the category tree that reqpath led to
     * filepath is the path relative to them
     */
    let { state } = result;
    //get the actual path to the folder from filepath

    let filepathPrefix = result.filepathPortion.slice(0, state.statPath.index).join('/');
    //get the tree path, and add the file path (none if the tree path is a datafolder)
    let fullPrefix = ["", result.treepathPortion.join('/')];
    if (state.statPath.index > 0) fullPrefix.push(filepathPrefix);
    //join the parts and split into an array
    fullPrefix = fullPrefix.join('/').split('/');
    //use the unaltered path in the url as the tiddlywiki prefix
    let prefixURI = state.url.pathname.split('/').slice(0, fullPrefix.length).join('/');
    //get the full path to the folder as specified in the tree
    let folder = state.statPath.statpath;
    //initialize the tiddlywiki instance

    // reload the plugin cache if requested
    if (state.url.query.reload === "plugins") initPluginLoader();

    if (!loadedFolders[prefixURI] || state.url.query.reload === "true") {
        loadedFolders[prefixURI] = [];
        loadDataFolder(prefixURI, folder, state.url.query.reload);
        // loadTiddlyServerAdapter(prefixURI, folder, state.url.query.reload);
        // loadTiddlyWiki(prefixURI, folder);
    }

    const isFullpath = result.filepathPortion.length === state.statPath.index;
    //set the trailing slash correctly if this is the actual page load
    //redirect ?reload=true requests to the same, to prevent it being 
    //reloaded multiple times for the same page load.
    if (isFullpath && !settings.useTW5path !== !state.url.pathname.endsWith("/")
        || state.url.query.reload) {
        let redirect = prefixURI + (settings.useTW5path ? "/" : "");
        state.res.writeHead(302, {
            'Location': redirect
        });
        state.res.end();
        return;
        // return Observable.empty();
    }
    //pretend to the handler like the path really has a trailing slash
    let req = new Object(state.req) as http.IncomingMessage;
    req.url += ((isFullpath && !state.url.pathname.endsWith("/")) ? "/" : "");
    // console.log(req.url);
    const load = loadedFolders[prefixURI];
    if (Array.isArray(load)) {
        load.push(state);
    } else {
        load.handler(state);
    }
}
function loadDataFolder(mount: string, folder: string, reload: string) {
    obs_readFile()(path.join(folder, "tiddlywiki.info"), 'utf8').subscribe(([err, data]) => {
        const wikiInfo: WikiInfo = tryParseJSON(data);
        if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
            loadTiddlyWiki(mount, folder, reload);
        } else if (wikiInfo.type === "tiddlyserver") {
            // loadTiddlyServerAdapter(mount, folder, reload)
        }
    })
}
function loadTiddlyWiki(mount: string, folder: string, reload: string) {

    console.time('twboot-' + folder);
    // const dynreq = "tiddlywiki";
    DataFolder(mount, folder, complete);

    function complete(err, $tw) {
        console.timeEnd('twboot-' + folder);
        if (err) {
            return doError(mount, folder, err);
        }

        //we use $tw.modules.execute so that the module has its respective $tw variable.
        var serverCommand;
        try {
            serverCommand = $tw.modules.execute('$:/core/modules/commands/server.js').Command;
        } catch (e) {
            doError(mount, folder, e);
            return;
        }
        var command = new serverCommand([], { wiki: $tw.wiki });
        var server = command.server;

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

        const requests = loadedFolders[mount] as any[];
        const handler = (state: StateObject) => server.requestHandler(state.req, state.res);

        loadedFolders[mount] = {
            mount,
            folder,
            handler,
            sockets: []
        }
        $tw.hooks.addHook('th-websocket-broadcast', function (message, ignore) {
            let folder = loadedFolders[mount] as FolderData;
            if (typeof message === 'object') message = JSON.stringify(message);
            else if (typeof message !== "string") message = message.toString();
            folder.sockets.forEach(client => {
                if (ignore.indexOf(client) > -1) return;
                client.send(message);
            })
        });
        //send the requests to the handler
        requests.forEach(e => handler(e));
    }


};

function doError(mount, folder, err) {
    debug(3, 'error starting %s at %s: %s', mount, folder, err.stack);
    const requests = loadedFolders[mount] as any[];
    loadedFolders[mount] = {
        handler: function (state: StateObject) {
            state.res.writeHead(500, "TW5 data folder failed");
            state.res.write("The Tiddlywiki data folder failed to load. The error has been logged to the " +
                "terminal with priority level 2. " +
                "To try again, use ?reload=true after making any necessary corrections.");
            state.res.end();
        }
    } as any;
    requests.forEach(([req, res]) => {
        (loadedFolders[mount] as { handler: any }).handler(req, res);
    })

}

function DataFolder(mount, folder, callback) {

    const $tw = require("../tiddlywiki/boot/boot.js").TiddlyWiki(
        require("../tiddlywiki/boot/bootprefix.js").bootprefix({
            packageInfo: JSON.parse(fs.readFileSync(path.join(__dirname, '../tiddlywiki/package.json'), 'utf8'))
        })
    );
    $tw.boot.argv = [folder];
    $tw.preloadTiddler({
        "text": "$protocol$//$host$" + mount + "/",
        "title": "$:/config/tiddlyweb/host"
    });
	/**
	 * Specify the boot folder of the tiddlywiki instance to load. This is the actual path to the tiddlers that will be loaded 
	 * into wiki as tiddlers. Therefore this is the path that will be served to the browser. It will not actually run on the server
	 * since we load the server files from here. We only need to make sure that we use boot.js from the same version as included in 
	 * the bundle. 
	**/
    try {
        $tw.boot.boot(() => {
            callback(null, $tw);
        });
    } catch (err) {
        callback(err);
    }
}

let counter = 0;

import { gzip } from 'zlib';

import { TiddlyWiki, TiddlyServer, PluginInfo, WikiInfo } from './boot-startup';
import { fresh, etag } from '../lib/bundled-lib';

interface PluginCache {
    plugin: PluginInfo
    cacheTime: number
}

let pluginCache: { [K: string]: { [K: string]: PluginCache | "null" } };
let coreCache: PluginCache;
let bootCache;
let pluginLoader;
let global_tw;

function initPluginLoader() {
    pluginCache = {};

    const $tw = global_tw = TiddlyWiki.loadCore();

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

    pluginLoader = function getPlugin(type, name): PluginCache | "null" {
        if (!pluginCache[type][name]) {
            const typeInfo = pluginConfig[type];
            var paths = $tw.getLibraryItemSearchPaths(typeInfo[0], typeInfo[1]);
            let pluginPath = $tw.findLibraryItem(name, paths);
            let plugin = $tw.loadPluginFolder(pluginPath);
            if (!plugin) pluginCache[type][name] = "null";
            else pluginCache[type][name] = { plugin, cacheTime: new Date().valueOf() };
        }
        return pluginCache[type][name];
    }


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
const serveBootFolder = new Subject<StateObject>();
serveFolder(
    serveBootFolder.asObservable(),
    '/tiddlywiki/boot',
    path.join(__dirname, "../tiddlywiki/boot"),
    serveFolderIndex({ type: 'json' })
);

export function doTiddlyWikiRoute(input: Observable<StateObject>) {
    return input.do(state => {
        if (['plugins', 'themes', 'languages', 'core', 'boot'].indexOf(state.path[2]) === -1) {
            state.throw(404);
        } else if (state.path[2] === "core") {
            sendPluginResponse(state, coreCache);
        } else if (state.path[2] === "boot") {
            serveBootFolder.next(state);
        } else {
            sendPluginResponse(state, pluginLoader(state.path[2], decodeURIComponent(state.path[3])))
        }
    }).ignoreElements();
}

function sendPluginResponse(state: StateObject, pluginCache: PluginCache | "null") {
    const { req, res } = state;
    if (pluginCache === "null") {
        res.writeHead(404);
        res.end();
        return;
    }
    let text = pluginCache.plugin.text;
    delete pluginCache.plugin.text;
    let meta = JSON.stringify(pluginCache.plugin);

    const body = meta + '\n\n' + text;

    var MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000; //1 year
    var maxAge = Math.min(Math.max(0, settings.maxAge.tw_plugins), MAX_MAXAGE)

    var cacheControl = 'public, max-age=' + Math.floor(settings.maxAge.tw_plugins / 1000)
    debug(-3, 'cache-control %s', cacheControl)
    res.setHeader('Cache-Control', cacheControl)

    var modified = new Date(pluginCache.cacheTime).toUTCString()
    debug(-3, 'modified %s', modified)
    res.setHeader('Last-Modified', modified)

    var etag = etag(body);
    debug(-3, 'etag %s', etag)
    res.setHeader('ETag', etag)

    if (fresh(req.headers, { 'etag': etag, 'last-modified': modified })) {
        res.writeHead(304);
        res.end();
    } else {
        sendResponse(res, body, { doGzip: acceptGzip(req) });
    }
}

function loadTiddlyServerAdapter(mount: string, folder: string, reload: string, wikiInfo: WikiInfo) {
    let cacheRequests: StateObject[] = [];
    let cachePrepared = (settings.tsa.alwaysRefreshCache || reload === "tsacache")
        ? false : fs.existsSync(path.join(folder, 'cache'));
    if (!wikiInfo) return doError(mount, folder, new Error("WikiInfo not loaded"));
    const { $tw } = TiddlyWiki.loadWiki(folder);
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



    const sendCacheFolder = new Subject<StateObject>();
    serveFolder(sendCacheFolder.asObservable(), mount + "/cache", folder + "/cache");
    function handler(state: StateObject) {
        const { req, res } = state;

        const tsa = new TSASO(state, wikiInfo, folder, mount, files);

        // GET the mount, which has no trailing slash
        if (!tsa.localPath.length) {
            if (req.method === "GET") sendLoader(tsa);
            else { res.writeHead(405); res.end(); }
        } else if (tsa.localPathParts[1] === "startup.json") {
            // GET /startup.json - load all tiddlers for the wiki and send them
            if (req.method === "GET") sendAllTiddlers(tsa);
            else { res.writeHead(405); res.end(); }
        } else if (tsa.localPathParts[1] === "tiddlers.json") {
            // GET /tiddlers.json - get the skinny list of tiddlers in the files hashmap
            if (req.method === "GET") sendSkinnyTiddlers(tsa);
            else { res.writeHead(405); res.end(); }
        } else if (tsa.localPathParts[1] === "tiddlers") {
            // ALL /tiddlers/* - load and save the files tiddlers
            handleTiddlersRoute(tsa);
        } else if (tsa.localPathParts[1] === "cache") {
            // ALL /cache/*
            if (['GET', 'HEAD'].indexOf(req.method as string) > -1) {
                if (!cachePrepared) cacheRequests.push(state);
                else sendCacheFolder.next(state);
            } else if (['PUT', 'DELETE'].indexOf(req.method as string) > -1) {
                handleCacheRoute(tsa);
            } else if (req.method === "OPTIONS") {
                state.res.writeHead(200);
                state.res.write("GET,HEAD,PUT,DELETE,OPTIONS");
                state.res.end();
            } else {
                res.writeHead(405); res.end();
            }
        }
        // Status 404
        else { res.writeHead(404); res.end(); }
    }
    const requests = loadedFolders[mount] as StateObject[];
    loadedFolders[mount] = { handler, folder, mount, sockets: [] };
    requests.forEach((state) => handler(state));

}
function initTiddlyServerAdapterCache(mount: string, folder: string) {
    return new Promise(resolve => DataFolder(mount, folder, (err, $tw) => {
        //render the different caches here and save them to disk
    }));
}
class TSASO {
    public localPath: string;
    public localPathParts: string[];

    constructor(
        public state: StateObject,
        public wikiInfo: WikiInfo,
        public folder: string,
        public mount: string,
        /** Hashmap keyed to tiddler title */
        public files: { [K: string]: TiddlerInfo }
    ) {
        this.localPath = state.url.pathname.slice(mount.length);
        this.localPathParts = this.localPath.split('/');
    }
}
const globalRegex = /\$\{mount\}/g;
//just save it here so we don't have to keep reloading it
const loaderText = fs.readFileSync(path.join(__dirname, './datafolder-template.html'), 'utf8');
function sendLoader(tsa: TSASO) {
    sendResponse(
        tsa.state.res,
        loaderText.replace(globalRegex, tsa.mount),
        { doGzip: acceptGzip(tsa.state.req), contentType: "text/html; charset=utf-8" }
    );
}
function sendAllTiddlers(tsa: TSASO) {
    const { $tw, wikiInfo } = TiddlyWiki.loadWiki(tsa.folder);
    const tiddlers: any[] = [];
    /** @type {string[]} */
    const skipFields = ["",/* "text" */];
    $tw.wiki.each((tiddler, title) => {
        let fields = {};
        let keys = Object.keys(tiddler.fields).forEach(key => {
            if (skipFields.indexOf(key) === -1)
                fields[key] = tiddler.fields[key];
        })
        tiddlers.push(fields);
    });
    let text = JSON.stringify(tiddlers);

    var cacheControl = 'no-cache';
    debug(-3, 'cache-control %s', cacheControl)
    tsa.state.res.setHeader('Cache-Control', cacheControl)

    var etag = etag(text);
    debug(-3, 'etag %s', etag)
    tsa.state.res.setHeader('ETag', etag)

    if (fresh(tsa.state.req.headers, { 'etag': etag })) {
        tsa.state.res.writeHead(304);
        tsa.state.res.end();
    } else {
        sendResponse(tsa.state.res, text, {
            doGzip: acceptGzip(tsa.state.req),
            contentType: "application/json; charset=utf-8"
        });
    }
}
function sendSkinnyTiddlers(tsa: TSASO){

}
const newLineBuffer = Buffer.from('\n');
interface TiddlerInfo { filepath: string, type: string, hasMetaFile: boolean }
function handleTiddlersRoute(tsa: TSASO) {
    //GET HEAD PUT DELETE
    let title = decodeURIComponent(tsa.localPathParts[2]);

    if (tsa.state.req.method === "GET") {
    }



    return ((tsa.state.req.method === "PUT")
        ? tsa.state.recieveBody().mapTo(tsa)
        : Observable.of(tsa)
    ).map(tsa => {

    })
}
function loadTiddler(filepath: string) {

    var ext = path.extname(filepath),
        extensionInfo = global_tw.utils.getFileExtensionInfo(ext),
        type = extensionInfo ? extensionInfo.type : null,
        typeInfo = type ? global_tw.config.contentTypeInfo[type] : null,
        encoding = typeInfo ? typeInfo.encoding : "utf8";

    return obs_readFile()(filepath, encoding).concatMap(([err, data]) => {
        var tiddlers = global_tw.wiki.deserializeTiddlers(ext, data, {});
        if (ext !== ".json" && tiddlers.length === 1)
            return obs_readFile(tiddlers)(filepath + ".meta", 'utf8');
        else return Observable.of([undefined, undefined, tiddlers]);
    }).map(([err, data, tiddlers]) => {
        let metadata = data ? global_tw.utils.parseFields(data) : {};
        tiddlers = (!err && data) ? [global_tw.utils.extend({}, tiddlers[0], metadata)] : tiddlers;
        return { tiddlers, encoding };
    })

}

function getSkinnyTiddlers(tsa) {
    // let title = decodeURIComponent(tsa.localPathParts[2]);
    // if (!tsa.files[title]) { tsa.state.throw(404); return; }
    // var filepath = tsa.files[title].filepath;
    const files = Object.keys(tsa.files).map(e => tsa.files[e].filepath);
    Observable.from(files).mergeMap(loadTiddler).subscribe(({ tiddlers, encoding }) => {
        if (tiddlers.length !== 1) {
            tsa.state.throw(404);
        } else {
            let tiddler = tiddlers[0];
            let { res } = tsa.state;
            let text = Buffer.from(tiddler.text, encoding);
            delete tiddler.text
            //use utf16 so we can convert straight back to a string in the browser
            let header = Buffer.from(JSON.stringify(tiddler), 'utf8');
            let body = Buffer.concat([
                header, newLineBuffer, Buffer.from(encoding, 'binary'), newLineBuffer, text
            ]);
            sendResponse(res, body, {
                doGzip: acceptGzip(tsa.state.req),
                contentType: "application/octet-stream"
            });
        }
    })
}
function handleCacheRoute(tsa: TSASO) {
    //stores library and rawmarkup code sections as the full javascript to be returned
    //the source tiddlers are sent separately to allow editing later. Only the javascript
    //is stored in the cache. If we do not have a cache, we temporarily load the entire
    //folder during the mount sequence to generate it. 
    //PUT DELETE
}
function acceptGzip(header: string | http.IncomingMessage) {
    if (((a): a is http.IncomingMessage => typeof a === "object")(header)) {
        header = header.headers['accept-encoding'] as string;
    }
    var gzip = header.split(',').map(e => e.split(';')).filter(e => e[0] === "gzip")[0];
    return !!gzip && !!gzip[1] && parseFloat(gzip[1].split('=')[1]) > 0
}
function sendResponse(res: http.ServerResponse, body: Buffer | string, options: {
    doGzip?: boolean,
    contentType?: string
} = {}) {
    body = !Buffer.isBuffer(body) ? Buffer.from(body, 'utf8') : body;
    if (options.doGzip) gzip(body, (err, gzBody) => {
        if (err) _send(body, false);
        else _send(gzBody, true)
    }); else _send(body, false);

    function _send(body, isGzip) {
        res.setHeader('Content-Length', Buffer.isBuffer(body)
            ? body.length.toString()
            : Buffer.byteLength(body, 'utf8').toString())
        if (isGzip) res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Type', options.contentType || 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.write(body);
        res.end();
    }

}