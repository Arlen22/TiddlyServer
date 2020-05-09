// #!/usr/bin/env node

require("source-map-support/register");
import * as fs from "fs";
import * as path from "path";
import * as server from "./server/server";
import * as yargs from "yargs";
import { inspect } from "util";
import { homedir } from "os";
import { StateObject } from './server/state-object';

const configInstallPath = path.join(__dirname, "settings.json");
const cli = yargs
  .usage("./$0 --config ~/path/to/settings.json")
  .help()
  .option("config", {
    describe: "Path to the server config file. Optional if a settings.json file exists in the installation directory.",
    // demandOption: !fs.existsSync(configInstallPath),
    type: "string",
  })
  .option("stay-on-error", {
    describe: "Start a setInterval loop to keep the process\nfrom exiting.",
    demandOption: false,
    type: "boolean",
    default: false,
  })
  .option("dry-run", {
    describe:
      "Do everything except call server.listen().\nUseful for checking settings.",
    demandOption: false,
    default: false,
    type: "boolean",
  })
  .option("gunzip", {
    array: true,
    conflicts: ["config"],
    describe: "Unzip a backup file. Specify --gunzip input.gz output.html",
    type: "string"
  })
  .option("gen-schema", {
    conflicts: ["config"],
    array: true,
    describe: "Generate a JSON schema for the config file and write it to the specified file",
    type: "string"
  })
  ;
const argv = cli.argv;

const {
  config: userSettings,
  "dry-run": dryRun,
  "stay-on-error": stayOnError,
  gunzip,
  "gen-schema": genSchema
} = argv;




const settingsFile =
  userSettings
    ? path.resolve(userSettings.startsWith("~/") ? homedir() + userSettings.slice(1) : userSettings)
    : configInstallPath;

const assetsFolder = path.join(__dirname, "client");

declare const __non_webpack_require__: NodeRequire | undefined;
const nodeRequire =
  typeof __non_webpack_require__ !== "undefined"
    ? __non_webpack_require__
    : require;

const logAndCloseServer = (err?: any) => {
  //hold it open because all other listeners should close
  if (stayOnError) setInterval(function () { }, 1000);
  process.exitCode = 1;
  if (err) log(err);
};
const log = (err: any) => {
  StateObject.DebugLoggerInner(4, "[ERROR]", "caught process uncaughtException " + inspect(err), [], process.stderr);
  try {
    fs.appendFileSync(
      path.join(__dirname, "uncaughtException.log"),
      new Date().toISOString() + "\r\n" + inspect(err) + "\r\n\r\n"
    );
  } catch (e) {
    StateObject.DebugLoggerInner(4, "[ERROR]", "Could not write to uncaughtException.log", [], process.stderr);
  }
}
async function runServer() {
  const settingsDir = path.dirname(settingsFile);
  await server.libsReady;

  const { settings, settingshttps } = server.loadSettings(
    settingsFile,
    assetsFolder,
    Object.keys(server.MainServer.routes)
  );

  console.log("Settings file: %s", settingsFile);
  console.log("TiddlyWiki: %s", settings.__serverTW);

  const [check, checkErr] = server.checkServerConfig(settings);

  if (!check) {
    console.log(JSON.stringify(checkErr, null, 2));
    debugger;
  }
  let main: server.MainServer;


  // Unhandled rejections with no reasons should be ignored
  process.on("unhandledRejection", (err, _prom) => {
    if (!err) return;
    if (main) main.close(true);
    logAndCloseServer(err);
  });
  process.on("uncaughtException", err => {
    if (main) main.close(true);
    logAndCloseServer(err);
  });
  process.on("beforeExit", () => {
    if (process.exitCode) {
      console.log("Server exited with errors " + process.exitCode);
      return;
    }
  });

  let httpsSettingsFile = settingshttps
    ? path.resolve(settingsDir, settingshttps)
    : false;


  let [success, _main] = await server.initServer({
    settings,
    settingshttps:
      httpsSettingsFile && nodeRequire(httpsSettingsFile).serverOptions,
    preflighter: fs.existsSync(__dirname + "/preflighter.js")
      ? nodeRequire("./preflighter.js").preflighter
      : undefined,
    dryRun,
  });
  main = _main;

}
function auditChildren() {
  const parents: NodeModule[] = [];
  const inspectModule = (mod: NodeModule) => {
    parents.push(mod);
    mod.children.forEach(e => {
      if (parents.indexOf(e) > -1) return console.log("circular", e.filename, mod.filename);
      else inspectModule(e);
    });
    parents.pop();
  }
  inspectModule(module);
}
if (gunzip) {
  const z = require("zlib");
  const fs = require("fs");
  if (gunzip.length !== 2) { 
    console.log("  Please specify the input gz file and an output file that does not exist."); 
    process.exit(1);
  }
  const [input, output] = gunzip;
  if (fs.existsSync(output)) {
    console.log("  The output file already exists");
    process.exit(1);
  }
  fs.writeFileSync(output, z.gunzipSync(fs.readFileSync(input)));
  console.log("Uncompressed file written to " + path.resolve(output));
} else if(genSchema) {
  let output = path.resolve(genSchema[0] || "tiddlyserver-2-2.schema.json");
  console.log("writing schema to %s", output);
  if(fs.existsSync(path.join(path.dirname(output), "setttings-2-2-tree.schema.json")))
    console.log("The files \"settings-2-2-tree.schema.json\" and \"settings-2-2-tree-options.schema.json\" are not required with this schema. They may be safely deleted.")
  fs.writeFileSync(output, JSON.stringify(server.generateSchema(path.basename(output)), null, 2));
} else if (fs.existsSync(settingsFile)) {
  runServer().catch(e => {
    if (e) logAndCloseServer(e);
  });
  // auditChildren();
} else {
  let msg = "[ERROR]: server config file could not be found.\nConsider passing its location via --config\n";
  console.log(msg);
  logAndCloseServer();
}
