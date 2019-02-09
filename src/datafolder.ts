import {
	StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag, DebugLogger,
	PathResolverResult, obs_readFile, tryParseJSON, obs_readdir, JsonError, serveFolderObs, serveFolderIndex, sendResponse, canAcceptGzip, Hashmap, ServerEventEmitter, resolvePath, statWalkPath, obs_stat,
} from "./server-types";
import { Observable, Subject } from "../lib/rx";

import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';

//import { TiddlyWiki } from 'tiddlywiki';
import { EventEmitter } from "events";
import { parse } from "url";
import { inspect } from "util";

import { gzip } from 'zlib';

import { TiddlyWiki, TiddlyServer, PluginInfo, WikiInfo } from './boot-startup';
import { fresh, etag, ws as WebSocket } from '../lib/bundled-lib';

var settings: ServerConfig = {} as any;

const debug = DebugLogger('DAT');

const loadedFolders: { [k: string]: FolderData } = {};
const otherSocketPaths: { [k: string]: WebSocket[] } = {};
const clientsList: { [k: string]: WebSocket[] } = {};
let eventer: ServerEventEmitter;

export function init(e: ServerEventEmitter) {
	eventer = e;
	eventer.on('settings', function (set: ServerConfig) {
		settings = set;
	})
	eventer.on('settingsChanged', (keys) => {
		// if (keys.indexOf("username") > -1) {
		//     debug(1, "The username will not be updated on currently loaded data folders. " +
		//         "To apply the new username you will need to reload the data folders or restart the server."
		//     );
		// }
	})
	eventer.on('websocket-connection', function (client: WebSocket, request: http.IncomingMessage) {
		let pathname = parse(request.url as string).pathname as string;// new URL(request.url as string);

		var result = resolvePath(pathname.split('/'), settings.tree) as PathResolverResult
		if (!result) return client.close(404);

		statWalkPath(result).subscribe(statPath => {
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
					loadedFolders[mount].events.once('ws-client-preload', loadClient)
				} else {
					loadClient();
				}
			} else {
				client.addEventListener('message', (event) => {
					console.log('message', event);
					debug(-3, 'WS-MESSAGE %s', inspect(event));
					clientsList[pathname].forEach(e => {
						if (e !== client) e.send(event.data);
					})
				});

				client.addEventListener('error', (event) => {
					debug(-2, 'WS-ERROR %s %s', pathname, event.type)
					var index = clientsList[pathname].indexOf(client);
					if (index > -1) clientsList[pathname].splice(index, 1);
					client.close();
				})

				client.addEventListener('close', (event) => {
					debug(-2, 'WS-CLOSE %s %s %s', pathname, event.code, event.reason);
					var index = clientsList[pathname].indexOf(client);
					if (index > -1) clientsList[pathname].splice(index, 1);
				})

				if (!clientsList[pathname]) clientsList[pathname] = [];
				clientsList[pathname].push(client);
			}
		});
	})
}

type FolderData = {
	mount: string,
	folder: string,
	handler: ((state: StateObject) => void) | StateObject[];
	events: EventEmitter;
};

function quickArrayCheck(obj: any): obj is Array<any> {
	return typeof obj.length === 'number';
}

export function handleDataFolderRequest(result: PathResolverResult, state: StateObject) {

	const { mount, folder } = loadDataFolderTrigger(result,
		state.statPath, state.url.pathname, state.url.query.reload as any || "");


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
	} else {
		load.handler(state);
	}
}
function loadDataFolderTrigger(result, statPath, pathname: string, reload: "true" | "force" | "") {
	let filepathPrefix = result.filepathPortion.slice(0, statPath.index).join('/');
	//get the tree path, and add the file path (none if the tree path is a datafolder)
	let fullPrefix = ["", result.treepathPortion.join('/')];
	if (statPath.index > 0) fullPrefix.push(filepathPrefix);
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
		loadedFolders[mount] = { mount, folder, events: new EventEmitter(), handler: [] };
		loadDataFolderType(mount, folder, reload);
		// loadTiddlyServerAdapter(prefixURI, folder, state.url.query.reload);
		// loadTiddlyWiki(prefixURI, folder);
	}

	return { mount, folder };
}

