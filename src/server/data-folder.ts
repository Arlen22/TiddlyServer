import {
  PathResolverResult,
  // RequestEventWS,
  resolvePath,
  ServerConfig,
  ServerEventEmitter,
  // StateObject,
  statWalkPath,
  StatPathResult,
  IStatPathResult,
  Resolved,
  getStatPathResult,
} from "./server-types";
import { StateObject } from "./state-object";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";

import { EventEmitter } from "./event-emitter-types";
import { parse, UrlWithStringQuery } from "url";
import { inspect, promisify, debuglog } from "util";
import { WikiInfo } from "./boot-startup-types";
import * as WebSocket from "ws";
import { RequestEvent } from "./request-event";
import { OptionsConfig } from "./server-config";
import { Writable } from "stream";
import { tryParseJSON } from './utils-functions';
import { ParsedUrlQuery } from 'querystring';
import { dirname } from "../rootpath";
import { FileSystemAdaptor } from "./filesystemadaptor";
interface Records<T> { [k: string]: T; }

const loadedFolders: Records<DataFolder> = {};
const otherSocketPaths: Records<WebSocket[]> = {};
const clientsList: Records<WebSocket[]> = {};
// let eventer: ServerEventEmitter;

type DataFolderEvents = {
  "ws-client-connect": readonly [WebSocket, DataFolderRequest, string]
  "ws-client-preload": readonly [() => void]
  "reload": readonly [string, string]
  "init-data-folder": readonly [DataFolder]
}
export function handleDataFolderRequest(
  result: PathResolverResult,
  state: import("./tiddlyserver").TreeStateObject<getStatPathResult<"datafolder">>
) {
  const reload = !!state.url.query.reload;
  let request = new DataFolderRequest(
    result,
    state.statPath,
    state.url.pathname,
    state.settings.__serverTW,
    state.settings.datafolder,
    state.debugOutput
  );
  DataFolder.trigger(request, reload);
  const { mount } = request;
  const isFullpath = result.filepathPortion.length === state.statPath.index;
  // if we are at the datafolder root, we need to correctly set the trailing slash based on user preference
  const redirect = isFullpath && state.pathOptions.noTrailingSlash !== !state.url.pathname.endsWith("/");
  //set the trailing slash correctly if this is the actual page load
  //redirect ?reload requests to the same, to prevent it being
  //reloaded multiple times for the same page load.
  if (redirect || reload) {
    let redirect = mount + (!state.pathOptions.noTrailingSlash ? "/" : "");
    state.redirect(redirect)
    return;
  }
  loadedFolders[mount].handler(state);
}
class DataFolder {
  static tiddlywiki: Record<string, { server: TiddlyWikiServer, $tw: any, queue: any, cache: any }> = {}
  syncadaptor: any;
  syncer: any;
  // wikiInfo: any;
  /** Creates a DataFolder if there is none on loadedFolders[mount] then loads the datafolder asyncly */
  static async trigger(request: DataFolderRequest, reloadParam: boolean) {
    let { mount, folder, target, vars } = request;
    if (!loadedFolders[mount] || reloadParam) {
      if (reloadParam) loadedFolders[mount].events.emit("reload", mount, folder);
      loadedFolders[mount] = new DataFolder(mount, folder);
      // make sure we've loaded this target (in case settings change mid-flight)
      if (!DataFolder.tiddlywiki[target]) DataFolder.tiddlywiki[target] = await loadDataFolderServer(target, vars)
      // initialize the tiddlywiki instance
      promisify(fs.readFile)(path.join(folder, "tiddlywiki.info"), "utf8").then(data => {
        const wikiInfo = tryParseJSON<WikiInfo>(data, e => { throw e; });
        if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
          // loadDataFolderTiddlyWiki(request);
          loadDataFolder(request);
        }
      });
    }
  }
  static doError(debugOutput: Writable, mount, folder, err) {
    const requests = loadedFolders[mount].pending;
    StateObject.DebugLoggerInner(3, "DATA", "error starting %s at %s: %s", [mount, folder, err.stack], debugOutput)
    loadedFolders[mount].handler = function (state: StateObject) {
      state.respond(500, "TW5 data folder failed").string(
        "The Tiddlywiki data folder failed to load. The error has been " +
        "logged to the terminal with priority level 2. To try again, " +
        "use ?reload=true after making any necessary corrections."
      );
    }
    requests.forEach(e => loadedFolders[mount].handler(e));
  }
  wiki: any;
  // files: any;
  // wikiTiddlersPath: any;
  pending: StateObject[] = [];
  /**
  - "ws-client-connect": readonly [WebSocket, DataFolderRequest, subpath]
  - "ws-client-preload": readonly [() => void]
  - "reload": readonly [mount, folder]
  - "init-wiki": readonly [mount, folder, wiki]
   */
  events = new EventEmitter<DataFolderEvents>();
  handler: (state: StateObject) => void = (state) => { this.pending.push(state); }
  constructor(
    public mount: string,
    public folder: string
  ) {

  }
}

