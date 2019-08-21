

import { send, ws as WebSocket, ajv, libsodium } from '../lib/bundled-lib';
const sendOptions = {};


// import {
// 	Observable, Subject, Subscription, BehaviorSubject, Subscriber
// } from '../lib/rx';

import {
	StateObject,
	sanitizeJSON,
	keys,
	ServerConfig,
	colors,
	Hashmap,
	serveFolderIndex,
	init as initServerTypes,
	tryParseJSON,
	JsonError,
	ServerEventEmitter,
	normalizeSettings,
	serveFolder,
	serveFile,
	ConvertSettings,
	parseHostList,
	testAddress,
	loadSettings,
	NodePromise,
	RequestEventWS,
	RequestEventHTTP,
	RequestEvent
} from "./server-types";

import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { format, inspect } from 'util';
import { EventEmitter } from 'events';
import * as ipcalc from './ipcalc';
import * as x509 from "@fidm/x509";
import { ServerResponse } from 'http';
import { networkInterfaces, NetworkInterfaceInfo } from 'os';
import { TLSSocket } from 'tls';
import { checkServerConfig } from "./interfacechecker";
export { checkServerConfig };
// import { parse as jsonParse } from 'jsonlint';

// import send = require('../lib/send-lib');

const { Server: WebSocketServer } = WebSocket;

__dirname = path.dirname(module.filename || process.execPath);

Error.stackTraceLimit = Infinity;

console.debug = function () { }; //noop console debug;

//setup global objects
export const eventer = new EventEmitter() as ServerEventEmitter;
// const debug = DebugLogger('APP');

namespace ENV {
	export let disableLocalHost: boolean = false;
};

var settings: ServerConfig;
var debug: OmitThisParameter<ReturnType<typeof StateObject["DebugLogger"]>>;
export { loadSettings };

//import and init api-access
import { handleTiddlyServerRoute, init as initTiddlyServer, handleTiddlyWikiRoute } from './tiddlyserver';
// typescript retains the object reference here ()`authroute_1.checkCookieAuth`)
import { handleAuthRoute, initAuthRoute, checkCookieAuth } from "./authRoute";
import { Writable } from 'stream';


initServerTypes(eventer);
initTiddlyServer(eventer);
initAuthRoute(eventer);
// initSettings(eventer);
// eventer.on("settings", (set) => { settings = set });
//emit settings to everyone (I know, this could be an observable)


// === Setup Logging
const morgan = require('../lib/morgan.js');
function setLog(): Function {
	const logger: Function = morgan.handler({
		logFile: settings.logging.logAccess || undefined,
		logToConsole: !settings.logging.logAccess || settings.logging.logToConsoleAlso,
		logColorsToFile: settings.logging.logColorsToFile
	});
	return settings.logging.logAccess === false
		? ((...args: any[]) => Promise.resolve([]))
		: (...args: any[]) => new Promise(resolve => {
			args.push((...args2: any[]) => resolve(args2));
			logger.apply(null, args);
		});
}
let log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<{}>;

//setup auth checkers
// let checkCookieAuth: (request: http.IncomingMessage) => string;
/**
Authentication could be done several ways, but the most convenient and secure method is 
probably to specify a public key instead of a certificate, and then use that public key
to verify the signiture of the cookie. The cookie would consist of two parts, the first 
being an info packet containing the desired username and the key fingerprint, the 
second being the signature of the first using the private key. The info packet should also 
contain the signature time and should probably be sent to the server in a post request so 
the server can set it as an HTTP only cookie. Directory Index would display the current user
info so the user can logout if desired. Data folders would be given the username from the 
cookie with the request. The private key could be pasted in during login and stored using 
crypto.subtle. 
 */



eventer.on('settings', (set) => {
	settings = set;
	let debugOutput = MakeDebugOutput(settings);
	debug = StateObject.DebugLogger("SERVER ").bind({ debugOutput, settings });
	log = setLog() as any;
	// console.log(JSON.stringify(set, null, 2));
	if (!checkServerConfig(set)) throw "ServerConfig did not pass validator";
});
eventer.on('settingsChanged', (keys) => {
	// let watch: (keyof ServerConfig["server"])[] = ["server.logAccess", "server.logToConsoleAlso", "server.logColorsToFile"];
	// if (watch.some(e => keys.indexOf(e) > -1)) log = setLog();
})

