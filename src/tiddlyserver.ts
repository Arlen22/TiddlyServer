// import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
import {
	StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag, DirectoryEntry,
	Directory, sortBySelector, FolderEntryType, obsTruthy,
	StatPathResult, TreeObject, PathResolverResult, TreePathResult, resolvePath,
	sendDirectoryIndex, statWalkPath, DirectoryIndexOptions, DirectoryIndexData,
	ServerEventEmitter, ER, getTreePathFiles, NewTreePathOptions_Auth, StandardResponseHeaders,
	serveFile, Config, as
} from "./server-types";

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as zlib from 'zlib';

import { createHash } from 'crypto';

import { STATUS_CODES } from 'http';
import { EventEmitter } from "events";

import { handleDataFolderRequest, init as initTiddlyWiki, handleTiddlyWikiRoute } from "./datafolder";
export { handleTiddlyWikiRoute };

import { format, inspect, promisify, puts } from "util";
import { Stream, Writable } from "stream";
// import { Subscribable } from "rxjs/Observable";
// import { NextObserver, ErrorObserver, CompletionObserver } from "rxjs/Observer";
// import { AnonymousSubscription } from "rxjs/Subscription";

import { send, formidable } from '../lib/bundled-lib';
import { Stats } from "fs";
// import { last } from "rxjs/operator/last";
import { NewTreeOptions, NewTreePathOptions_Backup, NewTreePathOptions_Index, NewTreeOptionsObject, OptionsSchema, OptionsConfig } from "./server-config";

// const debugTag = "SER-API";
__dirname = path.dirname(module.filename || process.execPath);

function tuple<T1, T2, T3, T4, T5, T6>(a?: T1, b?: T2, c?: T3, d?: T4, e?: T5, f?: T6) {
	return [a, b, c, d, e, f] as [T1, T2, T3, T4, T5, T6];
}

export function parsePath(path: string, jsonFile: string) {
	var regCheck = /${([^}])}/gi;
	path.replace(regCheck, (str, pathVar) => {
		switch (pathVar) {
			case "execPath": return __dirname;
			case "currDir": return process.cwd();
			case "jsonDir": return jsonFile;
			default: return "";
		}
	})
	return path;
}

// var settings: ServerConfig = {} as any;

export function init(eventer: ServerEventEmitter) {
	eventer.on('settings', function (set: ServerConfig) {
		// settings = set;
	});
	initTiddlyWiki(eventer);
}

type apiListRouteState = [[string, string], string | any, StateObject]
// export function checkRouteAllowed(state: StateObject, result: PathResolverResult) {
// 	return true;
// 	type CC = (NewTreeGroup["$children"][0] | NewTreeOptions);
// 	let lastAuth: NewTreePathOptions_Auth | undefined;
// 	let findAuth = (f): f is NewTreePathOptions_Auth => f.$element === "auth";
// 	result.ancestry.concat(result.item).forEach((e) => {
// 		lastAuth = Array.isArray(e.$children) && (e.$children as CC[]).find(findAuth) || lastAuth;
// 	});
// 	// console.log(lastAuth, state.authAccountsKey);
// 	return !lastAuth || lastAuth.authList.indexOf(state.authAccountsKey) !== -1;
// }

