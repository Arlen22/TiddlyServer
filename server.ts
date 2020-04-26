// #!/usr/bin/env node

require("source-map-support/register");
import * as fs from "fs";
import * as path from "path";
import * as server from "./src/server";
import * as yargs from "yargs";
import { inspect } from "util";
import { homedir } from "os";

const configInstallPath = path.join(__dirname, "settings.json");
const argv = yargs
  .usage("./$0 --config ~/path/to/settings.json")
  .help()
  .option("config", {
    describe: "Path to the server config file. Optional if a settings.json file exists in the installation directory.",
    demandOption: !fs.existsSync(configInstallPath),
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
  .argv;

const {
  config: userSettings,
  "dry-run": dryRun,
  "stay-on-error": stayOnError,
} = argv;



const settingsFile =
  userSettings
    ? path.resolve(userSettings.startsWith("~/") ? homedir() + userSettings.slice(1) : userSettings)
    : configInstallPath;

const assetsFolder = path.join(__dirname, "assets");

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
  console.error("[ERROR]: caught process uncaughtException", inspect(err));
  try {
    fs.appendFileSync(
      path.join(__dirname, "uncaughtException.log"),
      new Date().toISOString() + "\r\n" + inspect(err) + "\r\n\r\n"
    );
  } catch (e) {
    console.log("Could not write to uncaughtException.log");
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

  try {
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
    // auditChildren();
  } catch (e) {
    console.error("[ERROR]: Uncaught error during server startup:", e);
    process.exit(1);
  }
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
if (fs.existsSync(settingsFile)) {
  runServer();
  // auditChildren();
} else {
  let msg = "[ERROR]: server config file could not be found.\nConsider passing its location via --config\n";
  console.log(msg);
  logAndCloseServer();
}
