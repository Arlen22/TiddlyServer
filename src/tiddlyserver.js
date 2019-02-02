"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("../lib/rx");
const server_types_1 = require("./server-types");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const datafolder_1 = require("./datafolder");
exports.handleTiddlyWikiRoute = datafolder_1.handleTiddlyWikiRoute;
const bundled_lib_1 = require("../lib/bundled-lib");
const debug = server_types_1.DebugLogger("SER-API");
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
var settings = {};
function init(eventer) {
    eventer.on('settings', function (set) {
        settings = set;
    });
    datafolder_1.init(eventer);
}
exports.init = init;
function checkRouteAllowed(state, result) {
    let lastAuth;
    result.ancestry.concat(result.item).forEach((e) => {
        lastAuth = Array.isArray(e.$children)
            && e.$children.find((f) => f.$element === "auth")
            || lastAuth;
    });
    return !lastAuth || lastAuth.authList.indexOf(state.authAccountsKey) !== -1;
}
exports.checkRouteAllowed = checkRouteAllowed;
function handleTiddlyServerRoute(state) {
    // const resolvePath = (settings.tree);
    rx_1.Observable.of(state).mergeMap((state) => {
        var result = server_types_1.resolvePath(state, settings.tree);
        if (!result)
            return state.throw(404);
        //handle route authentication
        if (!checkRouteAllowed(state, result)) {
            return state.throw(403);
        }
        // console.log(result.ancestry, result.reqpath.length);
        if (server_types_1.isNewTreeGroup(result.item)) {
            serveDirectoryIndex(result, state);
            return rx_1.Observable.empty();
        }
        else {
            return server_types_1.statWalkPath(result).map(stat => {
                state.statPath = stat;
                return result;
            });
        }
    }).map(result => {
        if (state.statPath.itemtype === "folder") {
            serveDirectoryIndex(result, state);
        }
        else if (state.statPath.itemtype === "datafolder") {
            datafolder_1.handleDataFolderRequest(result, state);
        }
        else if (state.statPath.itemtype === "file") {
            if (['HEAD', 'GET'].indexOf(state.req.method) > -1) {
                state.send({
                    root: result.item.path,
                    filepath: result.filepathPortion.join('/'),
                    error: err => {
                        state.log(2, '%s %s', err.status, err.message);
                        if (state.allow.writeErrors)
                            state.throw(500);
                    },
                    headers: (filepath) => {
                        const statItem = state.statPath.stat;
                        const mtime = Date.parse(state.statPath.stat.mtime);
                        const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
                        return { 'Etag': etag };
                    }
                });
            }
            else if (['PUT'].indexOf(state.req.method) > -1) {
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
    }).subscribe();
}
exports.handleTiddlyServerRoute = handleTiddlyServerRoute;
function handleFileError(err) {
    debug(2, "%s %s\n%s", err.code, err.message, err.path);
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
        const options = {
            upload: isFolder && (allow.upload),
            mkdir: isFolder && (allow.mkdir),
            mixFolders: settings.directoryIndex.mixFolders
        };
        server_types_1.getNewTreePathFiles(result, state)
            .map(e => [e, options])
            .concatMap(server_types_1.sendDirectoryIndex)
            .subscribe(res => {
            state.respond(200, "", { 'Content-Type': 'text/html', "Content-Encoding": 'utf-8' })
                .buffer(Buffer.from(res, "utf8"));
        });
    }
    else if (state.req.method === "POST") {
        var form = new bundled_lib_1.formidable.IncomingForm();
        // console.log(state.url);
        if (state.url.query.formtype === "upload") {
            if (server_types_1.isNewTreeGroup(result.item))
                return state.throwReason(400, "upload is not possible for tree items");
            if (!allow.upload)
                return state.throwReason(403, "upload is not allowed over the network");
            form.parse(state.req, function (err, fields, files) {
                if (err) {
                    debug(2, "upload %s", err.toString());
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
                        handleFileError(err);
                    state.redirect(state.url.pathname + (err ? "?error=upload" : ""));
                });
            });
        }
        else if (state.url.query.formtype === "mkdir") {
            if (server_types_1.isNewTreeGroup(result.item))
                return state.throwReason(400, "mkdir is not possible for tree items");
            if (!allow.mkdir)
                return state.throwReason(403, "mkdir is not allowed over the network");
            form.parse(state.req, function (err, fields, files) {
                if (err) {
                    debug(2, "mkdir %s", err.toString());
                    state.throwError(500, new server_types_1.ER("Error recieving request", err.toString()));
                    return;
                }
                fs.mkdir(path.join(result.fullfilepath, fields.dirname), (err) => {
                    if (err) {
                        handleFileError(err);
                        state.redirect(state.url.pathname + "?error=mkdir");
                    }
                    else if (fields.dirtype === "datafolder") {
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
    const fullpath = state.statPath.statpath;
    const statItem = state.statPath.stat;
    const mtime = Date.parse(state.statPath.stat.mtime);
    const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
    const ifmatchStr = first(state.req.headers['if-match']) || '';
    if (settings.tiddlyserver.etag !== "disabled" && (ifmatchStr || settings.tiddlyserver.etag === "required") && (ifmatchStr !== etag)) {
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
        if (!settings.tiddlyserver.etagWindow || diskTime - (settings.tiddlyserver.etagWindow * 1000) > headTime)
            return state.throw(412);
        console.log('412 prevented by etagWindow of %s seconds', settings.tiddlyserver.etagWindow);
    }
    new rx_1.Observable((subscriber) => {
        if (settings.tiddlyserver.backupDirectory) {
            const backupFile = state.url.pathname.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
            const ext = path.extname(backupFile);
            const backupWrite = fs.createWriteStream(path.join(settings.tiddlyserver.backupDirectory, backupFile + "-" + mtime + ext + ".gz"));
            const fileRead = fs.createReadStream(fullpath);
            const gzip = zlib.createGzip();
            const pipeError = (err) => {
                debug(3, 'Error saving backup file for %s: %s\r\n%s', state.url.pathname, err.message, "Please make sure the backup directory actually exists or else make the " +
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
            });
        }
        else {
            subscriber.next();
            subscriber.complete();
        }
    }).switchMap(() => {
        // let stream: Stream = state.req;
        const write = state.req.pipe(fs.createWriteStream(fullpath));
        const finish = rx_1.Observable.fromEvent(write, 'finish').take(1);
        return rx_1.Observable.merge(finish, rx_1.Observable.fromEvent(write, 'error').takeUntil(finish)).switchMap((err) => {
            if (err) {
                return state
                    .log(2, "Error writing the updated file to disk")
                    .log(2, err.stack || [err.name, err.message].join(': '))
                    .throw(500);
            }
            else {
                return server_types_1.obs_stat(false)(fullpath);
            }
        }).map(([err, statNew]) => {
            const mtimeNew = Date.parse(statNew.mtime);
            const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join('-'));
            state.respond(200, "", {
                'x-api-access-type': 'file',
                'etag': etagNew
            });
        });
    }).subscribe();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGlkZGx5c2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsa0NBQStGO0FBQy9GLGlEQU13QjtBQUV4Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLDZCQUE2QjtBQU83Qiw2Q0FBc0c7QUFDN0YsZ0NBRGlELGtDQUFxQixDQUNqRDtBQVE5QixvREFBc0Q7QUFJdEQsTUFBTSxLQUFLLEdBQUcsMEJBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNyQyxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUU5RCxlQUF1QyxDQUFNLEVBQUUsQ0FBTSxFQUFFLENBQU0sRUFBRSxDQUFNLEVBQUUsQ0FBTSxFQUFFLENBQU07SUFDcEYsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUE2QixDQUFDO0FBQ3ZELENBQUM7QUFFRCxtQkFBMEIsSUFBWSxFQUFFLFFBQWdCO0lBQ3ZELElBQUksUUFBUSxHQUFHLGFBQWEsQ0FBQztJQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRTtRQUN2QyxRQUFRLE9BQU8sRUFBRTtZQUNoQixLQUFLLFVBQVUsQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDO1lBQ2xDLEtBQUssU0FBUyxDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDckMsS0FBSyxTQUFTLENBQUMsQ0FBQyxPQUFPLFFBQVEsQ0FBQztZQUNoQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUNuQjtJQUNGLENBQUMsQ0FBQyxDQUFBO0lBQ0YsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBWEQsOEJBV0M7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QUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM1QyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQztJQUN6QyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztJQUNyQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQVksQ0FBQyxDQUFDO0lBQzNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDNUUsTUFBTSxVQUFVLEdBQVcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3RFLElBQUksUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLEtBQUssVUFBVSxJQUFJLENBQUMsVUFBVSxJQUFJLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxLQUFLLElBQUksQ0FBQyxFQUFFO1FBQ3BJLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFD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