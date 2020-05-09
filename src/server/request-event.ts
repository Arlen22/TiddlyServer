import { appendFileSync } from "fs";
import { IncomingMessage, ServerResponse } from "http";
import { Writable } from "stream";
import { format } from "util";
import * as WebSocket from "ws";
import { ServerConfig, ServerConfig_AccessOptions, Config, OptionsConfig } from "./server-config";
import { parseHostList, testAddress, resolvePath, PathResolverResult, as } from "./server-types";
import { checkCookieAuth } from "./cookies";
import { parse } from "url";
import { createLogWritable } from './logger';
export class RequestEvent {
  handled: boolean = false;
  username: string = "";
  authAccountKey: string = "";
  localAddressPermissionsKey: string = "";
  treeHostIndex: number = 0;
  debugOutput: Writable;
  network: { iface: string; host: string | undefined; addr: string };
  client: WebSocket = undefined as any;
  response: ServerResponse = undefined as any;
  url: string;

  constructor(
    settings: ServerConfig,
    request: IncomingMessage,
    iface: string,
    // network: { iface: string; host: string | undefined; addr: string },
    type: "client",
    response: WebSocket
  );
  constructor(
    settings: ServerConfig,
    request: IncomingMessage,
    iface: string,
    type: "response",
    response: ServerResponse
  );
  constructor(
    public settings: ServerConfig,
    public request: IncomingMessage,
    iface: string,

    public type: "client" | "response",
    response: WebSocket | ServerResponse
  ) {
    let host = request.headers.host;
    let addr = request.socket.localAddress;
    this.network = { host, addr, iface };
    this.debugOutput = RequestEvent.MakeDebugOutput(settings);
    this.url = this.request.url || "/";
    switch (type) {
      case "client":
        this.client = response as WebSocket;
        break;
      case "response":
        this.response = response as ServerResponse;
        break;
      default:
        throw new Error("Invalid response type");
    }
  }
  async requestHandlerHostLevelChecks<T extends RequestEvent>(
    preflighter?: (ev: RequestEvent) => Promise<RequestEvent>
  ): Promise<RequestEvent> {
    // let this = this;
    //connections to the wrong IP address are already filtered out by the connection event listener on the server.
    //determine localAddressPermissions to be applied
    {
      let localAddress = this.request.socket.localAddress;
      let keys = Object.keys(this.settings.bindInfo.localAddressPermissions);
      let isLocalhost = testAddress(localAddress, "127.0.0.1", 8);
      let matches = parseHostList(keys)(localAddress);
      if (isLocalhost && keys.indexOf("localhost") !== -1) {
        this.localAddressPermissionsKey = "localhost";
      } else if (matches.lastMatch !== -1) {
        this.localAddressPermissionsKey = keys[matches.lastMatch];
      } else {
        this.localAddressPermissionsKey = "*";
      }
    }
    // host header is currently not implemented, but could be implemented by the preflighter
    this.treeHostIndex = 0;
    let { registerNotice } = this.settings.bindInfo.localAddressPermissions[
      this.localAddressPermissionsKey
    ];
    let auth = checkCookieAuth(this.request, this.settings);
    if (auth) {
      this.authAccountKey = auth[0];
      this.username = auth[1];
    }

    //send the data to the preflighter
    let ev2 = await (preflighter ? preflighter(this) : Promise.resolve(this));

    if (ev2.handled) return ev2 as any; //cancel early if it is handled
    //sanity checks after the preflighter
    // "always check all variables and sometimes check some constants too"
    //@ts-ignore
    if (!this.response !== !ev2.response || !this.client !== !ev2.client)
      throw new Error("DEV: Request Event types got mixed up");
    if (ev2.treeHostIndex > ev2.settings.tree.length - 1)
      throw format(
        "treeHostIndex of %s is not within array length of %s",
        ev2.treeHostIndex,
        ev2.settings.tree.length
      );
    if (!ev2.settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey])
      throw format(
        "localAddressPermissions key of %s does not exist",
        ev2.localAddressPermissionsKey
      );
    if (ev2.authAccountKey && !ev2.settings.authAccounts[ev2.authAccountKey])
      throw format("authAccounts key of %s does not exist", ev2.authAccountKey);

