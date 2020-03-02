#!/usr/bin/env node



//@ts-check
const fs = require('fs');
const path = require('path');
const { inspect } = require('util');

var args = process.argv.slice(2);
// console.log(process.version);
const settingsFile = path.normalize(
  (args[0] && args[0].indexOf('--') !== 0)
    ? path.resolve(args.shift())
    : path.join(__dirname, './settings.json')
);
const settingsPath = path.dirname(settingsFile);


/**
 *      DEVELOPERS PLEASE READ
 * 
 * This entire codebase is very dirty. 
 *    It will be cleaned up soon. 
 *              Enjoy!
 * 
 */

/** @type {import("./src/server")} */
// @ts-ignore
const server = false ? require('./lib/compiled-lib') : require("./src/server");

server.libsReady.then(() => {
  // let [check1, checkErr1] = server.checkServerConfig(require(settingsFile));
  // if (check1 !== true) { console.log(JSON.stringify(checkErr1, null, 2)); debugger; }
  const { settings, settingshttps } = server.loadSettings(settingsFile, Object.keys(server.routes));
  let [check, checkErr] = server.checkServerConfig(settings);
  if (check !== true) { console.log(JSON.stringify(checkErr, null, 2)); debugger; }
  // fs.writeFileSync("settings-temp.json", JSON.stringify(settings, null, 2));
  server.eventer.emit("settings", settings);
  let httpsSettingsFile = settingshttps ? path.resolve(settingsPath, settingshttps) : false;
  server.initServer({
    settings,
    settingshttps: httpsSettingsFile && require(httpsSettingsFile).serverOptions,
    preflighter: fs.existsSync(__dirname + "/preflighter.js")
      ? require("./preflighter.js").preflighter
      : undefined,
    dryRun: args.indexOf("--dry-run") !== -1
  });

}).catch(e => {
  console.log("uncaught error during server startup");
  console.log(e);
  console.log("exiting");
  process.exitCode = 1;
})

const unhandled = (err) => {
  process.exitCode = 1;
  console.error(inspect(err));
  console.error("caught process uncaughtException");
  fs.appendFile(path.join(__dirname, 'uncaughtException.log'),
    new Date().toISOString() + "\r\n" + inspect(err) + "\r\n\r\n", (err) => {
      if (err) console.log('Could not write to uncaughtException.log');
    });
  server.eventer.emit('serverClose', "all");
  //hold it open because all other listeners should close
  if (args.indexOf("--stay-on-error") !== -1)
    setInterval(function () { }, 1000);
};

// unhandled rejections with no reasons should be ignored
process.on("unhandledRejection", (err, prom) => {
  if (!err) return;
  else unhandled(err);
});
process.on('uncaughtException', unhandled);


process.on('beforeExit', () => {
  if (process.exitCode) return;
  // console.log('The process was about to close with exitCode 0 -- restarting server');
  // server.initServer({ env: "node", settings });
})

