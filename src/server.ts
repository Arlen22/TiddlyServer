import { EventEmitter } from "events";
import * as fs from "fs";
import * as http from "http";
import { IncomingMessage, ServerResponse } from "http";
import * as https from "https";
import { NetworkInterfaceInfo, networkInterfaces } from "os";
import * as path from "path";
import { Writable } from "stream";
import { format, inspect } from "util";
import * as send from "send";
import * as libsodium from "libsodium-wrappers";
import * as WebSocket from "ws";
import { handler as morgan } from "./logger";
import { handleAuthRoute, initAuthRoute } from "./authRoute";
import { checkCookieAuth } from "./cookies";
import { checkServerConfig } from "./interfacechecker";
import { RequestEvent } from "./RequestEvent";
import {
  init as initServerTypes,
  keys,
  loadSettings,
  parseHostList,
  serveFile,
  serveFolder,
  ServerConfig,
  ServerEventEmitter,
  testAddress,
} from "./server-types";
import { StateObject } from "./StateObject";
import { handleTiddlyServerRoute, init as initTiddlyServer } from "./tiddlyserver";

export { checkServerConfig, loadSettings, routes, libsReady };
const { Server: WebSocketServer } = WebSocket;

// global settings
Error.stackTraceLimit = Infinity;
console.debug = function() {}; //noop console debug;

// this is the internal communicator
export const eventer = new EventEmitter() as ServerEventEmitter;

// external flags combine here
namespace ENV {
  export let disableLocalHost: boolean = false;
}

initServerTypes(eventer);
initTiddlyServer(eventer);
initAuthRoute(eventer);

eventer.on("settings", set => {
  if (checkServerConfig(set)[0] !== true) throw "ServerConfig did not pass validator";
});

const routes: Record<string, (state: StateObject) => void> = {
  admin: state => handleAdminRoute(state),
  assets: state => handleAssetsRoute(state),
  "favicon.ico": state => serveFile(state, "favicon.ico", state.settings.__assetsDir),
  "directory.css": state => serveFile(state, "directory.css", state.settings.__assetsDir),
};

function handleAssetsRoute(state: StateObject) {
  switch (state.path[2]) {
    case "static":
      serveFolder(state, "/assets/static", path.join(state.settings.__assetsDir, "static"));
      break;
    case "icons":
      serveFolder(state, "/assets/icons", path.join(state.settings.__assetsDir, "icons"));
      break;
    case "tiddlywiki":
      serveFolder(state, "/assets/tiddlywiki", state.settings.__targetTW);
      break;
    default:
      state.throw(404);
  }
}

function handleAdminRoute(state: StateObject) {
  switch (state.path[2]) {
    case "authenticate":
      handleAuthRoute(state);
      break;
    default:
      state.throw(404);
  }
}

const libsReady = Promise.all([libsodium.ready]);

declare function preflighterFunc<T extends RequestEvent>(ev: T): Promise<T>;
// declare function preflighterFunc(ev: RequestEventHTTP): Promise<RequestEventHTTP>;

// const debug = console.log;
/**
 *  4 - Errors that require the process to exit for restart
 *  3 - Major errors that are handled and do not require a server restart
 *  2 - Warnings or errors that do not alter the program flow but need to be marked (minimum for status 500)
 *  1 - Info - Most startup messages
 *  0 - Normal debug messages and all software and request-side error messages
 * -1 - Detailed debug messages from high level apis
 * -2 - Response status messages and error response data
 * -3 - Request and response data for all messages (verbose)
 * -4 - Protocol details and full data dump (such as encryption steps and keys)
 */
