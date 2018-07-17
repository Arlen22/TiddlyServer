/*
https://github.com/atom/electron/blob/master/docs/api/dialog.md
https://dzone.com/articles/learning-electron-4-things-i-wish-i-knew-sooner

*/
import * as electron from 'electron';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { fork } from 'child_process';
interface Hashmap<T> { [K: string]: T; }
const { protocol, app, BrowserWindow, dialog, ipcMain, session } = electron;

var mainWindow: electron.BrowserWindow;

console.log(process.argv);

protocol.registerStandardSchemes(['tiddlyserver'])

app.on('ready', function () {

	const filter = { urls: ['*://localhost'] };

	const trustNonce = randomBytes(32).toString('base64');

	session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
		details.requestHeaders['X-TiddlyServer-Trusted'] = trustNonce;
		callback({ cancel: false, requestHeaders: details.requestHeaders })
	})

	var ts = fork(path.join(__dirname, "./src/server"));
	ts.on('message', (message, handle) => {
		if (message.startsWith("JSON")) {
			var json = JSON.parse(message.slice(4));
			if (json.code === "sendTrustNonce") {
				ts.send('JSON' + JSON.stringify({ code: "trustNonce", nonce: trustNonce }), handle);
			}
		}
	});

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		webPreferences: {
			nodeIntegration: false,
			preload: path.join(__dirname, "electron-browser-preload.js"),
		},
		show: true,
		acceptFirstMouse: true,
	});

	mainWindow.loadURL('http://localhost/');

	mainWindow.center();

	mainWindow.maximize();
	mainWindow.focus();

	mainWindow.on('closed', function () {
		mainWindow = null;
	});

	//add a right click menu
});

