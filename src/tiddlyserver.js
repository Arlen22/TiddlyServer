"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
const server_types_1 = require("./server-types");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const datafolder_1 = require("./datafolder");
exports.handleTiddlyWikiRoute = datafolder_1.handleTiddlyWikiRoute;
const util_1 = require("util");
// import { Subscribable } from "rxjs/Observable";
// import { NextObserver, ErrorObserver, CompletionObserver } from "rxjs/Observer";
// import { AnonymousSubscription } from "rxjs/Subscription";
const bundled_lib_1 = require("../lib/bundled-lib");
// const debugTag = "SER-API";
__dirname = path.dirname(module.filename || process.execPath);
function tuple(a, b, c, d, e, f) {
    return [a, b, c, d, e, f];
}
function parsePath(path, jsonFile) {
    var regCheck = /${([^}])}/gi;
    path.replace(regCheck, (str, pathVar) => {
        switch (pathVar) {
            case "execPath": return __dirname;
            case "currDir": return process.cwd();
            case "jsonDir": return jsonFile;
            default: return "";
        }
    });
    return path;
}
exports.parsePath = parsePath;
// var settings: ServerConfig = {} as any;
function init(eventer) {
    eventer.on('settings', function (set) {
        // settings = set;
    });
    datafolder_1.init(eventer);
}
exports.init = init;
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
function getTreeOptions(state) {
    let options = {
        auth: { $element: "auth", authError: 403, authList: null },
        backups: { $element: "backups", backupFolder: "", etagAge: 0, gzip: true },
        index: { $element: "index", defaultType: "html", indexFile: [], indexExts: [] }
    };
    state.ancestry.forEach((e) => {
        // console.log(e);
        e.$children && e.$children.forEach((f) => {
            if (f.$element === "auth" || f.$element === "backups" || f.$element === "index") {
                Object.keys(f).forEach(k => {
                    if (f[k] === undefined)
                        return;
                    options[f.$element][k] = f[k];
                });
            }
        });
    });
    return options;
}
exports.getTreeOptions = getTreeOptions;
function handleTiddlyServerRoute(state) {
    // var result: PathResolverResult | undefined;
    // const resolvePath = (settings.tree);
    // Promise.resolve().then(() => {
    let result = server_types_1.resolvePath(state, state.hostRoot) || null;
    if (!result) {
        state.throw(404);
        return;
    }
    state.ancestry = [...result.ancestry, result.item];
    state.treeOptions = getTreeOptions(state);
    //handle route authentication
    let { authList, authError } = state.treeOptions.auth;
    if (authList && authList.indexOf(state.authAccountsKey) === -1) {
        state.throw(authError);
        // return Promise.reject();
    }
    else if (server_types_1.Config.isGroup(result.item)) {
        serveDirectoryIndex(result, state);
        // return Promise.reject();
    }
    else {
        const stateItemType = (state, itemtype) => state.statPath.itemtype === itemtype;
        server_types_1.statWalkPath(result).then((statPath) => {
            state.statPath = statPath;
            if (stateItemType(state, "folder")) {
                serveDirectoryIndex(result, state);
            }
            else if (stateItemType(state, "datafolder")) {
                datafolder_1.handleDataFolderRequest(result, state);
            }
            else if (stateItemType(state, "file")) {
                if (['HEAD', 'GET'].indexOf(state.req.method) > -1) {
                    state.send({
                        root: result.item.path,
                        filepath: result.filepathPortion.join('/'),
                        error: err => {
                            state.log(2, '%s %s', err.status, err.message);
                            if (state.allow.writeErrors)
                                state.throw(500);
                        },
                        headers: ((statPath) => (filepath) => {
                            const statItem = statPath.stat;
                            const mtime = Date.parse(statPath.stat.mtime);
                            const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
                            return { 'Etag': etag };
                        })(state.statPath)
                    });
                }
                else if (['PUT'].indexOf(state.req.method) > -1) {
                    // state.statPath.itemtype
                    handlePUTrequest(state);
                }
                else if (['OPTIONS'].indexOf(state.req.method) > -1) {
                    state.respond(200, "", {
                        'x-api-access-type': 'file',
                        'dav': 'tw5/put'
                    }).string("GET,HEAD,PUT,OPTIONS");
                }
                else
                    state.throw(405);
            }
            else if (state.statPath.itemtype === "error") {
                state.throw(404);
            }
            else {
                state.throw(500);
            }
        }).catch((err) => {
            if (err) {
                console.log(err);
                console.log(new Error().stack);
            }
        });
    }
}
exports.handleTiddlyServerRoute = handleTiddlyServerRoute;
function handleFileError(debugTag, state, err) {
    server_types_1.StateObject.DebugLogger(debugTag).call(state, 2, "%s %s\n%s", err.code, err.message, err.path);
}
function debugState(debugTag, state) {
    return server_types_1.StateObject.DebugLogger(debugTag).bind(state);
}
function serveDirectoryIndex(result, state) {
    // const { state } = result;
    const allow = state.allow;
    // console.log(state.url);
    if (!state.url.pathname.endsWith("/")) {
        state.redirect(state.url.pathname + "/");
    }
    else if (state.req.method === "GET") {
        const isFolder = result.item.$element === "folder";
        Promise.resolve().then(() => __awaiter(this, void 0, void 0, function* () {
            let { indexFile, indexExts, defaultType } = state.treeOptions.index;
            if (isFolder && indexExts.length && indexFile.length) {
                let files = yield util_1.promisify(fs.readdir)(result.fullfilepath);
                let indexFiles = [];
                indexFile.forEach(e => {
                    indexExts.forEach(f => {
                        if (f === "")
                            indexFiles.push(e);
                        else
                            indexFiles.push(e + "." + f);
                    });
                });
                let index = indexFiles.find((e) => files.indexOf(e) !== -1);
                if (index) {
                    server_types_1.serveFile(state, index, result.fullfilepath);
                    return false;
                }
                else if (defaultType === 403 || defaultType === 404) {
                    state.throw(defaultType);
                    return false;
                }
                else {
                    return true;
                }
            }
            else if (result.item.$element === "group" && result.item.indexPath) {
                let { indexPath } = result.item;
                state.send({
                    root: undefined,
                    filepath: indexPath,
                    error: (err) => {
                        let error = new server_types_1.ER("error sending index", err.toString());
                        state.log(2, error.message).throwError(500, error);
                    }
                });
                return false;
            }
            else
                return true;
        })).then((contin) => __awaiter(this, void 0, void 0, function* () {
            if (!contin)
                return;
            const format = state.treeOptions.index.defaultType;
            const options = {
                upload: isFolder && (allow.upload),
                mkdir: isFolder && (allow.mkdir),
                mixFolders: state.settings.directoryIndex.mixFolders,
                isLoggedIn: state.username ? (state.username + " (group " + state.authAccountsKey + ")") : false,
                format, extTypes: state.settings.directoryIndex.types
            };
            let contentType = {
                html: "text/html",
                json: "application/json"
            };
            let e = yield server_types_1.getTreePathFiles(result, state);
            let res = yield server_types_1.sendDirectoryIndex([e, options]);
            state.respond(200, "", { 'Content-Type': contentType[format], "Content-Encoding": 'utf-8' }).buffer(Buffer.from(res, "utf8"));
        })).catch(err => {
            if (err) {
                state.log(2, "Error caught " + err.toString());
                state.throw(500);
                //catch all: return nothing
            }
        });
        ;
    }
    else if (state.req.method === "POST") {
        var form = new bundled_lib_1.formidable.IncomingForm();
        // console.log(state.url);
        if (state.url.query.formtype === "upload") {
            if (server_types_1.Config.isGroup(result.item))
                return state.throwReason(400, "upload is not possible for tree groups");
            if (!allow.upload)
                return state.throwReason(403, "upload is not allowed over the network");
            form.parse(state.req, function (err, fields, files) {
                if (err) {
                    debugState("SER-DIR", state)(2, "upload %s", err.toString());
                    state.throwError(500, new server_types_1.ER("Error recieving request", err.toString()));
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
                    if (err)
                        handleFileError("SER-DIR", state, err);
                    state.redirect(state.url.pathname + (err ? "?error=upload" : ""));
                });
            });
        }
        else if (state.url.query.formtype === "mkdir") {
            if (server_types_1.Config.isGroup(result.item))
                return state.throwReason(400, "mkdir is not possible for tree items");
            if (!allow.mkdir)
                return state.throwReason(403, "mkdir is not allowed over the network");
            form.parse(state.req, function (err, fields, files) {
                if (err) {
                    debugState("SER-DIR", state)(2, "mkdir %s", err.toString());
                    state.throwError(500, new server_types_1.ER("Error recieving request", err.toString()));
                    return;
                }
                fs.mkdir(path.join(result.fullfilepath, fields.dirname), (err) => {
                    if (err) {
                        handleFileError("SER-DIR", state, err);
                        state.redirect(state.url.pathname + "?error=mkdir");
                    }
                    else if (fields.dirtype === "datafolder") {
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
                            if (!error)
                                state.redirect(state.url.pathname);
                        });
                    }
                    else {
                        state.redirect(state.url.pathname);
                    }
                });
            });
        }
        else {
            state.throw(403);
        }
    }
    else {
        state.throw(405);
    }
}
/// file handler section =============================================
function handlePUTrequest(state) {
    // const hash = createHash('sha256').update(fullpath).digest('base64');
    const first = (header) => Array.isArray(header) ? header[0] : header;
    const t = state.statPath;
    const fullpath = state.statPath.statpath;
    const statItem = state.statPath.stat;
    const mtime = Date.parse(state.statPath.stat.mtime);
    const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
    const ifmatchStr = first(state.req.headers['if-match']) || '';
    if (state.settings.putsaver.etag !== "disabled" && (ifmatchStr || state.settings.putsaver.etag === "required") && (ifmatchStr !== etag)) {
        const ifmatch = JSON.parse(ifmatchStr).split('-');
        const _etag = JSON.parse(etag).split('-');
        console.log('412 ifmatch %s', ifmatchStr);
        console.log('412 etag %s', etag);
        ifmatch.forEach((e, i) => {
            if (_etag[i] !== e)
                console.log("412 caused by difference in %s", ['inode', 'size', 'modified'][i]);
        });
        let headTime = +ifmatch[2];
        let diskTime = mtime;
        // console.log(settings.etagWindow, diskTime, headTime);
        if (!state.settings.putsaver.etagWindow || diskTime - (state.settings.putsaver.etagWindow * 1000) > headTime)
            return state.throw(412);
        console.log('412 prevented by etagWindow of %s seconds', state.settings.putsaver.etagWindow);
    }
    new Promise((resolve, reject) => {
        if (state.settings.putsaver.backupDirectory) {
            const backupFile = state.url.pathname.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
            const ext = path.extname(backupFile);
            const backupWrite = fs.createWriteStream(path.join(state.settings.putsaver.backupDirectory, backupFile + "-" + mtime + ext + ".gz"));
            const fileRead = fs.createReadStream(fullpath);
            const gzip = zlib.createGzip();
            const pipeError = (err) => {
                debugState("SER-SFS", state)(3, 'Error saving backup file for %s: %s\r\n%s', state.url.pathname, err.message, "Please make sure the backup directory actually exists or else make the " +
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
            });
        }
        else {
            resolve();
        }
    }).then(() => {
        return new Promise((resolve, reject) => {
            const write = state.req.pipe(fs.createWriteStream(fullpath));
            write.on("finish", () => {
                resolve();
            });
            write.on("error", (err) => {
                state
                    .log(2, "Error writing the updated file to disk")
                    .log(2, err.stack || [err.name, err.message].join(': '))
                    .throw(500);
                reject();
            });
        }).then(() => {
            return util_1.promisify(fs.stat)(fullpath).catch(err => {
                state.log(2, "statNew target does not exist");
                state.throw(500);
                return Promise.reject();
            });
        });
    }).then((statNew) => {
        const mtimeNew = Date.parse(statNew.mtime);
        const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join('-'));
        state.respond(200, "", {
            'x-api-access-type': 'file',
            'etag': etagNew
        }).empty();
    }).catch(() => {
        //this just means the request got handled early
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGlkZGx5c2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxrR0FBa0c7QUFDbEcsaURBT3dCO0FBRXhCLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFFN0IsNkJBQTZCO0FBTzdCLDZDQUFzRztBQUM3RixnQ0FEaUQsa0NBQXFCLENBQ2pEO0FBRTlCLCtCQUFrRDtBQUVsRCxrREFBa0Q7QUFDbEQsbUZBQW1GO0FBQ25GLDZEQUE2RDtBQUU3RCxvREFBc0Q7QUFLdEQsOEJBQThCO0FBQzlCLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRTlELFNBQVMsS0FBSyxDQUF5QixDQUFNLEVBQUUsQ0FBTSxFQUFFLENBQU0sRUFBRSxDQUFNLEVBQUUsQ0FBTSxFQUFFLENBQU07SUFDcEYsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUE2QixDQUFDO0FBQ3ZELENBQUM7QUFFRCxTQUFnQixTQUFTLENBQUMsSUFBWSxFQUFFLFFBQWdCO0lBQ3ZELElBQUksUUFBUSxHQUFHLGFBQWEsQ0FBQztJQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRTtRQUN2QyxRQUFRLE9BQU8sRUFBRTtZQUNoQixLQUFLLFVBQVUsQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDO1lBQ2xDLEtBQUssU0FBUyxDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDckMsS0FBSyxTQUFTLENBQUMsQ0FBQyxPQUFPLFFBQVEsQ0FBQztZQUNoQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUNuQjtJQUNGLENBQUMsQ0FBQyxD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