    // if (!ev2.debugOutput) ev2.debugOutput = MakeDebugOutput(ev2.settings);
    return ev2 as any;
  }
  resolvePath() {
    let root = this.settings.tree[this.treeHostIndex].$mount;
    let pathname = (parse(this.request.url as string).pathname || "/").split("/");
    return resolvePath(pathname, root);
  }
  get allow(): ServerConfig_AccessOptions {
    if (this.authAccountKey) {
      return this.settings.authAccounts[this.authAccountKey].permissions;
    } else {
      return this.settings.bindInfo.localAddressPermissions[this.localAddressPermissionsKey];
    }
  }
  get hostRoot() {
    return this.settings.tree[this.treeHostIndex];
  }
  close(code: number, message?: string) {
    if (this.type === "response") {
      this.response.writeHead(code);
      if (message) this.response.write(message);
      this.response.end();
    } else if (this.type === "client") {
      this.client.close(code, message);
    }
  }
  getTreeOptions(result: PathResolverResult) {
    let ancestry = [...result.ancestry, result.item];
    //nonsense we have to write because putsaver could be false
    // type putsaverT = Required<typeof state.settings.putsaver>;
    let putsaver = as<ServerConfig["putsaver"]>({
      enabled: true,
      gzipBackups: true,
      backupFolder: "",
      etag: "optional",
      etagAge: 3,
      ...(this.settings.putsaver || {}),
    });
    let options: OptionsConfig = {
      auth: { $element: "auth", authError: 403, authList: null },
      putsaver: { $element: "putsaver", ...putsaver },
      index: {
        $element: "index",
        defaultType: this.settings.directoryIndex.defaultType,
        indexFile: [],
        indexExts: [],
      },
    };
    // console.log(state.ancestry);
    ancestry.forEach(e => {
      // console.log(e);
      e.$options &&
        e.$options.forEach(f => {
          if (f.$element === "auth" || f.$element === "putsaver" || f.$element === "index") {
            // console.log(f);
            Object.keys(f).forEach(k => {
              if (f[k] === undefined) return;
              options[f.$element][k] = f[k];
            });
          }
        });
    });
    return options;
  }
  static MakeDebugOutput(settings: ServerConfig) {
    return process.stderr;
    // const { logError, logColorsToFile, logToConsoleAlso } = { logError: undefined, logColorsToFile: false, logToConsoleAlso: true };
    // return createLogWritable(
    //   logError,
    //   !logError || logToConsoleAlso,
    //   logColorsToFile,
    //   process.stderr
    // )
  }
}

// export interface RequestEvent {
//   // if this is true after calling the preflighter, no further processing occurs
//   handled: boolean;
//   // the settings object being applied to this request
//   // changing this is not officially supported, but may work
//   settings: ServerConfig,
//   // the HTTP request
//   request: IncomingMessage,
//   // which type of request this is
//   type: "client" | "response",
//   // only the one specified in type will be defined
//   client: WebSocket;
//   response: ServerResponse;
//   // the network info for the request
//   network: { 
//     // listen address passed to the HTTP Server.listen
//     iface: string; 
//     // host header of the request
//     host: string | undefined; 
//     // local interface address
//     addr: string; 
//   };
//   // returns the permissions object that applies based 
//   // on authAccountKey and localAddressPermissionsKey
//   allow: ServerConfig_AccessOptions;
//   //getter that returns the treeHost at treeHostIndex
//   hostRoot: Config.HostElement;
//   // username for this request, preset if logged in
//   username: string;
//   // authAccounts object key that applies to this request
//   authAccountKey: string;
//   // bindInfo.localAddressPermissions object key that applies to this request
//   localAddressPermissionsKey: string;
//   // the host index in the tree
//   treeHostIndex: number;
//   // the output stream of the debug logger, may be changed or used by the preflighter
//   debugOutput: Writable;
//   // resolves the url to determine the tree node this request applies to
//   resolvePath(): PathResolverResult | undefined;
//   // close the response or client with this code and message
//   close(code: number, message?: string | undefined): void;
//   // get the tree options (auth, index, and putsaver) that apply to this tree node
//   getTreeOptions(result: PathResolverResult): OptionsConfig;
// }