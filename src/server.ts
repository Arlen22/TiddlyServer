// #!/usr/bin/env node

require("source-map-support/register");
import * as fs from "fs";
import * as path from "path";
import * as server from "./server/server";
import { inspect } from "util";
import { homedir } from "os";
import { StateObject } from './server/state-object';
import { Command } from "commander";

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
let logAndCloseServer: (err?: any) => void;

const program = new Command();
program.storeOptionsAsProperties(false)
program.passCommandToAction(false)
program.version(require('../package.json').version, "--version, -v");
program //.command("serve", { isDefault: true })
  .option("--config [file]", "Path to the server config file. Optional if a settings.json file exists in the installation directory.")
  .option("--stay-on-error", "Start a setInterval loop to keep the process from exiting.")
  .option("--dry-run", "Do everything except call server.listen(). Useful for checking settings.")
  .action((options: { "config"?: string, "stayOnError"?: boolean, "dryRun"?: boolean }) => {

    logAndCloseServer = (err?: any) => {
      //hold it open because all other listeners should close
      if (options.stayOnError) setInterval(function () { }, 1000);
      process.exitCode = 1;
      if (err) log(err);
    };

    if (typeof options.config === "boolean") options.config = "";

    const settingsFile = options.config
      ? path.resolve(options.config.startsWith("~/") ? homedir() + options.config.slice(1) : options.config)
      : path.join(__dirname, "settings.json");

    if (fs.existsSync(settingsFile)) {
      runServer(settingsFile, !!options.dryRun).catch(e => { if (e) logAndCloseServer(e); });
    } else {
      let msg = "[ERROR]: server config file could not be found.\nConsider passing its location via --config\n";
      console.log(msg);
      logAndCloseServer();
    }
  })
program.command("gunzip <input> <output>")
  .description("Unzip a backup file. Will throw if output file already exists.")
  .action((input, output, options) => {
    const z = require("zlib");
    const fs = require("fs");
    if (!fs.existsSync(input)) {
      console.log("  The input file does not exist.");
    } else if (fs.existsSync(output)) {
      console.log("  The output file already exists");
    } else {
      fs.writeFileSync(output, z.gunzipSync(fs.readFileSync(input)));
      console.log("  Uncompressed file written to " + path.resolve(output));
    }
  });
program.command("gen-schema [output]")
  .description("Generate a JSON schema for the config file and write it to the specified file")
  .action((output, options) => {
    output = path.resolve(output || "tiddlyserver-2-2.schema.json");
    console.log("writing schema to %s", output);
    if (fs.existsSync(path.join(path.dirname(output), "setttings-2-2-tree.schema.json")))
      console.log("The files \"settings-2-2-tree.schema.json\" and \"settings-2-2-tree-options.schema.json\" are not required with this schema. They may be safely deleted.")
    fs.writeFileSync(output, JSON.stringify(server.generateSchema(path.basename(output)), null, 2));
    console.log("Create a settings file with this content to enable intellisense if your editor supports it.");
    console.log(JSON.stringify({ $schema: "./" + path.basename(output) }, null, 2));
  })



const assetsFolder = path.join(__dirname, "client");

declare const __non_webpack_require__: NodeRequire | undefined;
const nodeRequire =
  typeof __non_webpack_require__ !== "undefined"
    ? __non_webpack_require__
    : require;



async function runServer(settingsFile: string, dryRun: boolean) {
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

program.parse();
