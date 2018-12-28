require("./lib/source-map-support-lib");
const fs = require('fs');
const path = require('path');
const { inspect } = require('util');

var args = process.argv.slice(2);

const settingsFile = path.normalize(
	(args[0] && args[0].indexOf('--') !== 0)
		? path.resolve(args.shift())
		: path.join(__dirname, './settings.json')
);

const server = require('./src/server');
const settings = server.loadSettings(settingsFile);
const eventer = server.initServer({ env: "node", settings });

process.on('uncaughtException', err => {
	process.exitCode = 1;
	console.error(inspect(err));
	console.error("caught process uncaughtException");
	fs.appendFile(path.join(__dirname, 'uncaughtException.log'),
		new Date().toISOString() + "\r\n" + inspect(err) + "\r\n\r\n", (err) => {
			if (err) console.log('Could not write to uncaughtException.log');
		});
	eventer.emit('serverClose', "all");
	//hold it open because all other listeners should close
	if (args.indexOf("--close-on-error") === -1)
		setInterval(function () { }, 1000);
});

process.on('beforeExit', () => {
	if (process.exitCode) return;
	console.log('The process was about to close with exitCode 0 -- restarting server');
	// server.initServer({ env: "node", settings });
})

