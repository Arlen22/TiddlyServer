

import { send, ws as WebSocket, ajv, libsodium } from '../lib/bundled-lib';
const sendOptions = {};


import {
	Observable, Subject, Subscription, BehaviorSubject, Subscriber
} from '../lib/rx';

import {
	StateObject, DebugLogger, sanitizeJSON, keys, ServerConfig,
	obs_stat, colors, obsTruthy, Hashmap, obs_readdir, serveFolderObs, serveFileObs, serveFolderIndex,
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
	NodePromise
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
// import { parse as jsonParse } from 'jsonlint';

// import send = require('../lib/send-lib');

const { Server: WebSocketServer } = WebSocket;

__dirname = path.dirname(module.filename || process.execPath);

Error.stackTraceLimit = Infinity;

console.debug = function () { }; //noop console debug;

//setup global objects
export const eventer = new EventEmitter() as ServerEventEmitter;
const debug = DebugLogger('APP');

namespace ENV {
	export let disableLocalHost: boolean = false;
};

var settings: ServerConfig;

export { loadSettings };

//import and init api-access
import { handleTiddlyServerRoute, init as initTiddlyServer, handleTiddlyWikiRoute } from './tiddlyserver';
// import { handleSettings, initSettings } from './settingsPage';
import { handleAuthRoute, initAuthRoute } from "./authRoute";

import { ServerResponse } from 'http';
import { networkInterfaces, NetworkInterfaceInfo } from 'os';
import { TLSSocket } from 'tls';

initServerTypes(eventer);
initTiddlyServer(eventer);
initAuthRoute(eventer);
// initSettings(eventer);
// eventer.on("settings", (set) => { settings = set });
//emit settings to everyone (I know, this could be an observable)


// === Setup Logging
const morgan = require('../lib/morgan.js');
function setLog() {
	const logger: Function = morgan.handler({
		logFile: settings.server.logAccess || undefined,
		logToConsole: !settings.server.logAccess || settings.server.logToConsoleAlso,
		logColorsToFile: settings.server.logColorsToFile
	});
	return settings.server.logAccess === false
		? ((...args: any[]) => Promise.resolve([]))
		: (...args: any[]) => new Promise(resolve => {
			args.push((...args2: any[]) => resolve(args2));
			logger.apply(null, args);
		});
}
let log: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<{}>;

//setup auth checkers
let checkCookieAuth: (request: http.IncomingMessage) => string;
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
const setAuth = () => {
	let ca: Record<string, x509.Certificate[]> = {};
	let up: [string, string, string][] = [] as any;
	let publicKeyLookup: Record<string, string> = {};
	let passwordLookup: Record<string, string> = {};
	const { crypto_generichash, crypto_generichash_BYTES, crypto_sign_SECRETKEYBYTES, crypto_sign_keypair, crypto_sign_open, from_base64, crypto_sign_verify_detached, randombytes_buf } = libsodium;
	let passwordKey = crypto_sign_keypair("uint8array");
	Object.keys(settings.authAccounts).forEach(k => {
		Object.keys(settings.authAccounts[k].clientKeys).forEach(u => {
			const publicKey = settings.authAccounts[k].clientKeys[u];
			let publicHash = crypto_generichash(crypto_generichash_BYTES, publicKey, undefined, "base64");
			if (!publicKeyLookup[publicHash + u]) publicKeyLookup[publicHash + u] = k;
			else throw "publicKey+username combination is used for more than one authAccount";
		})
		Object.keys(settings.authAccounts[k].passwords).forEach(u => {
			const password = settings.authAccounts[k].passwords[u];
			let passHash = crypto_generichash(crypto_generichash_BYTES, password, undefined, "base64");
			if (!passwordLookup[u]) passwordLookup[u] = k;
			else throw "username is used for more than one authAccount password list";
		})
	})

	checkCookieAuth = (request: http.IncomingMessage) => {
		if (!request.headers.cookie) return "";
		var cookies = {}, rc = request.headers.cookie as string;
		rc.split(';').forEach(function (cookie) {
			var parts = cookie.split('=');
			cookies[(parts.shift() as string).trim()] = parts.length ? decodeURI(parts.join('=')) : "";
		});
		let auth = cookies["TiddlyServerAuth"] as string;
		if (!auth) return "";
		let json = tryParseJSON<["pw" | "key", string, string, string, string]>(auth);
		if (!json) return "";

		let [type, username, timestamp, hash, sig] = json;
		let valid = crypto_sign_verify_detached(from_base64(sig),
			username + timestamp + hash,
			type === "key" ? from_base64(publicKeyLookup[hash + username]) : passwordKey.publicKey
		);
		if (!valid) return "";
		return username;

	};

}

eventer.on('settings', (set) => {
	settings = set;
	log = setLog();
	setAuth();
});
eventer.on('settingsChanged', (keys) => {
	// let watch: (keyof ServerConfig["server"])[] = ["server.logAccess", "server.logToConsoleAlso", "server.logColorsToFile"];
	// if (watch.some(e => keys.indexOf(e) > -1)) log = setLog();
})

// === Setup static routes
const routes = {
	'admin': state => handleAdminRoute(state),
	'assets': state => handleAssetsRoute(state),
	'favicon.ico': state => serveFile(state, 'favicon.ico', settings.__assetsDir),
	'directory.css': state => serveFile(state, 'directory.css', settings.__assetsDir),
};
const libsReady = Promise.all([libsodium.ready]);

//we make it a separate line because typescript loses the const if I export
export { routes, libsReady };

export interface RequestEvent {
	/** 
	 * Allows the preflighter to mark the request as handled, indicating it should not be processed further, 
	 * in which case, the preflighter takes full responsibility for the request, including calling end or close. 
	 * This is useful in case the preflighter wants to reject the request or initiate authentication, or wants to 
	 * handle a request using some other routing module. Do not override the /assets path or certain static assets will not be available.
	 */
	handled: boolean;
	/** auth account key to be applied to this request */
	authAccountKey: string;
	/** hostLevelPermissions key to be applied to this request */
	hostLevelPermissionsKey: string;
	/** 
	 * @argument iface HTTP server "host" option for this request, 
	 * @argument host the host header, 
	 * @argument addr socket.localAddress 
	 */
	interface: { iface: string, host: string | undefined, addr: string };

	request: http.IncomingMessage;
}
interface RequestEventHTTP extends RequestEvent { response: http.ServerResponse; }
interface RequestEventWS extends RequestEvent { client: WebSocket; }

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
export function addRequestHandlers(server: https.Server | http.Server, iface: string, preflighter) {
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
			hostLevelPermissionsKey: "",
			interface: { host, addr, iface },
			authAccountKey: "",
			request,
			client
		};
		requestHandlerHostLevelChecks(ev, preflighter).then(ev2 => {
			if (!ev2.handled) {
				// we give the preflighter the option to handle the websocket on its own
				if (settings.tiddlyserver.hostLevelPermissions[ev2.hostLevelPermissionsKey].websockets === false) client.close();
				else eventer.emit('websocket-connection', client, request);
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
	const bindWildcard = settings.server.bindWildcard;
	const tester = parseHostList([...settings.server.bindAddress, "-127.0.0.0/8"])
	const localhostTester = parseHostList(["127.0.0.0/8"]);

	await libsodium.ready;

	if (bindWildcard) {
		//bind to everything and filter elsewhere if needed
		hosts.push('0.0.0.0');
		if (settings.server.enableIPv6) hosts.push('::');
	} else if (settings.server.filterBindAddress) {
		//bind to all interfaces that match the specified addresses
		let ifaces = networkInterfaces();
		let addresses = Object.keys(ifaces)
			.reduce((n, k) => n.concat(ifaces[k]), [] as NetworkInterfaceInfo[])
			.filter(e => settings.server.enableIPv6 || e.family === "IPv4" && tester(e.address).usable)
			.map(e => e.address);
		hosts.push(...addresses);
	} else {
		//bind to all specified addresses
		hosts.push(...settings.server.bindAddress);
	}
	if (settings.server._bindLocalhost) hosts.push('localhost');
	if (hosts.length === 0) {
		let { filterBindAddress, bindAddress, bindWildcard, _bindLocalhost, enableIPv6 } = settings.server;
		console.log(`"No IP addresses will be listened on. This is probably a mistake.
bindWildcard is ${(bindWildcard ? "true" : "false")}
filterBindAddress is ${filterBindAddress ? "true" : "false"}
_bindLocalhost is ${_bindLocalhost ? "true" : "false"}
enableIPv6 is ${enableIPv6 ? "true" : "false"}
bindAddress is ${JSON.stringify(bindAddress, null, 2)}
`);
	}
	let servers: (http.Server | https.Server)[] = [];
	Observable.from(hosts).concatMap(host => {
		let server;
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
		if (bindWildcard && settings.server.filterBindAddress) server.on('connection', (socket) => {
			if (!tester(socket.localAddress).usable && !localhostTester(socket.localAddress).usable) socket.end();
		})
		servers.push(server);
		return new Observable(subs => {
			server.listen(settings.server.port, host, undefined, () => { subs.complete(); });
		})
	}).subscribe(item => { }, x => {
		console.log("Error thrown while starting server");
		console.log(x);
	}, () => {
		eventer.emit("serverOpen", servers, hosts, !!settingshttps);
		let ifaces = networkInterfaces();
		console.log('Open your browser and type in one of the following:\n' +
			(settings.server.bindWildcard
				? Object.keys(ifaces)
					.reduce(
						(n, k) => n.concat(ifaces[k]),
						[] as NetworkInterfaceInfo[]
					).filter(e =>
						(settings.server.enableIPv6 || e.family === "IPv4")
						&& (!settings.server.filterBindAddress || tester(e.address).usable)
					).map(e => e.address)
				: hosts
			).join('\n')
		);
	});

	return eventer;
}
/** 
 * handles all checks that apply to the entire server, including 
 *  - auth accounts key
 *  - host level permissions key (based on socket.localAddress)
 */
function requestHandlerHostLevelChecks<T extends RequestEvent>(
	ev: T,
	preflighter?: (ev: T) => Promise<T>
) {
	//connections to the wrong IP address are already filtered out by the connection event listener on the server.
	//determine hostLevelPermissions to be applied
	let localAddress = ev.request.socket.localAddress;
	let keys = Object.keys(settings.tiddlyserver.hostLevelPermissions);
	let isLocalhost = testAddress(localAddress, "127.0.0.1", 8);
	let matches = parseHostList(keys)(localAddress);
	if (isLocalhost) {
		ev.hostLevelPermissionsKey = "localhost";
	} else if (matches.lastMatch > -1) {
		ev.hostLevelPermissionsKey = keys[matches.lastMatch];
	} else {
		ev.hostLevelPermissionsKey = "*";
	}

	ev.authAccountKey = checkCookieAuth(ev.request);


	//send the data to the preflighter
	return preflighter ? preflighter(ev) : Promise.resolve(ev);
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
				hostLevelPermissionsKey: "",
				authAccountKey: "",
				interface: { host, addr, iface },
				request, response
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
				debug,
				eventer,
				ev.hostLevelPermissionsKey,
				ev.authAccountKey,
				settings
			);
			//handle basic auth
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

const errLog = DebugLogger('STATE_ERR');
eventer.on("stateError", (state) => {
	if (state.doneMessage.length > 0)
		dbgLog(2, state.doneMessage.join('\n'));
})
const dbgLog = DebugLogger('STATE_DBG');
eventer.on("stateDebug", (state) => {
	if (state.doneMessage.length > 0)
		dbgLog(-2, state.doneMessage.join('\n'));
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
		debug(-2, 'authorization required');
		state.respond(401, "", { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' }).empty();
		return false;
	}
	debug(-3, 'authorization requested');
	var header = first(state.req.headers['authorization']) || '',  // get the header
		token = header.split(/\s+/).pop() || '',                   // and the encoded auth token
		auth = new Buffer(token, 'base64').toString(),             // convert from base64
		parts = auth.split(/:/),                                   // split on colon
		username = parts[0],
		password = parts[1];
	if (username !== settings.username || password !== settings.password) {
		debug(-2, 'authorization invalid - UN:%s - PW:%s', username, password);
		state.throwReason(401, 'Invalid username or password');
		return false;
	}
	debug(-3, 'authorization successful')
	// securityChecks =====================

	return true;
}