export function getTreeOptions(state: StateObject) {
	//nonsense we have to write because putsaver could be false
	type putsaverT = Required<typeof state.settings.putsaver>;
	let putsaver = as<Exclude<putsaverT, false>>({
		gzipBackups: true,
		backupFolder: "",
		etag: "optional",
		etagAge: 3,
		...(state.settings.putsaver || {})
	});
	let options: OptionsConfig = {
		auth: { $element: "auth", authError: 403, authList: null },
		putsaver: { $element: "putsaver", ...putsaver },
		index: { $element: "index", defaultType: state.settings.directoryIndex.defaultType, indexFile: [], indexExts: [] }
	}
	state.ancestry.forEach((e) => {
		// console.log(e);
		e.$children && e.$children.forEach((f: Config.MountElement | Config.OptionElements) => {
			if (f.$element === "auth" || f.$element === "putsaver" || f.$element === "index") {
				Object.keys(f).forEach(k => {
					if (f[k] === undefined) return;
					options[f.$element][k] = f[k];
				})
			}
		})
	});
	return options;
}
export function handleTiddlyServerRoute(state: StateObject): void {
	// var result: PathResolverResult | undefined;
	// const resolvePath = (settings.tree);
	// Promise.resolve().then(() => {

	let result: PathResolverResult = resolvePath(state, state.hostRoot) || null as never;
	if (!result) {
		state.throw<never>(404);
		return;
	}
	state.ancestry = [...result.ancestry, result.item];
	state.treeOptions = getTreeOptions(state);
	//handle route authentication
	let { authList, authError } = state.treeOptions.auth;
	if (authList && authList.indexOf(state.authAccountsKey) === -1) {
		state.throw<never>(authError);
		// return Promise.reject();
	} else if (Config.isGroup(result.item)) {
		serveDirectoryIndex(result, state);
		// return Promise.reject();
	} else {
		const stateItemType = <T extends StatPathResult["itemtype"]>(state: StateObject, itemtype: T): state is StateObject<Extract<StatPathResult, { itemtype: typeof itemtype }>> => state.statPath.itemtype === itemtype;
		statWalkPath(result).then((statPath) => {
			state.statPath = statPath;
			if (stateItemType(state, "folder")) {
				serveDirectoryIndex(result, state);
			} else if (stateItemType(state, "datafolder")) {
				handleDataFolderRequest(result, state);
			} else if (stateItemType(state, "file")) {
				if (['HEAD', 'GET'].indexOf(state.req.method as string) > -1) {
					state.send({
						root: (result.item as Config.PathElement).path,
						filepath: result.filepathPortion.join('/'),
						error: err => {
							state.log(2, '%s %s', err.status, err.message);
							if (state.allow.writeErrors) state.throw(500);
						},
						headers: ((statPath) => (filepath) => {
							const statItem = statPath.stat;
							const mtime = Date.parse(statPath.stat.mtime as any);
							const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
							return { 'Etag': etag };
						})(state.statPath)
					})
				} else if (['PUT'].indexOf(state.req.method as string) > -1) {
					// state.statPath.itemtype
					handlePUTrequest(state);
				} else if (['OPTIONS'].indexOf(state.req.method as string) > -1) {
					state.respond(200, "", {
						'x-api-access-type': 'file',
						'dav': 'tw5/put'
					}).string("GET,HEAD,PUT,OPTIONS");
				} else state.throw(405);
			} else if (state.statPath.itemtype === "error") {
				state.throw(404);
			} else {
				state.throw(500);
			}
		}).catch((err) => {
			if (err) { console.log(err); console.log(new Error().stack); }
		});
	}
}

