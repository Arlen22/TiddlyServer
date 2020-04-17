#!/usr/bin/env node

require('source-map-support/register')
import * as fs from 'fs'
import * as path from 'path'
import { inspect } from 'util'
import * as server from './src/server'
import * as yargs from 'yargs'
import preflighter from './src/preflighter'

const SETTINGS_FILE = 'settings.json'
const argv = yargs
  .usage('./$0 - TiddlyServer')
  .option('config', {
    describe: 'Path to the server config file',
    demandOption: false,
    type: 'string',
  })
  .option('stay-on-error', {
    describe: 'Start a setInterval loop to keep the process\nfrom exiting.',
    demandOption: false,
    type: 'boolean',
    default: false,
  })
  .option('dry-run', {
    describe: 'Do everything except call server.listen().\nUseful for checking settings.',
    demandOption: false,
    default: false,
    type: 'boolean',
  }).argv

const { 'config': userSettings, 'dry-run': dryRun, 'stay-on-error': stayOnError } = argv

const settingsFile = userSettings
  ? path.resolve(userSettings)
  : path.join(
      __dirname,
      //if we're in the build directory the default one level up
      __dirname.endsWith('/build') ? '..' : '',
      'settings.json'
    )

declare const __non_webpack_require__: NodeRequire | undefined
const nodeRequire =
  typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require

const logAndCloseServer = (err: any) => {
  server.eventer.emit('serverClose', 'all')
  //hold it open because all other listeners should close
  if (stayOnError) setInterval(function() {}, 1000)
  process.exitCode = 1
  console.error('[ERROR]: caught process uncaughtException', inspect(err))
  try {
    fs.appendFileSync(
      path.join(__dirname, 'uncaughtException.log'),
      new Date().toISOString() + '\r\n' + inspect(err) + '\r\n\r\n'
    )
  } catch (e) {
    console.log('Could not write to uncaughtException.log')
  }
}

// Unhandled rejections with no reasons should be ignored
process.on('unhandledRejection', (err, _prom) => {
  if (!err) return
  logAndCloseServer(err)
})
process.on('uncaughtException', err => {
  logAndCloseServer(err)
})
process.on('beforeExit', () => {
  if (process.exitCode) {
    console.log('Server exited with errors ' + process.exitCode)
    return
  }
})

async function runServer() {
  const settingsDir = path.dirname(settingsFile)
  await server.libsReady

  const { settings, settingshttps } = server.loadSettings(settingsFile, Object.keys(server.routes))

  const [check, checkErr] = server.checkServerConfig(settings)

  if (!check) {
    console.log(JSON.stringify(checkErr, null, 2))
    debugger
  }
  server.eventer.emit('settings', settings)

  let httpsSettingsFile = settingshttps ? path.resolve(settingsDir, settingshttps) : false

  try {
    server.initServer({
      settings,
      settingshttps: httpsSettingsFile && nodeRequire(httpsSettingsFile).serverOptions,
      preflighter,
      dryRun,
    })
  } catch (e) {
    console.error('[ERROR]: Uncaught error during server startup:', e)
    process.exit(1)
  }
}

if (fs.existsSync(settingsFile)) {
  runServer()
} else {
  logAndCloseServer(
    '[ERROR]: server config file could not be found.\nConsider passing its location via --config\n'
  )
}
