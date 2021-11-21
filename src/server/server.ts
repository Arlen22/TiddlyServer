// import { EventEmitter } from "events";
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
import { handleAuthRoute } from "./auth-route";
import { checkCookieAuth } from "./cookies";
import { checkServerConfig, generateSchema } from "./interface-checker";
import { RequestEvent } from "./request-event";
import { Observable, Subject, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import {
  parseHostList,
  serveFile,
  serveFolder,
  ServerConfig,
  ServerEventEmitter,
  testAddress,
  ServerConfigSchema,
  ServerConfig_AccessOptions,
} from "./server-types";
import { loadSettings } from "./utils-config";
import { keys } from "./utils-functions";
import { StateObject } from "./state-object";
import { handleTreeRoute } from "./tiddlyserver";
import { EventEmitter } from "./event-emitter-types";
import { Socket } from "net";
import { ServerConfig_Controller } from "./server-config";
export { checkServerConfig, generateSchema, loadSettings, libsReady };
const { Server: WebSocketServer } = WebSocket;

// global settings
Error.stackTraceLimit = Infinity;
console.debug = function () { }; //noop console debug;

// this is the internal communicator
// export const eventer = new EventEmitter() as ServerEventEmitter;

// external flags combine here
namespace ENV {
  export let disableLocalHost: boolean = false;
}

interface ListenerEvents {
  listening?: ReturnType<http.Server["address"]>,
  request?: { request: IncomingMessage, response: ServerResponse },
  socket?: { client: WebSocket, request: IncomingMessage },
  error?:
  | { type: "server", error: NodeJS.ErrnoException }
  | { type: "wsServer", error: Error }
  | { type: "connection", error: Error, socket: Socket }
  | { type: "websocket", error: Error, client: WebSocket }
  close?: true,
  sender: Listener
}

interface MainServerEvents {
  close?: { force: boolean }
}

const libsReady = Promise.all([libsodium.ready]);

declare function preflighterFunc<T extends RequestEvent>(ev: T): Promise<T>;

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

  Controller.handleSettings(settings);

  if (checkServerConfig(settings)[0] !== true)
    throw "ServerConfig did not pass validator";

  await libsodium.ready;

  let startup = new MainServer(settingshttps, preflighter, settings, dryRun);

  let success = await startup.setupHosts();
  if (success === false) return [false, startup] as const;

  startup.eventer.emit("serverOpen", startup.servers, startup.hosts, !!settingshttps, dryRun);
  startup.printWelcomeMessage();
  startup.disposer.add(() => {

  });
  Controller.handleServer(startup);

  if (dryRun) console.log("DRY RUN: No further processing is likely to happen");

  return [true, startup] as const;
}

export class MainServer {

  servers: Listener[]
  bindWildcard: boolean
  filterBindAddress: boolean
  enableIPv6: boolean
  port: number
  log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
  tester: (addr: string) => { usable: boolean; lastMatch: number }
  localhostTester: (addr: string) => { usable: boolean; lastMatch: number }
  debug: (level: number, str: string | NodeJS.ErrnoException, ...args: any[]) => any;
  hosts: string[]
  isHttps: boolean
  events = new Subject<ListenerEvents>();
  command = new Subject<MainServerEvents>();
  disposer = new Subscription();
  debugOutput: Writable;