function handleFileError(debugTag: string, state: StateObject, err: NodeJS.ErrnoException) {
	StateObject.DebugLogger(debugTag).call(state, 2, "%s %s\n%s", err.code, err.message, err.path);
}
function debugState(debugTag: string, state: StateObject) {
	return StateObject.DebugLogger(debugTag).bind(state);
}
function serveDirectoryIndex(result: PathResolverResult, state: StateObject) {
	// const { state } = result;
	const allow = state.allow;

	// console.log(state.url);
	if (!state.url.pathname.endsWith("/")) {
		state.redirect(state.url.pathname + "/");
	} else if (state.req.method === "GET") {
		const isFolder = result.item.$element === "folder";
		Promise.resolve().then(async () => {
			let { indexFile, indexExts, defaultType } = state.treeOptions.index;

			if (isFolder && indexExts.length && indexFile.length) {
				let files = await promisify(fs.readdir)(result.fullfilepath);
				let indexFiles: string[] = [];
				indexFile.forEach(e => {
					indexExts.forEach(f => {
						if (f === "") indexFiles.push(e);
						else indexFiles.push(e + "." + f);
					});
				});
				let index = indexFiles.find((e) => files.indexOf(e) !== -1);
				if (index) {
					serveFile(state, index, result.fullfilepath);
					return false;
				} else if (defaultType === 403 || defaultType === 404) {
					state.throw(defaultType);
					return false;
				} else {
					return true;
				}
			} else if (result.item.$element === "group" && result.item.indexPath) {
				let { indexPath } = result.item;
				state.send({
					root: undefined,
					filepath: indexPath,
					error: (err) => {
						let error = new ER("error sending index", err.toString());
						state.log(2, error.message).throwError(500, error);
					}
				});
				return false;
			} else
				return true;
		}).then(async (contin: boolean) => {
			if (!contin) return;
			const format = state.treeOptions.index.defaultType as "html" | "json";
			const options = {
				upload: isFolder && (allow.upload),
				mkdir: isFolder && (allow.mkdir),
				mixFolders: state.settings.directoryIndex.mixFolders,
				isLoggedIn: state.username ? (state.username + " (group " + state.authAccountsKey + ")") : false as false,
				format, extTypes: state.settings.directoryIndex.types
			};
			let contentType = {
				html: "text/html",
				json: "application/json"
			};
			let e = await getTreePathFiles(result, state);
			let res = await sendDirectoryIndex([e, options]);
			state.respond(200, "", { 'Content-Type': contentType[format], "Content-Encoding": 'utf-8' }).buffer(Buffer.from(res, "utf8"));

		}).catch(err => {
			if (err) {
				state.log(2, "Error caught " + err.toString());
				state.throw(500);
				//catch all: return nothing
			}
		});;
	} else if (state.req.method === "POST") {
		var form = new formidable.IncomingForm();
		// console.log(state.url);
		if (state.url.query.formtype === "upload") {

			if (Config.isGroup(result.item))
				return state.throwReason(400, "upload is not possible for tree groups");
			if (!allow.upload)
				return state.throwReason(403, "upload is not allowed over the network")

			form.parse(state.req, function (err: Error, fields, files) {
				if (err) {
					debugState("SER-DIR", state)(2, "upload %s", err.toString());
					state.throwError(500, new ER("Error recieving request", err.toString()));
					return;
				}
				// console.log(fields, files);
				var oldpath = files.filetoupload.path;
				//get the filename to use
				let newname = fields.filename || files.filetoupload.name;
				//sanitize this to make sure we just 
				newname = path.basename(newname);
				var newpath = path.join(result.fullfilepath, newname);
				fs.rename(oldpath, newpath, function (err) {
					if (err) handleFileError("SER-DIR", state, err)
					state.redirect(state.url.pathname + (err ? "?error=upload" : ""));
				});
			});
		} else if (state.url.query.formtype === "mkdir") {
			if (Config.isGroup(result.item))
				return state.throwReason(400, "mkdir is not possible for tree items");
			if (!allow.mkdir)
				return state.throwReason(403, "mkdir is not allowed over the network")
			form.parse(state.req, function (err: Error, fields, files) {
				if (err) {
					debugState("SER-DIR", state)(2, "mkdir %s", err.toString());
					state.throwError(500, new ER("Error recieving request", err.toString()))
					return;
				}
				fs.mkdir(path.join(result.fullfilepath, fields.dirname), (err) => {
					if (err) {
						handleFileError("SER-DIR", state, err);
						state.redirect(state.url.pathname + "?error=mkdir");
					} else if (fields.dirtype === "datafolder") {
						let read = fs.createReadStream(path.join(__dirname, "../tiddlywiki/datafolder-template.json"));
						let write = fs.createWriteStream(path.join(result.fullfilepath, fields.dirname, "tiddlywiki.info"));
						read.pipe(write);
						let error;
						const errorHandler = (err) => {
							handleFileError("SER-DIR", state, err);
							error = err;
							state.redirect(state.url.pathname + "?error=mkdf");
							read.close();
							write.close();
						};
						write.on('error', errorHandler);
						read.on('error', errorHandler);
						write.on('close', () => {
							if (!error) state.redirect(state.url.pathname);
						})
					} else {
						state.redirect(state.url.pathname);
					}
				})
			});
		} else {
			state.throw(403);
		}
	} else {
		state.throw(405);
	}
}