type DebugLogger = (level: number, format: string, ...args: string[]) => void;
/**
 * All this function does is create the servers and start listening. The settings object is emitted
 * on the eventer and addListeners is called to add the listeners to each server before
 * it is started. If another project wanted to provide its own server instances, it should
 * first emit the settings event with a valid settings object as the only argument, then call
 * addListeners with each server instance, then call listen on each instance.
 *
 * @export
 * @param {<T extends RequestEvent>(ev: T) => Promise<T>} preflighter
 * @param {(SecureServerOptions | ((host: string) => https.ServerOptions)) | undefined} settingshttps
 * @param {boolean} dryRun Creates the servers and sets everything up but does not start listening
 * Either an object containing the settings.server.https from settings.json or a function that
 * takes the host string and returns an https.createServer options object. Undefined if not using https.
 * @returns
 */
export async function initServer({
  settings,
  preflighter,
  settingshttps,
  dryRun,
}: {
  settings: ServerConfig;
  preflighter: <T extends RequestEvent>(ev: T) => Promise<T>;
  settingshttps: ((host: string) => https.ServerOptions) | undefined;
  dryRun: boolean;
}) {
  const debug = StateObject.DebugLogger("STARTER").bind({
    debugOutput: RequestEvent.MakeDebugOutput(settings),
    settings,
  });

  // if (!settings) throw "The settings object must be emitted on eventer before starting the server";
  const hosts: string[] = [];
  const {
    bindWildcard,
    enableIPv6,
    filterBindAddress,
    bindAddress,
    _bindLocalhost,
    port,
    https: isHttps,
  } = settings.bindInfo;
  const tester = parseHostList([...settings.bindInfo.bindAddress, "-127.0.0.0/8"]);
  const localhostTester = parseHostList(["127.0.0.0/8"]);

  await libsodium.ready;

  send.mime.define(settings.directoryIndex.mimetypes);

  //setup the logging handler
  let log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
  if (settings.logging.logAccess !== false) {
    const logger = morgan({
      logFile: settings.logging.logAccess || undefined,
      logToConsole: !settings.logging.logAccess || settings.logging.logToConsoleAlso,
      logColorsToFile: settings.logging.logColorsToFile,
    });
    log = (req, res) => new Promise(resolve => logger(req, res, resolve));
  } else {
    log = (req, res) => Promise.resolve();
  }

  if (bindWildcard) {
    //bind to everything and filter elsewhere if needed
    hosts.push("0.0.0.0");
    if (enableIPv6) hosts.push("::");
  } else if (filterBindAddress) {
    //bind to all interfaces that match the specified addresses
    let ifaces = networkInterfaces();
    let addresses = Object.keys(ifaces)
      .reduce((n, k) => n.concat(ifaces[k]), [] as NetworkInterfaceInfo[])
      .filter(e => enableIPv6 || (e.family === "IPv4" && tester(e.address).usable))
      .map(e => e.address);
    hosts.push(...addresses);
  } else {
    //bind to all specified addresses
    hosts.push(...bindAddress);
  }
  if (_bindLocalhost) hosts.push("localhost");

  if (hosts.length === 0) {
    console.log(
      EmptyHostsWarning(bindWildcard, filterBindAddress, _bindLocalhost, enableIPv6, bindAddress)
    );
  }
  let servers: (http.Server | https.Server)[] = [];
  console.log("Creating servers as %s", typeof settingshttps === "function" ? "https" : "http");
  if (!settingshttps)
    console.log("Remember that any login credentials are being sent in the clear");

  let success = await setupHosts(
    hosts,
    settingshttps,
    preflighter,
    settings,
    log,
    bindWildcard,
    filterBindAddress,
    tester,
    localhostTester,
    servers,
    dryRun,
    port,
    debug
  );

  if (success === false) return eventer;
  // .then(() => {
  eventer.emit("serverOpen", servers, hosts, !!settingshttps, dryRun);
  let ifaces = networkInterfaces();
  console.log("Open your browser and type in one of the following:");
  console.log(
    (bindWildcard
      ? keys(ifaces)
          .reduce((n: NetworkInterfaceInfo[], k) => n.concat(ifaces[k]), [])
          .filter(
            e =>
              (enableIPv6 && e.family === "IPv6") ||
              (e.family === "IPv4" && (!filterBindAddress || tester(e.address).usable))
          )
          .map(e => e.address)
      : hosts
    )
      .map(e => (isHttps ? "https" : "http") + "://" + e + ":" + port)
      .join("\n")
  );

  if (dryRun) console.log("DRY RUN: No further processing is likely to happen");
  // }, (x) => {
  // console.log("Error thrown while starting server");
  // console.log(x);
  // });

  return eventer;
}
function setupHosts(
  hosts: string[],
  settingshttps: undefined | ((host: string) => https.ServerOptions),
  preflighter: <T extends RequestEvent>(ev: T) => Promise<T>,
  settings: ServerConfig,
  log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>,
  bindWildcard: boolean,
  filterBindAddress: boolean,
  tester: (addr: string) => { usable: boolean; lastMatch: number },
  localhostTester: (addr: string) => { usable: boolean; lastMatch: number },
  servers: (http.Server | https.Server)[],
  dryRun: boolean,
  port: number,
  debug: any
) {
  return Promise.all<void>(
    hosts.map(host => {
      let server: any;
      if (typeof settingshttps === "function") {
        try {
          server = https.createServer(settingshttps(host));
        } catch (e) {
          console.log("settingshttps function threw for host " + host);
          console.log(e);
          throw e;
        }
      } else {
        server = http.createServer();
      }
      addRequestHandlers(server, host, preflighter, settings, log, debug);
      //this one we add here because it is related to the host property rather than just listening
      if (bindWildcard && filterBindAddress) {
        server.on("connection", socket => {
          if (!tester(socket.localAddress).usable && !localhostTester(socket.localAddress).usable)
            socket.end();
        });
      }
      servers.push(server);
      return new Promise(resolve => {
        dryRun
          ? resolve()
          : server.listen(port, host, undefined, () => {
              resolve();
            });
      });
    })
  ).catch(x => {
    console.log("Error thrown while starting server");
    console.log(x);
    return false;
  });
}