class DataFolderRequest {
  mount: string;
  folder: string;
  constructor(
    public result: PathResolverResult,
    public statPath: getStatPathResult<"datafolder">,
    public pathname: string,
    public target: string,
    public vars: {},
    public debugOutput: Writable
  ) {
    let filepathPrefix = this.result.filepathPortion.slice(0, this.statPath.index).join("/");
    //get the tree path, and add the file path (none if the tree path is a datafolder)
    let fullPrefix = ["", this.result.treepathPortion.join("/")];
    if (this.statPath.index > 0) fullPrefix.push(filepathPrefix);
    //join the parts and split into an array
    fullPrefix = fullPrefix.join("/").split("/");
    //use the unaltered path in the url as the tiddlywiki prefix
    this.mount = this.pathname.split("/").slice(0, fullPrefix.length).join("/");
    //get the full path to the folder as specified in the tree
    this.folder = this.statPath.statpath;
  }
}

export async function handleWebsocketConnection(
  data: RequestEvent,
  result: PathResolverResult,
  treeOptions: OptionsConfig,
  statPath: StatPathResult
) {
  const { client, settings, debugOutput } = data;
  const debug = StateObject.DebugLogger("WEBSOCK").bind({ settings, debugOutput });
  let pathname = parse(data.request.url as string).pathname;
  if (!pathname) return client.close(400);

  if (statPath.itemtype === "datafolder") {
    if (!data.allow.datafolder) return client.close(403);
    //trigger the datafolder to load in case it isn't
    const request = new DataFolderRequest(
      result,
      statPath,
      pathname,
      settings.__serverTW,
      settings.datafolder,
      data.debugOutput
    );
    const { mount, folder } = request;
    const subpath = pathname.slice(mount.length);
    //event to give the client to the data folder
    const loadClient = () => {
      debug(-1, "ws-client-connect %s", mount);
      loadedFolders[mount].events.emit("ws-client-connect", client, request, subpath);
    };
    //if the data folder is still loading, we wait, otherwise give immediately
    if (Array.isArray(loadedFolders[mount].handler)) {
      loadedFolders[mount].events.once("ws-client-preload", loadClient);
    } else {
      loadClient();
    }
  } else {
    console.log("add client", pathname);

    client.addEventListener("message", event => {
      // console.log("message", event.data);
      debug(-3, "WS-MESSAGE %s", inspect(event.data));
      clientsList[pathname as string].forEach(e => {
        if (e !== client) e.send(event.data);
      });
    });

    client.addEventListener("error", event => {
      debug(-2, "WS-ERROR %s %s", pathname, event.type);
      let index = clientsList[pathname as string].indexOf(client);
      if (index > -1) clientsList[pathname as string].splice(index, 1);
      client.close();
    });

    client.addEventListener("close", event => {
      debug(-2, "WS-CLOSE %s %s %s", pathname, event.code, event.reason);
      let index = clientsList[pathname as string].indexOf(client);
      if (index > -1) clientsList[pathname as string].splice(index, 1);
    });

    if (!clientsList[pathname]) clientsList[pathname] = [];
    clientsList[pathname].push(client);
  }
}

declare const __non_webpack_require__: NodeRequire | undefined;
const nodeRequire =
  typeof __non_webpack_require__ !== "undefined" ? __non_webpack_require__ : require;

