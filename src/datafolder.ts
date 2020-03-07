import {
  PathResolverResult,
  RequestEventWS,
  resolvePath,
  ServerConfig,
  ServerEventEmitter,
  StateObject,
  statWalkPath,
  tryParseJSON,
} from "./server-types";

import * as path from "path";
import * as http from "http";
import * as fs from "fs";

import { EventEmitter } from "events";
import { parse } from "url";
import { inspect, promisify } from "util";
import { WikiInfo } from "./boot-startup-types";
import * as WebSocket from "ws";

interface Records<T> {
  [k: string]: T;
}

const loadedFolders: Records<FolderData> = {};
const otherSocketPaths: Records<WebSocket[]> = {};
const clientsList: Records<WebSocket[]> = {};
let eventer: ServerEventEmitter;

export function init(e: ServerEventEmitter) {
  eventer = e;
  eventer.on("settings", function(set: ServerConfig) {});
  eventer.on("settingsChanged", keys => {});
  eventer.on("websocket-connection", async function(data: RequestEventWS) {
    const { request, client, settings, treeHostIndex, debugOutput } = data;
    const debug = StateObject.DebugLogger("WEBSOCK").bind({
      settings,
      debugOutput,
    });
    const root = settings.tree[treeHostIndex].$mount;
    let pathname: string | undefined = parse(request.url as string).pathname; // new URL(request.url as string);
    if (!pathname) {
      console.error("[ERROR]: parsing pathname");
      return;
    }

    let result: PathResolverResult | undefined = resolvePath(
      pathname.split("/"),
      root
    );
    if (!result) return client.close(404);

    let statPath = await statWalkPath(result);
    //if this is a datafolder, we hand the client and request off directly to it
    //otherwise we stick it in its own section
    if (statPath.itemtype === "datafolder") {
      const target = settings.__targetTW;
      //trigger the datafolder to load in case it isn't
      const { mount, folder } = loadDataFolderTrigger(
        result,
        statPath,
        pathname,
        "",
        target,
        settings.datafolder
      );
      const subpath = pathname.slice(mount.length);
      //event to give the client to the data folder
      const loadClient = () => {
        debug(-1, "ws-client-connect %s", mount);
        loadedFolders[mount].events.emit(
          "ws-client-connect",
          client,
          request,
          subpath
        );
      };
      //if the data folder is still loading, we wait, otherwise give immediately
      if (Array.isArray(loadedFolders[mount].handler)) {
        loadedFolders[mount].events.once("ws-client-preload", loadClient);
      } else {
        loadClient();
      }
    } else {
      client.addEventListener("message", event => {
        console.log("message", event);
        debug(-3, "WS-MESSAGE %s", inspect(event));
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
  });
}

type FolderData = {
  mount: string;
  folder: string;
  handler: ((state: StateObject) => void) | StateObject[];
  events: EventEmitter;
};

function quickArrayCheck(obj: any): obj is Array<any> {
  return typeof obj.length === "number";
}

export function handleDataFolderRequest(
  result: PathResolverResult,
  state: StateObject
) {
  const target = state.settings.__targetTW;

  const { mount, folder } = loadDataFolderTrigger(
    result,
    state.statPath,
    state.url.pathname,
    (state.url.query.reload as any) || "",
    target,
    state.settings.datafolder
  );

  const isFullpath = result.filepathPortion.length === state.statPath.index;
  //set the trailing slash correctly if this is the actual page load
  //redirect ?reload requests to the same, to prevent it being
  //reloaded multiple times for the same page load.
  if (
    (isFullpath &&
      state.pathOptions.noTrailingSlash !==
        !state.url.pathname.endsWith("/")) ||
    state.url.query.reload
  ) {
    let redirect = mount + (!state.pathOptions.noTrailingSlash ? "/" : "");
    state
      .respond(302, "", {
        Location: redirect,
      })
      .empty();
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
function loadDataFolderTrigger(
  result,
  statPath,
  pathname: string,
  reload: "true" | "force" | "",
  target: string,
  vars: {}
) {
  let filepathPrefix = result.filepathPortion
    .slice(0, statPath.index)
    .join("/");
  //get the tree path, and add the file path (none if the tree path is a datafolder)
  let fullPrefix = ["", result.treepathPortion.join("/")];
  if (statPath.index > 0) fullPrefix.push(filepathPrefix);
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
      events: new EventEmitter(),
      handler: [],
    };
    loadDataFolderType(mount, folder, reload, target, vars);
    // loadTiddlyServerAdapter(prefixURI, folder, state.url.query.reload);
    // loadTiddlyWiki(prefixURI, folder);
  }

  return { mount, folder };
}

function loadDataFolderType(
  mount: string,
  folder: string,
  reload: string,
  target: string,
  vars: {}
) {
  promisify(fs.readFile)(path.join(folder, "tiddlywiki.info"), "utf8").then(
    data => {
      const wikiInfo = tryParseJSON<WikiInfo>(data, e => {
        throw e;
      });
      if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
        loadDataFolderTiddlyWiki(mount, folder, reload, target, vars);
      } else if (wikiInfo.type === "tiddlyserver") {
        // loadTiddlyServerAdapter(mount, folder, reload)
      }
    }
  );
}
declare const __non_webpack_require__: NodeRequire | undefined;
const nodeRequire =
  typeof __non_webpack_require__ !== "undefined"
    ? __non_webpack_require__
    : require;

function loadDataFolderTiddlyWiki(
  mount: string,
  folder: string,
  reload: string,
  target: string,
  vars: {}
) {
  console.time("twboot-" + folder);
  let _wiki = undefined;

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
      return console.log(mount, folder, err);
    }

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
        // "root-tiddler": "$:/core/save/all-external-js"
        ...vars,
      },
    });
    // server.TS_StateObject_Queue = [];
    // server.TS_Request_Queue = [];
    let queue: Record<symbol, StateObject> = {};
    let auth = new TiddlyServerAuthentication(server, (sym: symbol) => {
      let res = queue[sym];
      delete queue[sym];
      return res;
    });
    auth.init();
    server.authenticators.unshift(auth);
    //invoke the server start hook so plugins can extend the server or attach to the event handler
    $tw.hooks.invokeHook(
      "th-server-command-post-start",
      server,
      loadedFolders[mount].events,
      "tiddlyserver"
    );
    //add the event emitter to the $tw variable
    $tw.wss = loadedFolders[mount].events;
    //set the request handler, indicating we are now ready to recieve requests
    const requests = loadedFolders[mount].handler as StateObject[];
    loadedFolders[mount].handler = (state: StateObject) => {
      //pretend to the handler like the path really has a trailing slash
      let req = new Object(state.req) as http.IncomingMessage & {
        tsstate: symbol;
      };
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
    requests.forEach(e => (loadedFolders[mount].handler as Function)(e));
  }
}