// === Setup static routes
const routes: Record<string, (state: StateObject) => void> = {
	'admin': state => handleAdminRoute(state),
	'assets': state => handleAssetsRoute(state),
	'favicon.ico': state => serveFile(state, 'favicon.ico', settings.__assetsDir),
	'directory.css': state => serveFile(state, 'directory.css', settings.__assetsDir),
};
const libsReady = Promise.all([libsodium.ready]);

//we make it a separate line because typescript loses the const if I export
export { routes, libsReady };

declare function preflighterFunc(ev: RequestEventWS): Promise<RequestEventWS>;
declare function preflighterFunc(ev: RequestEventHTTP): Promise<RequestEventHTTP>;


/**
 * Adds all the listeners required for tiddlyserver to operate. 
 *
 * @export
 * @param {(https.Server | http.Server)} server The server instance to initialize
 * @param {string} iface A marker string which is only used for certain debug messages and 
 * is passed into the preflighter as `ev.iface`.
 * @param {*} preflighter A preflighter function which may modify data about the request before
 * it is handed off to the router for processing.
 */
export function addRequestHandlers(server: https.Server | http.Server, iface: string, preflighter: typeof preflighterFunc) {
	// const addListeners = () => {
	let closing = false;

	server.on('request', requestHandler(iface, preflighter));
	server.on('listening', () => {
		debug(1, "server %s listening", iface);
	})
	server.on('error', (err) => {
		debug(4, "server %s error: %s", iface, err.message);
		debug(4, "server %s stack: %s", iface, err.stack);
		server.close();
		eventer.emit('serverClose', iface);
	})
	server.on('close', () => {
		if (!closing) eventer.emit('serverClose', iface);
		debug(4, "server %s closed", iface);
		closing = true;
	});

	const wss = new WebSocketServer({ server });
	wss.on('connection', (client: WebSocket, request: http.IncomingMessage) => {
		let host = request.headers.host;
		let addr = request.socket.localAddress;
		//check host level permissions and the preflighter
		let ev: RequestEventWS = {
			handled: false,
			localAddressPermissionsKey: "",
			interface: { host, addr, iface },
			authAccountKey: "",
			treeHostIndex: -1,
			username: "",
			//@ts-ignore
			debugOutput: undefined,
			// settings,
			request,
			client,
			get settings() {
				return settings;
			}
		};
		requestHandlerHostLevelChecks<typeof ev>(ev, preflighter).then(ev2 => {
			if (!ev2.handled) { // we give the preflighter the option to handle the websocket on its own
				if (!settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey].websockets) client.close();
				else eventer.emit('websocket-connection', ev);
			}
		});
	});
	wss.on('error', (error) => {
		debug(-2, 'WS-ERROR %s', inspect(error));
	});

}

/**
 * All this function does is create the servers and start listening. The settings object is emitted 
 * on the eventer and addListeners is called to add the listeners to each server before 
 * it is started. If another project wanted to provide its own server instances, it should 
 * first emit the settings event with a valid settings object as the only argument, then call
 * addListeners with each server instance, then call listen on each instance. 
 *
 * @export
 * @param {<T extends RequestEvent>(ev: T) => Promise<T>} preflighter
 * @param {(SecureServerOptions | ((host: string) => https.ServerOptions)) | undefined} settingshttps
 * Either an object containing the settings.server.https from settings.json or a function that
 * takes the host string and returns an https.createServer options object. Undefined if not using https.
 * @returns
 */