/// file handler section =============================================

function handlePUTrequest(state: StateObject<Extract<StatPathResult, { itemtype: "file" }>>) {
	if (state.settings.putsaver === false) {
		let message = "PUT saver is disabled on this server";
		state.log(-2, message);
		state.respond(405, message).string(message);
		return;
	}
	// const hash = createHash('sha256').update(fullpath).digest('base64');
	const first = (header?: string | string[]) =>
		Array.isArray(header) ? header[0] : header;
	const t = state.statPath;
	const fullpath = state.statPath.statpath;
	const statItem = state.statPath.stat;
	const mtime = Date.parse(state.statPath.stat.mtime as any);
	const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
	const ifmatchStr: string = first(state.req.headers['if-match']) || '';
	if (state.settings.putsaver.etag !== "disabled" && (ifmatchStr || state.settings.putsaver.etag === "required") && (ifmatchStr !== etag)) {
		const ifmatch = JSON.parse(ifmatchStr).split('-');
		const _etag = JSON.parse(etag).split('-');
		console.log('412 ifmatch %s', ifmatchStr);
		console.log('412 etag %s', etag);
		ifmatch.forEach((e, i) => {
			if (_etag[i] !== e) console.log("412 caused by difference in %s", ['inode', 'size', 'modified'][i])
		})
		let headTime = +ifmatch[2];
		let diskTime = mtime;
		// console.log(settings.etagWindow, diskTime, headTime);
		if (!state.settings.putsaver.etagAge || diskTime - (state.settings.putsaver.etagAge * 1000) > headTime)
			return state.throw(412);
		console.log('412 prevented by etagWindow of %s seconds', state.settings.putsaver.etagAge);
	}
	new Promise((resolve, reject) => {
		if (state.treeOptions.putsaver.backupFolder) {
			const backupFile = state.url.pathname.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
			const ext = path.extname(backupFile);
			const backupWrite = fs.createWriteStream(path.join(state.treeOptions.putsaver.backupFolder, backupFile + "-" + mtime + ext + ".gz"));
			const fileRead = fs.createReadStream(fullpath);
			const gzip = zlib.createGzip();
			const pipeError = (err) => {
				debugState("SER-SFS", state)(3, 'Error saving backup file for %s: %s\r\n%s', state.url.pathname, err.message,
					"Please make sure the backup directory actually exists or else make the " +
					"backupDirectory key falsy in your settings file (e.g. set it to a " +
					"zero length string or false, or remove it completely)");
				state.log(3, "Backup could not be saved, see server output").throw(500);
				fileRead.close();
				gzip.end();
				backupWrite.end();
				reject();
			};
			fileRead.on('error', pipeError);
			gzip.on('error', pipeError);
			backupWrite.on('error', pipeError);
			fileRead.pipe(gzip).pipe(backupWrite).on('close', () => {
				resolve();
			})
		} else {
			resolve();
		}
	}).then(() => {
		return new Promise((resolve, reject) => {
			const write = state.req.pipe(fs.createWriteStream(fullpath));
			write.on("finish", () => {
				resolve();
			});
			write.on("error", (err: Error) => {
				state
					.log(2, "Error writing the updated file to disk")
					.log(2, err.stack || [err.name, err.message].join(': '))
					.throw(500);
				reject();
			});
		}).then(() => {
			return promisify(fs.stat)(fullpath).catch(err => {
				state.log(2, "statNew target does not exist");
				state.throw(500);
				return Promise.reject();
			});
		});
	}).then((statNew) => {
		const mtimeNew = Date.parse(statNew.mtime as any);
		const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join('-'));
		state.respond(200, "", {
			'x-api-access-type': 'file',
			'etag': etagNew
		}).empty();
	}).catch(() => {
		//this just means the request got handled early
	})
}