function loadDataFolderTiddlyWiki(
  request: DataFolderRequest
) {
  const { debugOutput, mount, folder, target, vars } = request;

  console.time("twboot-" + folder);

  const tw = nodeRequire(target + "/boot/boot.js").TiddlyWiki(
    nodeRequire(target + "/boot/bootprefix.js").bootprefix({
      packageInfo: nodeRequire(target + "/package.json"),
    })
  );

  tw.boot.argv = [folder];
  tw.preloadTiddler({
    text: "$protocol$//$host$" + mount + "/",
    title: "$:/config/tiddlyweb/host",
  });

  try {
    tw.boot.boot(() => {
      complete(null, tw);
    });
  } catch (err) {
    complete(err, null);
  }

  function complete(err, $tw) {
    console.timeEnd("twboot-" + folder);
    if (err) {
      return DataFolder.doError(debugOutput, mount, folder, err);
    }
    loadedFolders[mount].wiki = $tw.wiki;
    //we use $tw.modules.execute so that the module has its respective $tw variable.
    let Server: typeof TiddlyWikiServer;
    try {
      Server = $tw.modules.execute("$:/core/modules/server/server.js").Server;
    } catch (e) {
      console.log(mount, folder, e);
      return;
    }
    let server = new Server({
      wiki: $tw.wiki,
      variables: {
        "path-prefix": mount,
        "root-tiddler": "$:/core/save/all",
        gzip: "yes",
        ...vars,
      },
    });
    // server.TS_StateObject_Queue = [];
    // server.TS_Request_Queue = [];
    let queue: Record<string, StateObject> = {};
    let auth = new TiddlyServerAuthentication(server, (sym: symbol) => {
      let res = queue[sym as any];
      delete queue[sym as any];
      return res;
    });
    auth.init();
    server.authenticators.unshift(auth);
    //invoke the server start hook so plugins can extend the server or attach to the event handler
    $tw.hooks.invokeHook("th-server-command-post-start", server, loadedFolders[mount].events, "tiddlyserver");
    //set the request handler, indicating we are now ready to recieve requests
    const requests = loadedFolders[mount].pending;
    loadedFolders[mount].handler = (state: StateObject) => {
      //pretend to the handler like the path really has a trailing slash
      let req = new Object(state.req) as http.IncomingMessage & {
        tsstate: symbol;
      };
      req.url += state.url.pathname === mount && !state.url.pathname.endsWith("/") ? "/" : "";
      req.tsstate = Symbol("state object pointer");
      queue[req.tsstate as any] = state;
      server.requestHandler(req, state.res);
    };
    //send queued websocket clients to the event emitter
    loadedFolders[mount].events.emit("ws-client-preload");
    //send the queued requests to the handler
    requests.forEach(e => loadedFolders[mount].handler(e));
    loadedFolders[mount].pending = [];
  }
}