function doError(debug, mount, folder, err) {
  debug(3, "error starting %s at %s: %s", mount, folder, err.stack);
  const requests = loadedFolders[mount].handler as any[];
  loadedFolders[mount] = {
    handler: function(state: StateObject) {
      state
        .respond(500, "TW5 data folder failed")
        .string(
          "The Tiddlywiki data folder failed to load. The error has been logged to the " +
            "terminal with priority level 2. " +
            "To try again, use ?reload=true after making any necessary corrections."
        );
    },
  } as any;
  requests.forEach(([req, res]) => {
    (loadedFolders[mount] as { handler: any }).handler(req, res);
  });
}
declare class TiddlyWikiServer {
  // TS_StateObject_Queue: StateObject[];
  // TS_Request_Queue: http.IncomingMessage[];
  addAuthenticator: any;
  authenticators: TiddlyServerAuthentication[];
  requestHandler: (
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) => void;
  constructor(...args: any[]);
}
class TiddlyServerAuthentication {
  /**
   *
   * @param server The server instance that instantiated this authenticator
   */
  constructor(
    private server: TiddlyWikiServer,
    retrieve: (sym: symbol) => StateObject
  ) {
    //make sure nothing can access the state object!
    this.authenticateRequest = (request, response, state) => {
      let tsstate = retrieve(request.tsstate);
      if (!tsstate.authAccountsKey && state.allowAnon) {
        return true;
      } else if (tsstate.authAccountsKey) {
        state.authenticatedUsername = tsstate.username;
        return true;
      } else {
        //The wiki itself may specify that anonymous users cannot access it
        tsstate.throwReason(
          403,
          "Unauthenticated users cannot access this wiki"
        );
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
  //  {
  // 	// let index = this.server.TS_Request_Queue.indexOf(request);
  // 	let tsstate = request.tsstate;
  // 	if (!tsstate.authAccountsKey && state.allowAnon) {
  // 		return true;
  // 	} else if (tsstate.authAccountsKey) {
  // 		state.authenticatedUsername = tsstate.username;
  // 		return true;
  // 	} else {
  // 		//The wiki itself may specify that anonymous users cannot access it
  // 		tsstate.throwReason(403, "Unauthenticated users cannot access this wiki");
  // 		return false;
  // 	}
  // }
}
