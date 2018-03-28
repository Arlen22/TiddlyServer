import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
import {
	StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag, DirectoryEntry,
	Directory, sortBySelector, obs_stat, obs_readdir, FolderEntryType, obsTruthy,
	StatPathResult, DebugLogger, TreeObject, PathResolverResult, TreePathResult, resolvePath,
	sendDirectoryIndex, getTreeItemFiles, statWalkPath, typeLookup, DirectoryIndexOptions, DirectoryIndexData, ServerEventEmitter
} from "./server-types";

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as zlib from 'zlib';

import { createHash } from 'crypto';

import { STATUS_CODES } from 'http';
import { EventEmitter } from "events";

import { datafolder, init as initTiddlyWiki, doTiddlyWikiRoute } from "./datafolder";
export { doTiddlyWikiRoute };

import { format } from "util";
import { Stream, Writable } from "stream";
import { Subscribable } from "rxjs/Observable";
import { NextObserver, ErrorObserver, CompletionObserver } from "rxjs/Observer";
import { AnonymousSubscription } from "rxjs/Subscription";

import { send, formidable } from '../lib/bundled-lib';
import { Stats } from "fs";

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

export function doTiddlyServerRoute(input: Observable<StateObject>) {
	// const resolvePath = (settings.tree);
	return input.mergeMap((state: StateObject) => {
		var result = resolvePath(state, settings.tree) as PathResolverResult;
		if (!result) return state.throw<never>(404);
		else if (typeof result.item === "object") {
			serveDirectoryIndex(result);
			return Observable.empty<never>();
		} else {
			return statWalkPath(result).map(stat => {
				state.statPath = stat;
				return result;
			});
		}
	}).map(result => {
		const { state } = result;

		if (state.statPath.itemtype === "folder") {
			serveDirectoryIndex(result);
		} else if (state.statPath.itemtype === "datafolder") {
			datafolder(result);
		} else if (state.statPath.itemtype === "file") {
			if (['HEAD', 'GET'].indexOf(state.req.method as string) > -1) {
				send(state.req, result.filepathPortion.join('/'), { root: result.item })
					.on('error', (err) => {
						state.log(2, '%s %s', err.status, err.message).throw(500);
					}).on('headers', (res, filepath) => {
						const statItem = state.statPath.stat;
						const mtime = Date.parse(state.statPath.stat.mtime as any);
						const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
						res.setHeader('Etag', etag);
					}).pipe(state.res);
			} else if (['PUT'].indexOf(state.req.method as string) > -1) {
				handlePUTrequest(state);
			} else if (['OPTIONS'].indexOf(state.req.method as string) > -1) {
				state.res.writeHead(200, {
					'x-api-access-type': 'file',
					'dav': 'tw5/put'
				});
				state.res.write("GET,HEAD,PUT,OPTIONS");
				state.res.end();
			} else state.throw(405);
		} else if (state.statPath.itemtype === "error") {
			state.throw(404);
		} else {
			state.throw(500);
		}
	}).ignoreElements();
}
function handleFileError(err: NodeJS.ErrnoException) {
	debug(2, "%s %s\n%s", err.code, err.message, err.path);
}

function serveDirectoryIndex(result: PathResolverResult) {
	const { state } = result;
	const allow = state.isLocalHost ? settings.allowLocalhost : settings.allowNetwork;
	// console.log(state.url);
	if (!state.url.pathname.endsWith("/")) {
		state.redirect(state.url.pathname + "/");
	} else if (state.req.method === "GET") {
		const isFolder = typeof result.item === "string";
		const options = {
			upload: isFolder && (allow.upload),
			mkdir: isFolder && (allow.mkdir)
		};
		Observable.of(result)
			.concatMap(getTreeItemFiles)
			.map(e => [e, options] as [typeof e, typeof options])
			.concatMap(sendDirectoryIndex)
			.subscribe(res => {
				state.res.writeHead(200, { 'content-type': 'text/html' });
				state.res.write(res);
				state.res.end();
			});
	} else if (state.req.method === "POST") {
		var form = new formidable.IncomingForm();
		// console.log(state.url);
		if (state.url.query.formtype === "upload") {
			if (typeof result.item !== "string")
				return state.throw(400, "upload is not possible for tree items");
			if (!allow.upload)
				return state.throw(403, "upload is not allowed over the network")
			form.parse(state.req, function (err, fields, files) {
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
			if (typeof result.item !== "string")
				return state.throw(400, "mkdir is not possible for tree items");
			if (!allow.mkdir)
				return state.throw(403, "mkdir is not allowed over the network")
			form.parse(state.req, function (err, fields, files) {
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
	const fullpath = state.statPath.statpath;
	const statItem = state.statPath.stat;
	const mtime = Date.parse(state.statPath.stat.mtime as any);
	const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
	if (settings.etag !== "disabled" && (state.req.headers['if-match'] || settings.etag === "required") && (state.req.headers['if-match'] !== etag)) {
		const ifmatch = JSON.parse(state.req.headers['if-match']).split('-');
		const _etag = JSON.parse(etag).split('-');
		console.log('412 ifmatch %s', state.req.headers['if-match']);
		console.log('412 etag %s', etag);
		ifmatch.forEach((e, i) => {
			if (_etag[i] !== e) console.log("412 caused by difference in %s", ['inode', 'size', 'modified'][i])
		})
		let headTime = +ifmatch[2];
		let diskTime = mtime;
		// console.log(settings.etagWindow, diskTime, headTime);
		if (!settings.etagWindow || diskTime - (settings.etagWindow * 1000) > headTime)
			return state.throw(412);
		console.log('412 prevented by etagWindow of %s seconds', settings.etagWindow);
	}
	new Observable((subscriber) => {
		if (settings.backupDirectory) {
			const backupFile = state.url.pathname.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
			const ext = path.extname(backupFile);
			const backupWrite = fs.createWriteStream(path.join(settings.backupDirectory, backupFile + "-" + mtime + ext + ".gz"));
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
		let stream: Stream = state.req;

		const write = stream.pipe(fs.createWriteStream(fullpath));
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
			state.res.writeHead(200, {
				'x-api-access-type': 'file',
				'etag': etagNew
			})
			state.res.end();
		})
	}).subscribe();
}