function loadDataFolderType(mount: string, folder: string, reload: string) {
	obs_readFile()(path.join(folder, "tiddlywiki.info"), 'utf8').subscribe(([err, data]) => {
		const wikiInfo = tryParseJSON<WikiInfo>(data, e => { throw e; });
		if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
			loadDataFolderTiddlyWiki(mount, folder, reload);
		} else if (wikiInfo.type === "tiddlyserver") {
			// loadTiddlyServerAdapter(mount, folder, reload)
		}
	})
}
function loadDataFolderTiddlyWiki(mount: string, folder: string, reload: string) {
	console.time('twboot-' + folder);
	const target = "../tiddlywiki";
	let _wiki = undefined;
	const $tw = require(target + "/boot/boot.js").TiddlyWiki(
		require(target + "/boot/bootprefix.js").bootprefix({
			packageInfo: JSON.parse(fs.readFileSync(path.join(__dirname, target + '/package.json'), 'utf8')),
			// get wiki(){
			// 	console.log((new Error().stack as string).split('\n')[2]);
			// 	return _wiki;
			// },
			// set wiki(v){
			// 	console.log((new Error().stack as string).split('\n')[2]);
			// 	_wiki = v;
			// }
		})
	);
	$tw.boot.argv = [folder];
	$tw.preloadTiddler({
		"text": "$protocol$//$host$" + mount + "/",
		"title": "$:/config/tiddlyweb/host"
	});
	try {
		$tw.boot.boot(() => {
			complete(null, $tw);
		});
	} catch (err) {
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
		} catch (e) {
			doError(mount, folder, e);
			return;
		}
		var server = new server({
			wiki: $tw.wiki,
			variables: {
				// "username": settings.username, //TODO
				"path-prefix": mount,
				"root-tiddler": "$:/core/save/all-external-js"
			}
		});

		//invoke the server start hook so plugins can extend the server or attach to the event handler
		$tw.hooks.invokeHook('th-server-command-post-start', server, loadedFolders[mount].events, "tiddlyserver");
		//add the event emitter to the $tw variable
		$tw.wss = loadedFolders[mount].events;
		//set the request handler, indicating we are now ready to recieve requests
		const requests = loadedFolders[mount].handler as StateObject[];
		loadedFolders[mount].handler = (state: StateObject) => {
			//pretend to the handler like the path really has a trailing slash
			let req = new Object(state.req) as http.IncomingMessage;
			req.url += ((state.url.pathname === mount && !state.url.pathname.endsWith("/")) ? "/" : "");
			server.requestHandler(state.req, state.res)
		};
		//send queued websocket clients to the event emitter
		loadedFolders[mount].events.emit('ws-client-preload');
		//send the queued requests to the handler
		requests.forEach(e => (loadedFolders[mount].handler as Function)(e));
	}
};

function doError(mount, folder, err) {
	debug(3, 'error starting %s at %s: %s', mount, folder, err.stack);
	const requests = loadedFolders[mount].handler as any[];
	loadedFolders[mount] = {
		handler: function (state: StateObject) {
			state.respond(500, "TW5 data folder failed").string(
				"The Tiddlywiki data folder failed to load. The error has been logged to the " +
				"terminal with priority level 2. " +
				"To try again, use ?reload=true after making any necessary corrections.");
		}
	} as any;
	requests.forEach(([req, res]) => {
		(loadedFolders[mount] as { handler: any }).handler(req, res);
	})

}


// let counter = 0;



interface PluginCache {
	meta: PluginInfo
	text: string
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

	pluginLoader = function getPlugin(type, name): PluginCache | "null" {
		if (!pluginCache[type][name]) {
			const typeInfo = pluginConfig[type];
			var paths = $tw.getLibraryItemSearchPaths(typeInfo[0], typeInfo[1]);
			let pluginPath = $tw.findLibraryItem(name, paths);
			let plugin = $tw.loadPluginFolder(pluginPath);
			if (!plugin) pluginCache[type][name] = "null";
			else {
				let text = plugin.text,
					meta = plugin;
				delete plugin.text;
				pluginCache[type][name] = { meta, text, cacheTime: new Date().valueOf() };
			}
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
serveFolderObs(
	serveBootFolder.asObservable(),
	'/assets/tiddlywiki/boot',
	path.join(__dirname, "../tiddlywiki/boot"),
	serveFolderIndex({ type: 'json' })
);

export function handleTiddlyWikiRoute(state: StateObject) {
	//number of elements on state.path that are part of the mount path.
	//the zero-based index of the first subpath is the same as the number of elements
	let mountLength = 3;
	console.log(state.path);
	if (['plugin', 'theme', 'language', 'core', 'boot'].indexOf(state.path[mountLength]) === -1) {
		console.log('throw', state.responseSent);
		state.throw(404);
	} else if (state.path[mountLength] === "core") {
		sendPluginResponse(state, coreCache);
	} else if (state.path[mountLength] === "boot") {
		serveBootFolder.next(state);
	} else if (!state.path[mountLength]) {
		const folder = path.join(__dirname, "../tiddlywiki");
		const folderPaths: string[] = [];
		const processFolder = (dirpath: string): Observable<never> => {
			return obs_readdir()(dirpath).mergeMap(([err, files, tag, dirpath]) => {
				return Observable.from(files).mergeMap(file => obs_stat()(path.join(dirpath, file)))
			}).mergeMap(([err, stat, tag, subpath]) => {
				folderPaths.push(subpath.slice(folder.length));
				return stat.isDirectory() ? processFolder(subpath) : Observable.empty<never>();
			});
		}
		processFolder(folder).subscribe({
			complete: () => {
				state.respond(200).json(folderPaths);
			}
		})

	} else {
		sendPluginResponse(state,
			pluginLoader(state.path[mountLength], decodeURIComponent(state.path[mountLength + 1]))
		);
	}

}

function sendPluginResponse(state: StateObject, pluginCache: PluginCache | "null") {
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
	var maxAge = Math.min(Math.max(0, maxageSetting), MAX_MAXAGE)

	var cacheControl = 'public, max-age=' + Math.floor(maxageSetting / 1000)
	debug(-3, 'cache-control %s', cacheControl)
	state.setHeader('Cache-Control', cacheControl)

	var modified = new Date(pluginCache.cacheTime).toUTCString()
	debug(-3, 'modified %s', modified)
	state.setHeader('Last-Modified', modified)

	var etagStr = etag(body);
	debug(-3, 'etag %s', etagStr)
	state.setHeader('ETag', etagStr)

	if (fresh(state.req.headers, { 'etag': etagStr, 'last-modified': modified })) {
		debug(-1, "client plugin still fresh")
		state.respond(304).empty();
	} else {
		debug(-1, "sending plugin")
		sendResponse(state, body, { doGzip: canAcceptGzip(state.req) });
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