function EmptyHostsWarning(
  bindWildcard: boolean,
  filterBindAddress: boolean,
  _bindLocalhost: boolean,
  enableIPv6: boolean,
  bindAddress: string[]
): any {
  return `"No IP addresses will be listened on. This is probably a mistake.
bindWildcard is ${bindWildcard ? "true" : "false"}
filterBindAddress is ${filterBindAddress ? "true" : "false"}
_bindLocalhost is ${_bindLocalhost ? "true" : "false"}
enableIPv6 is ${enableIPv6 ? "true" : "false"}
bindAddress is ${JSON.stringify(bindAddress, null, 2)}
`;
}
/**
 * Adds all the listeners required for tiddlyserver to operate.
 *
 * @export
 * @param {(https.Server | http.Server)} server The server instance to initialize
 * @param {string} iface A marker string which is only used for certain debug messages and
 * is passed into the preflighter as `ev.iface`.
 * @param {*} preflighter A preflighter function which may modify data about the request before
 * it is handed off to the router for processing.
 */
export function addRequestHandlers(
  server: https.Server | http.Server,
  iface: string,
  preflighter: typeof preflighterFunc,
  settings: ServerConfig,
  log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>,
  debug: DebugLogger
) {
  // const addListeners = () => {
  let closing = false;

  server.on("request", (req, res) => {
    requestHandler(req, res, iface, preflighter, log, settings).catch(err => {
      //catches any errors that happen inside the then statements
      debug(3, "Uncaught error in the request handler: " + (err.message || err.toString()));
      //if we have a stack, then print it
      if (err.stack) debug(3, err.stack);
    });
  });

  server.on("listening", () => {
    debug(1, "server %s listening", iface);
  });

  server.on("error", err => {
    debug(4, "server %s error: %s", iface, err.message);
    debug(4, "server %s stack: %s", iface, err.stack);
    server.close();
    eventer.emit("serverClose", iface);
  });

  server.on("close", () => {
    if (!closing) eventer.emit("serverClose", iface);
    debug(4, "server %s closed", iface);
    closing = true;
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (client, request) =>
    websocketHandler(client, request, iface, settings, preflighter)
  );
  wss.on("error", error => {
    debug(-2, "WS-ERROR %s", inspect(error));
  });
}

async function websocketHandler(
  client: WebSocket,
  request: http.IncomingMessage,
  iface: string,
  settings: ServerConfig,
  preflighter: (ev: RequestEvent) => Promise<RequestEvent>
) {
  // return async () => {
  let host = request.headers.host;
  let addr = request.socket.localAddress;
  //check host level permissions and the preflighter
  let ev = new RequestEvent(settings, request, { host, addr, iface }, "client", client);

  let ev2 = await ev.requestHandlerHostLevelChecks(preflighter);

  if (ev2.handled) return;

  // we give the preflighter the option to handle the websocket on its own
  if (!settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey].websockets)
    client.close();
  else eventer.emit("websocket-connection", ev);
}
async function requestHandler(
  request: IncomingMessage,
  response: ServerResponse,
  iface: string,
  preflighter: undefined | typeof preflighterFunc,
  log: { (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> },
  settings: ServerConfig
  // debug: DebugLogger
) {
  let host = request.headers.host;
  let addr = request.socket.localAddress;

  await log(request, response);

  let ev1 = new RequestEvent(settings, request, { host, addr, iface }, "response", response);

  //send it to the preflighter
  let ev2 = await ev1.requestHandlerHostLevelChecks(preflighter); 
  // }).then(ev => {
  // check if the preflighter handled it
  if (ev2.handled) return;
  //create the state object
  const state = new StateObject(eventer, ev2);
  //check for static routes
  const route = routes[state.path[1]];
  //if so, handle it
  if (route) route(state);
  //otherwise forward to TiddlyServer
  else handleTiddlyServerRoute(state);
}
// const errLog = DebugLogger('STA-ERR');
eventer.on("stateError", state => {
  if (state.doneMessage.length > 0)
    StateObject.DebugLogger("STA-ERR").call(state, 2, state.doneMessage.join("\n"));
  debugger;
});
eventer.on("stateDebug", state => {
  if (state.doneMessage.length > 0)
    StateObject.DebugLogger("STA-DBG").call(state, -2, state.doneMessage.join("\n"));
});

function handleBasicAuth(
  state: StateObject,
  settings: { username: string; password: string }
): boolean {
  //check authentication and do sanity/security checks
  //https://github.com/hueniverse/iron
  //auth headers =====================
  if (!settings.username && !settings.password) return true;
  const first = (header?: string | string[]) => (Array.isArray(header) ? header[0] : header);
  if (!state.req.headers["authorization"]) {
    StateObject.DebugLogger("AUTH   ").call(state, -2, "authorization required");
    state
      .respond(401, "", {
        "WWW-Authenticate": 'Basic realm="TiddlyServer"',
        "Content-Type": "text/plain",
      })
      .empty();
    return false;
  }
  StateObject.DebugLogger("AUTH   ").call(state, -3, "authorization requested");
  var header = first(state.req.headers["authorization"]) || "", // get the header
    token = header.split(/\s+/).pop() || "", // and the encoded auth token
    auth = new Buffer(token, "base64").toString(), // convert from base64
    parts = auth.split(/:/), // split on colon
    username = parts[0],
    password = parts[1];
  if (username !== settings.username || password !== settings.password) {
    StateObject.DebugLogger("AUTH   ").call(
      state,
      -2,
      "authorization invalid - UN:%s - PW:%s",
      username,
      password
    );
    state.throwReason(401, "Invalid username or password");
    return false;
  }
  StateObject.DebugLogger("AUTH   ").call(state, -3, "authorization successful");
  return true;
}
