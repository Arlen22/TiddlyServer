#!/usr/bin/env node

require('./lib/source-map-support-lib')
const fs = require('fs')
const path = require('path');
const { inspect } = require('util');
const server = require("./src/server");

const SETTINGS_FILE = 'settings.json'
const yargs = require('yargs')
    .usage('./$0 - TiddlyServer')
    .option('settings-path', {
        describe: 'The location of the settings.json file',
        demandOption: false,
        type: 'string'
    })
    .option('stay-on-error', {
        describe: 'Start a setInterval loop to keep the process\nfrom exiting.',
        demandOption: false,
        type: 'boolean'
    })
    .option('dry-run', {
        describe: 'Do everything except call server.listen().\nUseful for checking settings.',
        demandOption: false,
        type: 'boolean'
    })

const { settingsPath, dryRun, stayOnError } = yargs.argv
const settingsFile = settingsPath && typeof settingsPath === 'string'
    ? fs.existsSync(`${settingsPath}/${SETTINGS_FILE}`)
        ? settingsPath
        : null
    : fs.existsSync(`${SETTINGS_FILE}`)
        ? path.join(__dirname, `./${SETTINGS_FILE}`)
        : null

const closeServerUnlessStayOnError = (stayOnError) => {
  server.eventer.emit('serverClose', "all");
  //hold it open because all other listeners should close
  if (stayOnError) setInterval(function () { }, 1000);
}

const logUncaughtExceptions = (err) => {
  process.exitCode = 1;
  console.error("[ERROR]: caught process uncaughtException", inspect(err));
  fs.appendFile(path.join(__dirname, 'uncaughtException.log'),
                new Date().toISOString() + "\r\n" + inspect(err) + "\r\n\r\n", (err) => {
                  if (err) console.log('Could not write to uncaughtException.log');
                });
};

const runServer = async (settingsFile) => {
  const filePath = path.dirname(path.normalize(settingsFile))
  await server.libsReady

  const { settings, settingshttps } = server.loadSettings(
    settingsFile, Object.keys(server.routes)
  );
  const [check, checkErr] = server.checkServerConfig(settings);
  if (!check) {
    console.log(JSON.stringify(checkErr, null, 2));
    debugger;
  }
  server.eventer.emit("settings", settings);

  let httpsSettingsFile = settingshttps
      ? path.resolve(filePath, settingshttps)
      : false;

  try {
    server.initServer({
      settings,
      settingshttps: httpsSettingsFile && require(httpsSettingsFile).serverOptions,
      preflighter: fs.existsSync(__dirname + "/preflighter.js")
        ? require("./preflighter.js").preflighter
        : undefined,
      dryRun
    });
  } catch (e) {
    console.error("[ERROR]: Uncaught error during server startup:", e);
    process.exit(1);
  }

  // Unhandled rejections with no reasons should be ignored
  process.on("unhandledRejection", (err, _prom) => {
    if (!err) return;
    logUncaughtExceptions(err);
    closeServerUnlessStayOnError(stayOnError);
  });
  process.on('uncaughtException', logUncaughtExceptions);
  process.on('beforeExit', () => {
    if (process.exitCode) {
      console.log('Server exited with errors');
      return
    }
  })
}

if (settingsFile) {
  runServer(settingsFile);
} else {
  console.error('\n[ERROR]: No `settings.json` file found in path.\nConsider passing its location via --settings-path\n')
  process.exit(1)
}
