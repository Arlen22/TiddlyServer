import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
import {
	StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag, DirectoryEntry,
	Directory, sortBySelector, obs_stat, obs_readdir, FolderEntryType, obsTruthy,
	StatPathResult, DebugLogger, TreeObject, PathResolverResult, TreePathResult, resolvePath,
	sendDirectoryIndex, statWalkPath, typeLookup, DirectoryIndexOptions, DirectoryIndexData,
	ServerEventEmitter, ER, getNewTreePathFiles, isNewTreeGroup, NewTreePath, NewTreeItem, NewTreeGroup, NewTreePathOptions_Auth, StandardResponseHeaders
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

import { format, inspect } from "util";
import { Stream, Writable } from "stream";
import { Subscribable } from "rxjs/Observable";
import { NextObserver, ErrorObserver, CompletionObserver } from "rxjs/Observer";
import { AnonymousSubscription } from "rxjs/Subscription";

import { send, formidable } from '../lib/bundled-lib';
import { Stats } from "fs";
import { last } from "rxjs/operator/last";

const debug = DebugLogger("SER-API");
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

var settings: ServerConfig = {} as any;

export function init(eventer: ServerEventEmitter) {
	eventer.on('settings', function (set: ServerConfig) {
		settings = set;
	});
	initTiddlyWiki(eventer);
}

type apiListRouteState = [[string, string], string | any, StateObject]
export function checkRouteAllowed(state: StateObject, result: PathResolverResult) {
	type CC = (NewTreeGroup["$children"][0] | NewTreePath["$children"][0]);
	let lastAuth: NewTreePathOptions_Auth | undefined;
	result.ancestry.concat(result.item).forEach((e) => {
		lastAuth = Array.isArray(e.$children)
			&& (e.$children as CC[]).find((f): f is NewTreePathOptions_Auth => f.$element === "auth")
			|| lastAuth;
	});
	return !lastAuth || lastAuth.authList.indexOf(state.authAccountsKey) !== -1;
}
export function handleTiddlyServerRoute(state: StateObject) {

	// const resolvePath = (settings.tree);
	Observable.of(state).mergeMap((state: StateObject) => {
		var result = resolvePath(state, settings.tree) as PathResolverResult;
		if (!result) return state.throw<never>(404);
		//handle route authentication
		if (!checkRouteAllowed(state, result)) {
			return state.throw<never>(403);
		}
		// console.log(result.ancestry, result.reqpath.length);
		if (isNewTreeGroup(result.item)) {
			serveDirectoryIndex(result, state);
			return Observable.empty<never>();
		} else {
			return statWalkPath(result).map(stat => {
				state.statPath = stat;
				return result;
			});
		}
	}).map(result => {
		if (state.statPath.itemtype === "folder") {
			serveDirectoryIndex(result, state);
		} else if (state.statPath.itemtype === "datafolder") {
			handleDataFolderRequest(result, state);
		} else if (state.statPath.itemtype === "file") {
			if (['HEAD', 'GET'].indexOf(state.req.method as string) > -1) {
				state.send({
					root: (result.item as NewTreePath).path as string,
					filepath: result.filepathPortion.join('/'),
					error: err => {
						state.log(2, '%s %s', err.status, err.message);
						if (state.allow.writeErrors) state.throw(500);
					},
					headers: (filepath) => {
						const statItem = state.statPath.stat;
						const mtime = Date.parse(state.statPath.stat.mtime as any);
						const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
						return { 'Etag': etag };
					}
				})
			} else if (['PUT'].indexOf(state.req.method as string) > -1) {
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
	}).subscribe();
}
function handleFileError(err: NodeJS.ErrnoException) {
	debug(2, "%s %s\n%s", err.code, err.message, err.path);
}

function serveDirectoryIndex(result: PathResolverResult, state: StateObject) {
	// const { state } = result;
	const allow = state.allow;
	// console.log(state.url);
	if (!state.url.pathname.endsWith("/")) {
		state.redirect(state.url.pathname + "/");
	} else if (state.req.method === "GET") {
		const isFolder = result.item.$element === "folder";
		const options = {
			upload: isFolder && (allow.upload),
			mkdir: isFolder && (allow.mkdir),
			mixFolders: settings.directoryIndex.mixFolders
		};
		getNewTreePathFiles(result, state)
			.map(e => [e, options] as [typeof e, typeof options])
			.concatMap(sendDirectoryIndex)
			.subscribe(res => {
				state.respond(200, "", { 'Content-Type': 'text/html', "Content-Encoding": 'utf-8' })
					.buffer(Buffer.from(res, "utf8"));
			});
	} else if (state.req.method === "POST") {
		var form = new formidable.IncomingForm();
		// console.log(state.url);
		if (state.url.query.formtype === "upload") {

			if (isNewTreeGroup(result.item))
				return state.throwReason(400, "upload is not possible for tree items");
			if (!allow.upload)
				return state.throwReason(403, "upload is not allowed over the network")

			form.parse(state.req, function (err: Error, fields, files) {
				if (err) {
					debug(2, "upload %s", err.toString());
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
					if (err) handleFileError(err)
					state.redirect(state.url.pathname + (err ? "?error=upload" : ""));
				});
			});
		} else if (state.url.query.formtype === "mkdir") {
			if (isNewTreeGroup(result.item))
				return state.throwReason(400, "mkdir is not possible for tree items");
			if (!allow.mkdir)
				return state.throwReason(403, "mkdir is not allowed over the network")
			form.parse(state.req, function (err: Error, fields, files) {
				if (err) {
					debug(2, "mkdir %s", err.toString());
					state.throwError(500, new ER("Error recieving request", err.toString()))
					return;
				}
				fs.mkdir(path.join(result.fullfilepath, fields.dirname), (err) => {
					if (err) {
						handleFileError(err);
						state.redirect(state.url.pathname + "?error=mkdir");
					} else if (fields.dirtype === "datafolder") {
						let read = fs.createReadStream(path.join(__dirname, "../tiddlywiki/datafolder-template.json"));
						let write = fs.createWriteStream(path.join(result.fullfilepath, fields.dirname, "tiddlywiki.info"));
						read.pipe(write);
						let error;
						const errorHandler = (err) => {
							handleFileError(err);
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

function handlePUTrequest(state: StateObject) {
	// const hash = createHash('sha256').update(fullpath).digest('base64');
	const first = (header?: string | string[]) =>
		Array.isArray(header) ? header[0] : header;
	const fullpath = state.statPath.statpath;
	const statItem = state.statPath.stat;
	const mtime = Date.parse(state.statPath.stat.mtime as any);
	const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
	const ifmatchStr: string = first(state.req.headers['if-match']) || '';
	if (settings.tiddlyserver.etag !== "disabled" && (ifmatchStr || settings.tiddlyserver.etag === "required") && (ifmatchStr !== etag)) {
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
		if (!settings.tiddlyserver.etagWindow || diskTime - (settings.tiddlyserver.etagWindow * 1000) > headTime)
			return state.throw(412);
		console.log('412 prevented by etagWindow of %s seconds', settings.tiddlyserver.etagWindow);
	}
	new Observable((subscriber) => {
		if (settings.tiddlyserver.backupDirectory) {
			const backupFile = state.url.pathname.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
			const ext = path.extname(backupFile);
			const backupWrite = fs.createWriteStream(path.join(settings.tiddlyserver.backupDirectory, backupFile + "-" + mtime + ext + ".gz"));
			const fileRead = fs.createReadStream(fullpath);
			const gzip = zlib.createGzip();
			const pipeError = (err) => {
				debug(3, 'Error saving backup file for %s: %s\r\n%s', state.url.pathname, err.message,
					"Please make sure the backup directory actually exists or else make the " +
					"backupDirectory key falsy in your settings file (e.g. set it to a " +
					"zero length string or false, or remove it completely)");
				state.log(3, "Backup could not be saved, see server output").throw(500);
				fileRead.close();
				gzip.end();
				backupWrite.end();
				subscriber.complete();
			};
			fileRead.on('error', pipeError);
			gzip.on('error', pipeError);
			backupWrite.on('error', pipeError);
			fileRead.pipe(gzip).pipe(backupWrite).on('close', () => {
				subscriber.next();
				subscriber.complete();
			})
		} else {
			subscriber.next();
			subscriber.complete();
		}
	}).switchMap(() => {
		// let stream: Stream = state.req;

		const write = state.req.pipe(fs.createWriteStream(fullpath));
		const finish = Observable.fromEvent(write, 'finish').take(1);
		return Observable.merge(finish, Observable.fromEvent(write, 'error').takeUntil(finish)).switchMap((err: Error) => {
			if (err) {
				return state
					.log(2, "Error writing the updated file to disk")
					.log(2, err.stack || [err.name, err.message].join(': '))
					.throw(500);
			} else {
				return obs_stat(false)(fullpath) as any;
			}
		}).map(([err, statNew]) => {
			const mtimeNew = Date.parse(statNew.mtime as any);
			const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join('-'));
			state.respond(200, "", {
				'x-api-access-type': 'file',
				'etag': etagNew
			})
		})
	}).subscribe();
}