export async function initServer({ preflighter, settingshttps }: {
	// env: "electron" | "node",
	preflighter: <T extends RequestEvent>(ev: T) => Promise<T>,
	// listenCB: (host: string, port: number) => void,
	settingshttps: ((host: string) => https.ServerOptions) | undefined
}) {
	// settings = options.settings;
	if (!settings) throw "The settings object must be emitted on eventer before starting the server";
	// const { preflighter, env, listenCB, settingshttps } = options;
	// eventer.emit('settings', settings);
	const hosts: string[] = [];
	const bindWildcard = settings.bindInfo.bindWildcard;
	const tester = parseHostList([...settings.bindInfo.bindAddress, "-127.0.0.0/8"]);
	const localhostTester = parseHostList(["127.0.0.0/8"]);

	await libsodium.ready;

	send.mime.define(settings.directoryIndex.mimetypes);

	if (bindWildcard) {
		//bind to everything and filter elsewhere if needed
		hosts.push('0.0.0.0');
		if (settings.bindInfo.enableIPv6) hosts.push('::');
	} else if (settings.bindInfo.filterBindAddress) {
		//bind to all interfaces that match the specified addresses
		let ifaces = networkInterfaces();
		let addresses = Object.keys(ifaces)
			.reduce((n, k) => n.concat(ifaces[k]), [] as NetworkInterfaceInfo[])
			.filter(e => settings.bindInfo.enableIPv6 || e.family === "IPv4" && tester(e.address).usable)
			.map(e => e.address);
		hosts.push(...addresses);
	} else {
		//bind to all specified addresses
		hosts.push(...settings.bindInfo.bindAddress);
	}
	if (settings.bindInfo._bindLocalhost) hosts.push('localhost');
	if (hosts.length === 0) {
		let { filterBindAddress, bindAddress, bindWildcard, _bindLocalhost, enableIPv6 } = settings.bindInfo;
		console.log(`"No IP addresses will be listened on. This is probably a mistake.
bindWildcard is ${(bindWildcard ? "true" : "false")}
filterBindAddress is ${filterBindAddress ? "true" : "false"}
_bindLocalhost is ${_bindLocalhost ? "true" : "false"}
enableIPv6 is ${enableIPv6 ? "true" : "false"}
bindAddress is ${JSON.stringify(bindAddress, null, 2)}
`);
	}
	let servers: (http.Server | https.Server)[] = [];
	console.log("Creating servers as %s", typeof settingshttps === "function" ? "https" : "http")
	Promise.all(hosts.map(host => {
		let server: any;
		if (typeof settingshttps === "function") {
			try {
				server = https.createServer(settingshttps(host));
			} catch (e) {
				console.log("settingshttps function threw for host " + host);
				console.log(e);
				throw e;
			}
		} else {
			server = http.createServer();
		}

		// let server = settingshttps ? https.createServer(httpsOptions) : http.createServer();
		addRequestHandlers(server, host, preflighter);
		//this one we add here because it is related to the host property rather than just listening
		if (bindWildcard && settings.bindInfo.filterBindAddress) server.on('connection', (socket) => {
			if (!tester(socket.localAddress).usable && !localhostTester(socket.localAddress).usable) socket.end();
		})
		servers.push(server);
		return new Promise(resolve => {
			server.listen(settings.bindInfo.port, host, undefined, () => { resolve(); });
		});
	})).then(() => {
		eventer.emit("serverOpen", servers, hosts, !!settingshttps);
		let ifaces = networkInterfaces();
		console.log('Open your browser and type in one of the following:\n' +
			(settings.bindInfo.bindWildcard
				? Object.keys(ifaces)
					.reduce(
						(n, k) => n.concat(ifaces[k]),
						[] as NetworkInterfaceInfo[]
					).filter(e =>
						(settings.bindInfo.enableIPv6 || e.family === "IPv4")
						&& (!settings.bindInfo.filterBindAddress || tester(e.address).usable)
					).map(e => e.address)
				: hosts
					.map(e => (settings.bindInfo.https ? "https" : "http") + "://" + e + ":" + settings.bindInfo.port)).join('\n')
		);
	}, (x) => {
		console.log("Error thrown while starting server");
		console.log(x);
	});

	return eventer;
}
/** 
 * handles all checks that apply to the entire server (not just inside the tree), including 
 * > auth accounts key
 * > local address permissions key (based on socket.localAddress)
 * > host array index
 */