function loadDataFolderServer(
  target: string,
  vars: {}
) {
  return new Promise((resolve, reject) => {
    console.time("twboot-server");
    let _wiki = undefined;

    const tw = nodeRequire(target + "/boot/boot.js").TiddlyWiki(
      nodeRequire(target + "/boot/bootprefix.js").bootprefix({
        packageInfo: nodeRequire(target + "/package.json"),
      })
    );

    tw.boot.argv = [dirname + "/datafolder"];

    try {
      tw.boot.boot(() => resolve(tw));
    } catch (err) {
      console.timeEnd("twboot-server");
      console.log(err);
      console.log(err.stack);
      reject();
    }
  }).then(($tw: any) => {
    console.timeEnd("twboot-server");
    let Server: typeof TiddlyWikiServer;
    try {
      Server = $tw.modules.execute("$:/core/modules/server/server.js").Server;
    } catch (e) {
      console.log(e.stack || e);
      return Promise.reject();
    }
    let server = new Server({
      wiki: $tw.wiki,
      variables: {
        "path-prefix": "",
        "root-tiddler": "$:/core/save/all",
        "gzip": "yes",
        ...vars,
      },
    });
    let queue: Record<string, StateObject> = {};
    let auth = new TiddlyServerAuthentication(server, (sym: symbol) => {
      let res = queue[sym as any];
      delete queue[sym as any];
      return res;
    });
    auth.init();
    server.authenticators.unshift(auth);
    // $tw.syncadaptor = undefined;
    $tw.adaptorClass = undefined;
    $tw.modules.forEachModuleOfType("syncadaptor", function (title, module) {
      if (!$tw.adaptorClass && module.adaptorClass) {
        $tw.adaptorClass = module.adaptorClass;
      }
    });
    const cache = new $tw.Wiki();
    cache.addTiddler($tw.wiki.getTiddler("$:/core"));
    cache.addTiddler($tw.wiki.getTiddler("$:/plugins/tiddlywiki/codemirror"));
    return { server, $tw, queue, cache };
  });
}
function swapTiddlers(df: DataFolder, cache: any) {
  const swap = (title: string) => {
    if (df.wiki.tiddlerExists(title)) df.wiki.addTiddler(cache.getTiddler(title));
  };
  cache.allTitles().forEach(e => { swap(e); });
}
function loadDataFolder(
  request: DataFolderRequest
) {
  let { mount, folder, target } = request;
  let { server, queue, $tw, cache } = DataFolder.tiddlywiki[target];
  console.time("datafolder-" + folder);
  const df = loadedFolders[mount];

  // load the tiddlers into the wiki
  df.wiki = new $tw.Wiki();
  df.wiki.addTiddler({
    text: "$protocol$//$host$" + mount + "/",
    title: "$:/config/tiddlyweb/host",
  });
  df.wiki.wikiPath = folder;
  df.wiki.files = Object.create(null);
  const loader = new $tw.FileSystemLoader(df.wiki, []);
  loader.loadTiddlersNode();
  // Load tiddlers from the cache in order to save memory. Tiddlers 
  // are immutable, so any changes will not affect other wikis.
  swapTiddlers(df, cache);
  df.wiki.readPluginInfo();
  df.wiki.registerPluginTiddlers("plugin", undefined);
  df.wiki.unpackPluginTiddlers();
  // Setup the shims for different server-side plugins if required
  if (df.wiki.tiddlerExists("$:/plugins/tiddlywiki/filesystem") && $tw.adaptorClass) {
    df.syncadaptor = new $tw.adaptorClass(df);
    df.syncer = new $tw.Syncer({
      wiki: df.wiki,
      syncadaptor: df.syncadaptor
    });
  }
  //invoke the server start hook so plugins can extend the server or attach to the event handler
  $tw.hooks.invokeHook("th-server-command-post-start", server, loadedFolders[mount].events, "tiddlyserver-slim");
  loadedFolders[mount].events.emit("init-data-folder", [loadedFolders[mount]]);
  console.timeEnd("datafolder-" + folder);

  //set the request handler, indicating we are now ready to recieve requests
  const requests = loadedFolders[mount].pending;
  loadedFolders[mount].handler = (state: StateObject) => {
    //pretend to the handler like the path really has a trailing slash
    let req = new Object(state.req) as http.IncomingMessage & {
      tsstate: symbol;
      pathprefix: string;
    };
    req.url += state.url.pathname === mount && !state.url.pathname.endsWith("/") ? "/" : "";
    req.tsstate = Symbol("state object pointer");
    // req.pathprefix = mount;
    queue[req.tsstate as any] = state;
    //set the wiki and path prefix for each request
    server.wiki = loadedFolders[mount].wiki;
    server.variables["path-prefix"] = mount;
    server.requestHandler(req, state.res, {
      wiki: loadedFolders[mount].wiki,
      pathPrefix: mount
    });
    server.wiki = null;
    server.variables["path-prefix"] = "";
    // console.log("served request", req.url);
  };
  //send queued websocket clients to the event emitter
  loadedFolders[mount].events.emit("ws-client-preload");
  //send the queued requests to the handler
  requests.forEach(e => loadedFolders[mount].handler(e));
  loadedFolders[mount].pending = [];
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, state: TWState) => void;
interface TWState {
  pathprefix: any;
  params: string[];
  wiki: any,
  server: TiddlyWikiServer,
  urlInfo: UrlWithStringQuery,
  queryParameters: ParsedUrlQuery,
  allowAnon: boolean,
  authenticatedUsername: string,
  data: string | Buffer
}
interface Route {
  method: string,
  path: RegExp,
  handler: Handler,
  bodyFormat?: "stream" | "string" | "buffer"
}
declare class TiddlyWikiServer {
  wiki: any;
  routes: any[];
  addAuthenticator: any;
  authenticators: TiddlyServerAuthentication[];
  requestHandler: (request: http.IncomingMessage, response: http.ServerResponse, options?: any) => void;
  findMatchingRoute: (request: http.IncomingMessage, state: any) => Route;
  variables: Record<string, any>;
  constructor(...args: any[]);
}
class TiddlyServerAuthentication {
  /**
   *
   * @param server The server instance that instantiated this authenticator
   */
  constructor(private server: TiddlyWikiServer, retrieve: (sym: symbol) => StateObject) {
    //make sure nothing can access the state object!
    this.authenticateRequest = (request, response, state) => {
      let tsstate = retrieve(request.tsstate);
      if (!tsstate.authAccountKey && state.allowAnon) {
        return true;
      } else if (tsstate.authAccountKey) {
        state.authenticatedUsername = tsstate.username;
        return true;
      } else {
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
  /**
   * Returns true if the request is authenticated and
   * assigns the "authenticatedUsername" state variable.
   *
   * Returns false if the request couldn't be authenticated,
   * having sent an appropriate response to the browser
   */
  authenticateRequest: (
    request: http.IncomingMessage & { tsstate: symbol },
    response: http.ServerResponse,
    state
  ) => boolean;
}

// import { TreeStateObject } from "./tiddlyserver";