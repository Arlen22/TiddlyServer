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
import { handleAuthRoute, initAuthRoute } from "./auth-route";
import { checkCookieAuth } from "./cookies";
import { checkServerConfig } from "./interface-checker";
import { RequestEvent } from "./request-event";
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
import { StateObject } from "./state-object";
import { handleTiddlyServerRoute, init as initTiddlyServer } from "./tiddlyserver";

export { checkServerConfig, loadSettings, routes, libsReady };
const { Server: WebSocketServer } = WebSocket;

// global settings
Error.stackTraceLimit = Infinity;
console.debug = function () { }; //noop console debug;

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
    case "static": serveFolder(state, "/assets/static", path.join(state.settings.__assetsDir, "static")); break;
    case "icons": serveFolder(state, "/assets/icons", path.join(state.settings.__assetsDir, "icons")); break;
    case "tiddlywiki": serveFolder(state, "/assets/tiddlywiki", state.settings.__targetTW); break;
    default: state.throw(404);
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
  await libsodium.ready;

  let startup = new Startup(
    settingshttps,
    preflighter,
    settings,
    dryRun
  );

  let success = await startup.setupHosts();
  if (success === false) return eventer;

  eventer.emit("serverOpen", startup.servers, startup.hosts, !!settingshttps, dryRun);

  startup.printWelcomeMessage();

  if (dryRun) console.log("DRY RUN: No further processing is likely to happen");

  return eventer;
}
class Startup {
  public servers: (http.Server | https.Server)[]
  public bindWildcard: boolean
  public filterBindAddress: boolean
  public enableIPv6: boolean
  public port: number
  public log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
  public tester: (addr: string) => { usable: boolean; lastMatch: number }
  public localhostTester: (addr: string) => { usable: boolean; lastMatch: number }
  debug: (level: number, str: string | NodeJS.ErrnoException, ...args: any[]) => any;
  public hosts: string[]
  public isHttps: boolean
  constructor(
    public settingshttps: undefined | ((host: string) => https.ServerOptions),
    public preflighter: <T extends RequestEvent>(ev: T) => Promise<T>,
    public settings: ServerConfig,
    public dryRun: boolean
  ) {
    this.debug = StateObject.DebugLogger("STARTER").bind({
      debugOutput: RequestEvent.MakeDebugOutput(settings),
      settings,
    });
    this.tester = parseHostList([...settings.bindInfo.bindAddress, "-127.0.0.0/8"]);
    this.localhostTester = parseHostList(["127.0.0.0/8"]);

    const {
      bindWildcard,
      enableIPv6,
      filterBindAddress,
      bindAddress,
      _bindLocalhost,
      port,
      https: isHttps,
    } = settings.bindInfo;
    this.isHttps = isHttps;
    this.port = port;
    this.bindWildcard = bindWildcard;
    this.filterBindAddress = filterBindAddress;
    this.enableIPv6 = enableIPv6;
    if (settings.logging.logAccess !== false) {
      const logger = morgan({
        logFile: settings.logging.logAccess || undefined,
        logToConsole: !settings.logging.logAccess || settings.logging.logToConsoleAlso,
        logColorsToFile: settings.logging.logColorsToFile,
      });
      this.log = (req, res) => new Promise(resolve => logger(req, res, resolve));
    } else {
      this.log = (req, res) => Promise.resolve();
    }
    this.hosts = [];

    if (bindWildcard) {
      //bind to everything and filter elsewhere if needed
      this.hosts.push("0.0.0.0");
      if (enableIPv6) this.hosts.push("::");
    } else if (filterBindAddress) {
      //bind to all interfaces that match the specified addresses
      this.hosts.push(...this.getValidAddresses());
    } else {
      //bind to all specified addresses as specified
      this.hosts.push(...bindAddress);
    }
    if (_bindLocalhost) this.hosts.push("localhost");

    if (this.hosts.length === 0) { console.log(this.EmptyHostsWarning()); }
    this.servers = [];
    console.log("Creating servers as %s", typeof settingshttps === "function" ? "https" : "http");
    if (!settingshttps)
      console.log("Remember that any login credentials are being sent in the clear");

  }
  EmptyHostsWarning(
    // bindWildcard: boolean,
    // filterBindAddress: boolean,
    // _bindLocalhost: boolean,
    // enableIPv6: boolean,
    // bindAddress: string[]
  ): any {
    let { _bindLocalhost, bindAddress } = this.settings.bindInfo;
    return `"No IP addresses will be listened on. This is probably a mistake.
  bindWildcard is ${this.bindWildcard ? "true" : "false"}
  filterBindAddress is ${this.filterBindAddress ? "true" : "false"}
  _bindLocalhost is ${_bindLocalhost ? "true" : "false"}
  enableIPv6 is ${this.enableIPv6 ? "true" : "false"}
  bindAddress is ${JSON.stringify(bindAddress, null, 2)}
  `;
  }
  getValidAddresses() {
    let ifaces = networkInterfaces();
    return keys(networkInterfaces())
      .reduce((n: NetworkInterfaceInfo[], k) => n.concat(ifaces[k]), [])
      .filter(e =>
        (this.enableIPv6 && e.family === "IPv6")
        || (e.family === "IPv4" && (!this.filterBindAddress || this.tester(e.address).usable))
      ).map(e => e.address)
  }
  printWelcomeMessage() {
    console.log("Open your browser and type in one of the following:");
    console.log((this.bindWildcard ? this.getValidAddresses() : this.hosts)
      .map(e =>
        (this.isHttps ? "https" : "http")
        + "://" + e
        + ((this.isHttps && this.port === 443) ? "" : (!this.isHttps && this.port === 80) ? "" : ":" + this.port)
      ).join("\n")
    );
  }
  setupHosts() {
    send.mime.define(this.settings.directoryIndex.mimetypes);

    return Promise.all<void>(
      this.hosts.map(host => {
        let server: any;
        if (typeof this.settingshttps === "function") {
          try {
            server = https.createServer(this.settingshttps(host));
          } catch (e) {
            console.log("settingshttps function threw for host " + host);
            console.log(e);
            throw e;
          }
        } else {
          server = http.createServer();
        }
        this.addRequestHandlers(server, host);
        //this one we add here because it is related to the host property rather than just listening
        if (this.bindWildcard && this.filterBindAddress) {
          server.on("connection", socket => {
            if (!this.tester(socket.localAddress).usable && !this.localhostTester(socket.localAddress).usable)
              socket.end();
          });
        }
        this.servers.push(server);
        return new Promise(resolve => {
          this.dryRun
            ? resolve()
            : server.listen(this.port, host, undefined, () => {
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
  addRequestHandlers(
    server: https.Server | http.Server,
    iface: string
  ) {
    // const addListeners = () => {
    let closing = false;

    server.on("request", (req, res) => {
      this.requestHandler(req, res, iface).catch(err => {
        //catches any errors that happen inside the then statements
        this.debug(3, "Uncaught error in the request handler: " + (err.message || err.toString()));
        //if we have a stack, then print it
        if (err.stack) this.debug(3, err.stack);
      });
    });

    server.on("listening", () => {
      this.debug(1, "server %s listening", iface);
    });

    server.on("error", err => {
      this.debug(4, "server %s error: %s", iface, err.message);
      this.debug(4, "server %s stack: %s", iface, err.stack);
      server.close();
      eventer.emit("serverClose", iface);
    });

    server.on("close", () => {
      if (!closing) eventer.emit("serverClose", iface);
      this.debug(4, "server %s closed", iface);
      closing = true;
    });

    const wss = new WebSocketServer({ server });
    wss.on("connection", (client, request) =>
      this.websocketHandler(client, request, iface, this.settings, this.preflighter)
    );
    wss.on("error", error => {
      this.debug(-2, "WS-ERROR %s", inspect(error));
    });
  }
  async websocketHandler(
    client: WebSocket,
    request: http.IncomingMessage,
    iface: string,
    settings: ServerConfig,
    preflighter: (ev: RequestEvent) => Promise<RequestEvent>
  ) {
    //check host level permissions and the preflighter
    let ev = new RequestEvent(settings, request, iface, "client", client);

    let ev2 = await ev.requestHandlerHostLevelChecks(preflighter);

    if (ev2.handled) return;

    if (!ev2.allow.websockets) client.close(403);
    else eventer.emit("websocket-connection", ev);
  }
  async requestHandler(
    request: IncomingMessage,
    response: ServerResponse,
    iface: string,
  ) {
    await this.log(request, response);

    let ev1 = new RequestEvent(this.settings, request, iface, "response", response);

    //send it to the preflighter
    let ev2 = await ev1.requestHandlerHostLevelChecks(this.preflighter);
    // check if the preflighter handled it
    if (ev2.handled) return;

    const key = ev2.url.split('/')[1];
    //check for static routes
    if (routes[key]) routes[key](new StateObject(eventer, ev2));
    //otherwise forward to TiddlyServer
    else handleTiddlyServerRoute(ev2, eventer);
  }
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
