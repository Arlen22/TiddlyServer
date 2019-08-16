"use strict";
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
        Promise.resolve().then(async () => {
            let { indexFile, indexExts, defaultType } = state.treeOptions.index;
            if (isFolder && indexExts.length && indexFile.length) {
                let files = await util_1.promisify(fs.readdir)(result.fullfilepath);
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
        }).then(async (contin) => {
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
            let e = await server_types_1.getTreePathFiles(result, state);
            let res = await server_types_1.sendDirectoryIndex([e, options]);
            state.respond(200, "", { 'Content-Type': contentType[format], "Content-Encoding": 'utf-8' }).buffer(Buffer.from(res, "utf8"));
        }).catch(err => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGlkZGx5c2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsa0dBQWtHO0FBQ2xHLGlEQU93QjtBQUV4Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLDZCQUE2QjtBQU83Qiw2Q0FBc0c7QUFDN0YsZ0NBRGlELGtDQUFxQixDQUNqRDtBQUU5QiwrQkFBa0Q7QUFFbEQsa0RBQWtEO0FBQ2xELG1GQUFtRjtBQUNuRiw2REFBNkQ7QUFFN0Qsb0RBQXNEO0FBS3RELDhCQUE4QjtBQUM5QixTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUU5RCxTQUFTLEtBQUssQ0FBeUIsQ0FBTSxFQUFFLENBQU0sRUFBRSxDQUFNLEVBQUUsQ0FBTSxFQUFFLENBQU0sRUFBRSxDQUFNO0lBQ3BGLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBNkIsQ0FBQztBQUN2RCxDQUFDO0FBRUQsU0FBZ0IsU0FBUyxDQUFDLElBQVksRUFBRSxRQUFnQjtJQUN2RCxJQUFJLFFBQVEsR0FBRyxhQUFhLENBQUM7SUFDN0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLEVBQUU7UUFDdkMsUUFBUSxPQUFPLEVBQUU7WUFDaEIsS0FBSyxVQUFVLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQztZQUNsQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3JDLEtBQUssU0FBUyxDQUFDLENBQUMsT0FBTyxRQUFRLENBQUM7WUFDaEMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDbkI7SUFDRixDQUFDLENBQUMsQ0FBQTtJQUNG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