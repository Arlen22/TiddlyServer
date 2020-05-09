import * as http from "http";
import * as url from "url";
import * as fs from "fs";
import * as path from "path";

import { format, promisify } from "util";
// import { Observable, Subscriber } from '../lib/rx';
// import { EventEmitter } from "events";
//import { StateObject } from "./index";
import * as JSON5 from "json5";
import * as send from "send";
import * as WebSocket from "ws";
import { Stats, appendFileSync } from "fs";
import { gzip, createGzip } from "zlib";
import { Writable, Stream } from "stream";
// import { TlsOptions } from 'tls';
import * as https from "https";
import { networkInterfaces, NetworkInterfaceInfo } from "os";
import * as ipcalc from "./ipcalc";
import {
  NewTreeOptions,
  NewTreePathOptions_Auth,
  NewTreePathOptions_Index,
  ServerConfig,
  ServerConfigBase,
  ServerConfigSchema,
  ServerConfig_AccessOptions,
  ServerConfig_BindInfo,
  normalizeSettings,
  ConvertSettings,
  NewTreeOptionsObject,
  Config,
  OptionsConfig,
} from "./server-config";
import { checkServerConfigSchema } from "./interface-checker";
import { StateObject } from "./state-object";
import { tryParseJSON } from "./utils-functions";
import { colors } from "./utils";

type DebugFunc = (level: number, str: string | NodeJS.ErrnoException, ...args: any[]) => any;

export function loadSettings(
  settingsFile: string,
  assetsFolder: string,
  routeKeys: string[]
) {
  let debug: DebugFunc = (level, str, ...args) => StateObject.DebugLoggerInner(level, "startup", str, args, process.stderr);

  const settingsString = fs
    .readFileSync(settingsFile, "utf8")
    .replace(/\t/gi, "    ")
    .replace(/\r\n/gi, "\n");

  let settingsObjSource: ServerConfigSchema = tryParseJSON<ServerConfigSchema>(
    settingsString,
    e => {
      debug(4,
        /*colors.BgWhite + */ colors.FgRed +
        "The settings file could not be parsed: %s" +
        colors.Reset,
        e.originalError.message
      );
      debug(4, e.errorPosition);
      throw "The settings file could not be parsed: Invalid JSON";
    }
  );

  let [sourceOK, sourceErrors] = checkServerConfigSchema(settingsObjSource);

  if(!sourceOK) console.log(sourceErrors);

  if (!settingsObjSource.$schema) throw "The settings file is v2.0 and must be upgraded.";

  if (settingsObjSource.$schema.startsWith("settings-2-1")) {
    debug(2,
      "The settins file needs to be upgraded from 2.1 if errors are thrown. "
      + "Please set the $schema property to settings-2-2.schema.json to get proper intellisense."
    );
  }
  if (!settingsObjSource.tree) throw "tree is not specified in the settings file";
  // let routeKeys = Object.keys(routes);
  let settingshttps = settingsObjSource.bindInfo && settingsObjSource.bindInfo.https;
  let settingsObj = normalizeSettings(settingsObjSource, settingsFile, assetsFolder);

  if ((settingsObjSource as any).logging) {
    debug(4, "Logging to file is no longer supported. Please remove the logging property from your config file. The debugLevel property is now a top level property (sibling to the tree property).");
    throw "Logging to file is no longer supported";
  }


  if (typeof settingsObj.tree === "object") {
    let keys: string[] = [];
    settingsObj.tree;
    let conflict = keys.filter(k => routeKeys.indexOf(k) > -1);
    if (conflict.length)
      debug(2,
        "The following tree items are reserved for use by TiddlyServer: %s",
        conflict.map(e => '"' + e + '"').join(", ")
      );
  }
  //remove the https settings and return them separately
  return { settings: settingsObj, settingshttps };
}
