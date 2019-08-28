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
    let putsaver = server_types_1.as(Object.assign({ gzipBackups: true, backupFolder: "", etag: "optional", etagAge: 3 }, (state.settings.putsaver || {})));
    let options = {
        auth: { $element: "auth", authError: 403, authList: null },
        putsaver: Object.assign({ $element: "putsaver" }, putsaver),
        index: { $element: "index", defaultType: state.settings.directoryIndex.defaultType, indexFile: [], indexExts: [] }
    };
    state.ancestry.forEach((e) => {
        // console.log(e);
        e.$children && e.$children.forEach((f) => {
            if (f.$element === "auth" || f.$element === "putsaver" || f.$element === "index") {
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
                        let read = fs.createReadStream(path.join(__dirname, "../datafolder-template.json"));
                        let write = fs.createWriteStream(path.join(result.fullfilepath, fields.dirname, "tiddlywiki.info"));
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
                        read.pipe(write);
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
    if (state.settings.putsaver === false || !state.allow.putsaver) {
        let message = "PUT saver is disabled on this server";
        state.log(-2, message);
        state.respond(405, message).string(message);
        return;
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGlkZGx5c2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsa0dBQWtHO0FBQ2xHLGlEQU93QjtBQUV4Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLDZCQUE2QjtBQU83Qiw2Q0FBc0c7QUFDN0YsZ0NBRGlELGtDQUFxQixDQUNqRDtBQUU5QiwrQkFBd0Q7QUFFeEQsa0RBQWtEO0FBQ2xELG1GQUFtRjtBQUNuRiw2REFBNkQ7QUFFN0Qsb0RBQXNEO0FBS3RELDhCQUE4QjtBQUM5QixTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUU5RCxTQUFTLEtBQUssQ0FBeUIsQ0FBTSxFQUFFLENBQU0sRUFBRSxDQUFNLEVBQUUsQ0FBTSxFQUFFLENBQU0sRUFBRSxDQUFNO0lBQ3BGLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBNkIsQ0FBQztBQUN2RCxDQUFDO0FBRUQsU0FBZ0IsU0FBUyxDQUFDLElBQVksRUFBRSxRQUFnQjtJQUN2RCxJQUFJLFFBQVEsR0FBRyxhQUFhLENBQUM7SUFDN0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLEVBQUU7UUFDdkMsUUFBUSxPQUFPLEVBQUU7WUFDaEIsS0FBSyxVQUFVLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQztZQUNsQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3JDLEtBQUssU0FBUyxDQUFDLENBQUMsT0FBTyxRQUFRLENBQUM7WUFDaEMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDbkI7SUFDRixDQUFDLENBQUMsQ0FBQTtJQUNG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QUssS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUU7UUFDL0QsSUFBSSxPQUFPLEdBQUcsc0NBQXNDLENBQUM7UUFDckQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN2QixLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDNUMsT0FBTztLQUNQO0lBQ0QsdUVBQXVFO0lBQ3ZFLE1BQU0sS0FBSyxHQUFHLENBQUMsTUFBMEIsRUFBRSxFQUFFLENBQzVDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO0lBQzVDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7SUFDekIsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7SUFDekMsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7SUFDckMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFZLENBQUMsQ0FBQztJQUMzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVFLE1BQU0sVUFBVSxHQUFXLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN0RSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksQ0FBQyxVQUFV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