function requestHandlerHostLevelChecks<T extends RequestEvent>(
	ev: T,
	preflighter?: (ev: T) => Promise<T>
) {
	//connections to the wrong IP address are already filtered out by the connection event listener on the server.
	//determine localAddressPermissions to be applied
	{
		let localAddress = ev.request.socket.localAddress;
		let keys = Object.keys(settings.bindInfo.localAddressPermissions);
		let isLocalhost = testAddress(localAddress, "127.0.0.1", 8);
		let matches = parseHostList(keys)(localAddress);
		if (isLocalhost) {
			ev.localAddressPermissionsKey = "localhost";
		} else if (matches.lastMatch > -1) {
			ev.localAddressPermissionsKey = keys[matches.lastMatch];
		} else {
			ev.localAddressPermissionsKey = "*";
		}
	}
	// host header is currently not implemented, but could be implemented by the preflighter
	ev.treeHostIndex = 0;
	// console.log(settings.bindInfo);
	let { registerNotice } = settings.bindInfo.localAddressPermissions[ev.localAddressPermissionsKey];
	let auth = checkCookieAuth(ev.request, registerNotice);
	if (auth) {
		ev.authAccountKey = auth[0];
		ev.username = auth[1];
	}
	//send the data to the preflighter
	return (preflighter ? preflighter(ev) : Promise.resolve(ev)).then(ev2 => {
		//sanity checks after the preflighter
		//"always check all variables and sometimes check some constants too" -- Arlen Beiler
		//@ts-ignore
		if (!ev.response !== !ev2.response || !ev.client !== !ev2.client)
			throw new Error("DEV: Request Event types got mixed up");
		if (ev2.treeHostIndex > settings.tree.length - 1)
			throw format("treeHostIndex of %s is not within array length of %s", ev2.treeHostIndex, settings.tree.length)
		if (!settings.bindInfo.localAddressPermissions[ev2.localAddressPermissionsKey])
			throw format("localAddressPermissions key of %s does not exist", ev2.localAddressPermissionsKey);
		if (ev2.authAccountKey && !settings.authAccounts[ev2.authAccountKey])
			throw format("authAccounts key of %s does not exist", ev2.authAccountKey);
		// let settings: never;
		if (!ev2.debugOutput) ev2.debugOutput = MakeDebugOutput(ev2.settings);
		return ev2;
	});
}
function MakeDebugOutput(settings) {
	const colorsRegex = /\x1b\[[0-9]+m/gi

	return new Writable({
		write: function (chunk, encoding, callback) {
			// if we're given a buffer, convert it to a string
			if (Buffer.isBuffer(chunk)) chunk = chunk.toString('utf8');
			// remove ending linebreaks for consistency
			chunk = chunk.slice(0, chunk.length - (chunk.endsWith("\r\n") ? 2 : +chunk.endsWith("\n")));

			if (settings.logging.logError) {
				fs.appendFileSync(
					settings.logging.logError,
					(settings.logging.logColorsToFile ? chunk : chunk.replace(colorsRegex, "")) + "\r\n",
					{ encoding: "utf8" }
				);
			}
			if (!settings.logging.logError || settings.logging.logToConsoleAlso) {
				console.log(chunk);
			}
			callback && callback();
			return true;
		}
	});;
}
function requestHandler(iface: string, preflighter?: (ev: RequestEventHTTP) => Promise<RequestEventHTTP>) {
	return (request: http.IncomingMessage, response: http.ServerResponse) => {
		let host = request.headers.host;
		let addr = request.socket.localAddress;
		// console.log(host, addr, request.socket.address().address);
		//send the request and response to morgan
		log(request, response).then(() => {
			const ev: RequestEventHTTP = {
				handled: false,
				localAddressPermissionsKey: "",
				authAccountKey: "",
				username: "",
				treeHostIndex: 0,
				interface: { host, addr, iface },
				//@ts-ignore
				debugOutput: undefined,
				request, response, settings
			};
			//send it to the preflighter
			return requestHandlerHostLevelChecks(ev, preflighter);
		}).then(ev => {
			// check if the preflighter handled it
			if (ev.handled) return;
			//create the state object
			const state = new StateObject(
				ev.request,
				ev.response,
				// debug,
				eventer,
				ev.localAddressPermissionsKey,
				ev.authAccountKey,
				ev.treeHostIndex,
				ev.username,
				ev.settings,
				ev.debugOutput
			);
			//
			// if (!handleBasicAuth(state)) return;
			//check for static routes
			const route = routes[state.path[1]];
			//if so, handle it
			if (route) route(state);
			//otherwise forward to TiddlyServer
			else handleTiddlyServerRoute(state);
		}).catch(err => {
			//catches any errors that happen inside the then statements
			debug(3, 'Uncaught error in the request handler: ' + (err.message || err.toString()));
			//if we have a stack, then print it
			if (err.stack) debug(3, err.stack);
		});
	}
}

// const errLog = DebugLogger('STA-ERR');
eventer.on("stateError", (state) => {
	if (state.doneMessage.length > 0)
		StateObject.DebugLogger("STA-ERR").call(state, 2, state.doneMessage.join('\n'));
	debugger;
})
eventer.on("stateDebug", (state) => {
	if (state.doneMessage.length > 0)
		StateObject.DebugLogger("STA-DBG").call(state, -2, state.doneMessage.join('\n'));
})


function handleAssetsRoute(state: StateObject) {
	switch (state.path[2]) {
		case "static": serveFolder(state, '/assets/static', path.join(settings.__assetsDir, "static")); break;
		case "icons": serveFolder(state, '/assets/icons', path.join(settings.__assetsDir, "icons")); break;
		case "tiddlywiki": handleTiddlyWikiRoute(state); break;
		default: state.throw(404);
	}
}

function handleAdminRoute(state: StateObject) {
	switch (state.path[2]) {
		// case "settings": handleSettings(state); break;
		case "authenticate": handleAuthRoute(state); break;
		default: state.throw(404);
	}
}

// function checkBasicAuth(request: http.IncomingMessage): string {
// 	//determine authAccount to be applied
// 	const first = (header?: string | string[]) =>
// 		Array.isArray(header) ? header[0] : header;
// 	var header = first(request.headers['authorization']) || '',  // get the header
// 		token = header.split(/\s+/).pop() || '',                   // and the encoded auth token
// 		auth = new Buffer(token, 'base64').toString(),             // convert from base64
// 		parts = auth.split(/:/),                                   // split on colon
// 		username = parts[0],
// 		password = parts[1];
// 	if (username && password) debug(-3, "Basic Auth recieved");
// 	throw "DEV ERROR: we didn't check if the basic auth is valid";
// 	return username;
// }

function handleBasicAuth(state: StateObject, settings: { username: string, password: string }): boolean {
	//check authentication and do sanity/security checks
	//https://github.com/hueniverse/iron
	//auth headers =====================
	if (!settings.username && !settings.password) return true;
	const first = (header?: string | string[]) =>
		Array.isArray(header) ? header[0] : header;
	if (!state.req.headers['authorization']) {
		StateObject.DebugLogger("AUTH   ").call(state, -2, 'authorization required');
		state.respond(401, "", { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' }).empty();
		return false;
	}
	StateObject.DebugLogger("AUTH   ").call(state, -3, 'authorization requested');
	var header = first(state.req.headers['authorization']) || '',  // get the header
		token = header.split(/\s+/).pop() || '',                     // and the encoded auth token
		auth = new Buffer(token, 'base64').toString(),               // convert from base64
		parts = auth.split(/:/),                                     // split on colon
		username = parts[0],
		password = parts[1];
	if (username !== settings.username || password !== settings.password) {
		StateObject.DebugLogger("AUTH   ").call(state, -2, 'authorization invalid - UN:%s - PW:%s', username, password);
		state.throwReason(401, 'Invalid username or password');
		return false;
	}
	StateObject.DebugLogger("AUTH   ").call(state, -3, 'authorization successful')
	return true;
}