  constructor(
    public settingshttps: undefined | ((host: string) => https.ServerOptions),
    public preflighter: <T extends RequestEvent>(ev: T) => Promise<T>,
    public settings: ServerConfig,
    public dryRun: boolean
  ) {
    this.eventer.emit("settings", settings);
    this.debugOutput = RequestEvent.MakeDebugOutput(settings);
    this.debug = StateObject.DebugLogger("STARTER").bind(this);

    this.tester = parseHostList([...settings.bindInfo.bindAddress, "-127.0.0.0/8"]);
    this.localhostTester = parseHostList(["127.0.0.0/8"]);

    this.isHttps = settings.bindInfo.https;
    this.port = settings.bindInfo.port;
    this.bindWildcard = settings.bindInfo.bindWildcard;
    this.filterBindAddress = settings.bindInfo.filterBindAddress;
    this.enableIPv6 = settings.bindInfo.enableIPv6;

    const logger = morgan({ stream: process.stdout });
    this.log = (req, res) => new Promise(resolve => logger(req, res, resolve));

    this.eventer.on("stateError", this.stateError);
    this.eventer.on("stateDebug", this.stateDebug);

    this.disposer.add(() => {
      this.eventer.removeListener("stateError", this.stateError);
      this.eventer.removeListener("stateDebug", this.stateDebug);
    });

    this.subscribeEventsHandler();

    this.hosts = [];

    if (settings.bindInfo.bindWildcard) {
      //bind to everything and filter elsewhere if needed
      this.hosts.push("0.0.0.0");
      if (settings.bindInfo.enableIPv6) this.hosts.push("::");
    } else if (settings.bindInfo.filterBindAddress) {
      //bind to all interfaces that match the specified addresses
      this.hosts.push(...this.getValidAddresses());
    } else {
      //bind to all specified addresses as specified
      this.hosts.push(...settings.bindInfo.bindAddress);
    }
    if (settings.bindInfo._bindLocalhost) this.hosts.push("localhost");

    if (this.hosts.length === 0) { console.log(this.EmptyHostsWarning()); }
    this.servers = [];
    console.log("Creating servers as %s", typeof settingshttps === "function" ? "https" : "http");
    if (!settingshttps)
      console.log("Remember that any login credentials are being sent in the clear");

  }
  EmptyHostsWarning(): string {
    let { _bindLocalhost, bindAddress } = this.settings.bindInfo;
    return `"No IP addresses will be listened on. This is probably a mistake.
  bindWildcard is ${this.bindWildcard ? "true" : "false"}
  filterBindAddress is ${this.filterBindAddress ? "true" : "false"}
  _bindLocalhost is ${_bindLocalhost ? "true" : "false"}
  enableIPv6 is ${this.enableIPv6 ? "true" : "false"}
  bindAddress is ${JSON.stringify(bindAddress, null, 2)}
  `;
  }
  stateError = (state: StateObject) => {
    if (state.doneMessage.length > 0)
      StateObject.DebugLogger("STA-ERR").call(state, 2, state.doneMessage.join("\n"));
    debugger;
  };
  stateDebug = (state: StateObject) => {
    if (state.doneMessage.length > 0)
      StateObject.DebugLogger("STA-DBG").call(state, -2, state.doneMessage.join("\n"));
  };
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
      this.hosts.map(async (host) => {
        let server: http.Server | https.Server;
        if (typeof this.settingshttps === "function") {
          try {
            server = https.createServer(this.settingshttps(host));
          } catch (e) {
            console.log("settingshttps function threw for host " + host);
            console.log(e);
            return Promise.reject<void>(e);
          }
        } else {
          server = http.createServer();
        }
        if (this.bindWildcard && this.filterBindAddress) {
          //this one we add here because it is related to the host property rather than just listening
          server.on("connection", socket => {
            if (!this.tester(socket.localAddress).usable && !this.localhostTester(socket.localAddress).usable) socket.destroy();
          });
        }
        let listener = new Listener(this.debugOutput, this.events, this.command.asObservable(), host, server as any);
        this.servers.push(listener);
        !this.dryRun && await listener.listen(this.port, host);
      })
    ).then(() => true).catch(x => {
      console.log("Error thrown while starting server");
      console.log(x);
      return false;
    });
  }
  close(force: boolean) {
    this.command.next({ close: { force } });
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
  subscribeEventsHandler() {
    let subs = this.events.asObservable().subscribe(async e => {

      let { iface } = e.sender;
      if (e.close) {
        this.debug(4, "server %s closed", iface);
        if (this.servers.every(e => e.closed))
          this.disposer.unsubscribe();
      } else if (e.listening) {
        this.debug(1, "server %s listening", iface);
      } else if (e.request) {
        let { request, response } = e.request;
        this.requestHandler(request, response, iface).catch(err => {
          //catches any errors that happen inside the then statements
          this.debug(3, "Uncaught error in the request handler: " + (err.message || err.toString()));
          //if we have a stack, then print it
          if (err.stack) this.debug(3, err.stack);
        });
      } else if (e.socket) {
        let { client, request } = e.socket;
        this.websocketHandler(client, request, iface);
      } else if (e.error) {
        if (e.error.type === "server") {
          let err = e.error.error;
          if (err.code === "EADDRNOTAVAIL") {
            this.debug(4, "server %s error: %s", iface, err.message);
            this.debug(4, "server %s could not be started. Continuing with the others", iface);
          } else {
            this.debug(4, "server %s error: %s", iface, err.message);
            this.debug(4, "server %s stack: %s", iface, err.stack);
            this.command.next({ close: { force: false } });
            this.eventer.emit("serverClose", iface);
          }
        } else if (e.error.type === "wsServer") {
          this.debug(-2, "WS-ERROR %s", inspect(e.error.error));
        }
      } else {

      }
    });
    this.disposer.add(subs);
  }
  async websocketHandler(
    client: WebSocket,
    request: http.IncomingMessage,
    iface: string,
  ) {
    //check host level permissions and the preflighter
    let ev = new RequestEvent(this.settings, request, iface, "client", client);
    let ev2 = await ev.requestHandlerHostLevelChecks(this.preflighter);
    if (ev2.handled) return;
    if (!ev2.allow.websockets) client.close(403);
    else this.eventer.emit("websocket-connection", ev);
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
    if (MainServer.routes[key]) MainServer.routes[key](new StateObject(this.eventer, ev2));
    //otherwise forward to TiddlyServer
    else handleTreeRoute(ev2, this.eventer);
  }
  eventer = new EventEmitter() as ServerEventEmitter;
  static routes: Record<string, (state: StateObject) => void> = {
    admin: state => MainServer.handleAdminRoute(state),
    assets: state => MainServer.handleAssetsRoute(state),
    "favicon.ico": state => serveFile(state, "favicon.ico", state.settings.__assetsDir),
    "directory.css": state => serveFile(state, "directory.css", state.settings.__assetsDir),
  };

  static handleAssetsRoute(state: StateObject) {
    switch (state.path[2]) {
      case "static": serveFolder(state, "/assets/static", path.join(state.settings.__assetsDir, "static")); break;
      case "icons": serveFolder(state, "/assets/icons", path.join(state.settings.__assetsDir, "icons")); break;
      case "tiddlywiki": serveFolder(state, "/assets/tiddlywiki", state.settings.__clientTW); break;
      default: state.throw(404);
    }
  }

  static handleAdminRoute(state: StateObject) {
    switch (state.path[2]) {
      case "controller":
        Controller.handleController(state);
        break;
      case "authenticate":
        handleAuthRoute(state);
        break;
      default:
        state.throw(404);
    }
  }

}
export class Listener {
  closed = false;
  closing = false;
  debug: (level: number, str: string | NodeJS.ErrnoException, ...args: any[]) => any;
  wss: WebSocket.Server
  constructor(
    public debugOutput: Writable,
    public events: Subject<ListenerEvents>,
    public command: Observable<MainServerEvents>,
    public iface: string,
    public server: https.Server | http.Server
  ) {
    this.debug = (level: number, str: string | NodeJS.ErrnoException, ...args: any[]) => {
      StateObject.DebugLoggerInner(level, "STARTER", str, args, this.debugOutput);
    }
    this.wss = new WebSocketServer({ server: this.server });
    this.addRequestHandlers();
    this.command.subscribe(({ close }) => {
      if (close) {
        if (close.force) this.kill();
        else this.close();
      }
    });

  }
  addRequestHandlers() {
    this.server.on('connection', (socket: Socket) => {
      // in case the address watcher catches it
      if (socket.destroyed) return;
      // if the process is about to exit, don't handle anything else
      if (process.exitCode) { socket.destroy(); return; }
      this.sockets.push(socket);
      socket.once('close', () => {
        let index = this.sockets.indexOf(socket);
        if (index !== -1) this.sockets.splice(index, 1);
      });
    });
    this.server.on("request", (request, response) => {
      this.events.next({ sender: this, request: { request, response } });
    });

    this.server.on("listening", () => {
      this.events.next({ sender: this, listening: this.server.address() })
    });

    this.server.on("error", error => {
      this.events.next({ sender: this, error: { error, type: "server" } });
    });

    false && this.server.on("clientError", (error, socket) => {
      this.events.next({ sender: this, error: { error, socket, type: "connection" } });
    });

    this.server.on("close", () => {
      this.closing = true;
      process.nextTick(() => {
        this.closed = true;
        this.events.next({ sender: this, close: true });
      });
    });
    this.wss.on("connection", (client, request) => {
      false && client.on("error", (error) => {
        this.events.next({ sender: this, error: { error, type: "websocket", client } });
      });
      this.events.next({ sender: this, socket: { client, request } });
    });
    this.wss.on("error", (error) => {
      this.events.next({ sender: this, error: { error, type: "wsServer" } });
    });
  }
  listen(port: number, host: string) {
    return new Promise<void>(resolve => { this.server.listen(port, host, undefined, () => { resolve(); }); });
  }
  close() {
    this.closing = true;
    this.server.close();
    //this is a hack which should release the listener address
    this.server.emit("close");
  }
  sockets: Socket[] = [];
  /** same as close but also destroys all open sockets */
  kill() {
    // copied from npm "killable" package
    this.closing = true;
    this.server.close();
    this.sockets.forEach((socket) => { socket.destroy(); });
    this.sockets = [];
  }
}
let instance: Controller;
let timestamp: number = 0;
let expectedControllers: string = "";
interface ControllerEvents {
  restart: boolean;
  getSettings: boolean;
  putSettings: ServerConfigSchema;
  timestamp: number;
  signature: string;
  publicKeyHash: string;
}
export class Controller {
  static timestamp: number;
  static handleSettings(settings: ServerConfig) {
    let safeJSON = (key, val) => {
      if (key === "__proto__" || key === "constructor") return undefined;
      else return val;
    }
    if (true/* !checkController.check(JSON.parse(JSON.stringify(settings.controllers, safeJSON), safeJSON), {}) */) {
      Controller.handleServer = (startup) => { };
      Controller.handleController = (state) => { state.throw(500); return Promise.resolve(); }
      return false;
    } else {
      expectedControllers = JSON.stringify(settings.controllers, safeJSON);
      return true;
    }
  }
  static handleServer(startup: MainServer) {

  }
  static async handleController(state: StateObject) {
    if (state.req.method !== "POST" || state.url.pathname !== "/")
      return state.throw(400);

    await state.recieveBody(false, () => { });

    let cont: ServerConfig_Controller = {} as any;
    let json: ControllerEvents = {} as any;

    if (json.timestamp <= timestamp) return state.throw(403);

    timestamp = json.timestamp

    let restart = !!json.restart;
    let settings = !!json.putSettings;

    let allowed = (!restart || cont.allowRestart) && (!settings || cont.allowSave);

    if (!allowed) return state.throw(403);


  }
  constructor(public main: MainServer) {

  }
}
// This isn't ready yet
Controller.handleSettings = () => true;
Controller.handleServer = () => { };
Controller.handleController = async (state) => { state.throw(500); };