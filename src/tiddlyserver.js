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
function handleRouteAuthentication(state, route) {
}
exports.handleRouteAuthentication = handleRouteAuthentication;
function handleTiddlyServerRoute(state) {
    // const resolvePath = (settings.tree);
    rx_1.Observable.of(state).mergeMap((state) => {
        var result = server_types_1.resolvePath(state, settings.tree);
        if (!result)
            return state.throw(404);
        //handle route authentication
        handleRouteAuthentication(state, result.ancestry.concat(result.item));
        console.log(result.ancestry, result.reqpath.length);
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
            state.respond(200, "", { 'content-type': 'text/html', 'content-encoding': 'utf-8' })
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGlkZGx5c2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsa0NBQStGO0FBQy9GLGlEQU13QjtBQUV4Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBRTdCLDZCQUE2QjtBQU83Qiw2Q0FBc0c7QUFDN0YsZ0NBRGlELGtDQUFxQixDQUNqRDtBQVE5QixvREFBc0Q7QUFHdEQsTUFBTSxLQUFLLEdBQUcsMEJBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNyQyxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUU5RCxlQUF1QyxDQUFNLEVBQUUsQ0FBTSxFQUFFLENBQU0sRUFBRSxDQUFNLEVBQUUsQ0FBTSxFQUFFLENBQU07SUFDcEYsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUE2QixDQUFDO0FBQ3ZELENBQUM7QUFFRCxtQkFBMEIsSUFBWSxFQUFFLFFBQWdCO0lBQ3ZELElBQUksUUFBUSxHQUFHLGFBQWEsQ0FBQztJQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRTtRQUN2QyxRQUFRLE9BQU8sRUFBRTtZQUNoQixLQUFLLFVBQVUsQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDO1lBQ2xDLEtBQUssU0FBUyxDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDckMsS0FBSyxTQUFTLENBQUMsQ0FBQyxPQUFPLFFBQVEsQ0FBQztZQUNoQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUNuQjtJQUNGLENBQUMsQ0FBQyxDQUFBO0lBQ0YsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBWEQsOEJBV0M7QUFFRCxJQUFJLFFBQVEsR0FBaUIsRUFBUyxDQUFDO0FBRXZDLGNBQXFCLE9BQTJCO0lBQy9DLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLFVBQVUsR0FBaUI7UUFDakQsUUFBUSxHQUFHLEdBQUcsQ0FBQztJQUNoQixDQUFDLENBQUMsQ0FBQztJQUNILGlCQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDekIsQ0FBQztBQUxELG9CQUtDO0FBR0QsbUNBQTBDLEtBQWtCLEVBQUUsS0FBcUM7QUFFbkcsQ0FBQztBQUZELDhEQUVDO0FBQ0QsaUNBQXdDLEtBQWtCO0lBRXpELHVDQUF1QztJQUN2QyxlQUFVLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQWtCLEVBQUUsRUFBRTtRQUNwRCxJQUFJLE1BQU0sR0FBRywwQkFBVyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUF1QixDQUFDO1FBQ3JFLElBQUksQ0FBQyxNQUFNO1lBQUUsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQzVDLDZCQUE2QjtRQUM3Qix5QkFBeUIsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEQsSUFBSSw2QkFBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNoQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDbkMsT0FBTyxlQUFVLENBQUMsS0FBSyxFQUFTLENBQUM7U0FDakM7YUFBTTtZQUNOLE9BQU8sMkJBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3RDLEtBQUssQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO2dCQUN0QixPQUFPLE1BQU0sQ0FBQztZQUNmLENBQUMsQ0FBQyxDQUFDO1NBQ0g7SUFDRixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDZixJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRTtZQUN6QyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDbkM7YUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxLQUFLLFlBQVksRUFBRTtZQUNwRCxvQ0FBdUIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDdkM7YUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxLQUFLLE1BQU0sRUFBRTtZQUM5QyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDN0QsS0FBSyxDQUFDLElBQUksQ0FBQztvQkFDVixJQUFJLEVBQUcsTUFBTSxDQUFDLElBQW9CLENBQUMsSUFBYztvQkFDakQsUUFBUSxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztvQkFDMUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFO3dCQUNaLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDL0MsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVc7NEJBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDL0MsQ0FBQztvQkFDRCxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRTt3QkFDckIsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7d0JBQ3JDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBWSxDQUFDLENBQUM7d0JBQzNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7d0JBQzVFLE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUM7b0JBQ3pCLENBQUM7aUJBQ0QsQ0FBQyxDQUFBO2FBQ0Y7aUJBQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDNUQsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDeEI7aUJBQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDaEUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFO29CQUN0QixtQkFBbUIsRUFBRSxNQUFNO29CQUMzQixLQUFLLEVBQUUsU0FBUztpQkFDaEIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO2FBQ2xDOztnQkFBTSxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ3hCO2FBQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsS0FBSyxPQUFPLEVBQUU7WUFDL0MsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNqQjthQUFNO1lBQ04sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNqQjtJQUNGLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ2hCLENBQUM7QUFyREQsMERBcURDO0FBQ0QseUJBQXlCLEdBQTBCO0lBQ2xELEtBQUssQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEQsQ0FBQztBQUVELDZCQUE2QixNQUEwQixFQUFFLEtBQWtCO0lBQzFFLDRCQUE0QjtJQUM1QixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQzFCLDBCQUEwQjtJQUMxQixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ3RDLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUM7S0FDekM7U0FBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRTtRQUN0QyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUM7UUFDbkQsTUFBTSxPQUFPLEdBQUc7WUFDZixNQUFNLEVBQUUsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztZQUNsQyxLQUFLLEVBQUUsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztZQUNoQyxVQUFVLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVO1NBQzlDLENBQUM7UUFDRixrQ0FBbUIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDO2FBQ2hDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBK0IsQ0FBQzthQUNwRCxTQUFTLENBQUMsaUNBQWtCLENBQUM7YUFDN0IsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ2hCLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLENBQUM7aUJBQ2xGLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3BDLENBQUMsQ0FBQyxDQUFDO0tBQ0o7U0FBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxLQUFLLE1BQU0sRUFBRTtRQUN2QyxJQUFJLElBQUksR0FBRyxJQUFJLHdCQUFVLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDekMsMEJBQTBCO1FBQzFCLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRTtZQUUxQyxJQUFJLDZCQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDOUIsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO1lBQ3hFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTTtnQkFDaEIsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSx3Q0FBd0MsQ0FBQyxDQUFBO1lBRXhFLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxVQUFVLEdBQVUsRUFBRSxNQUFNLEVBQUUsS0FBSztnQkFDeEQsSUFBSSxHQUFHLEVBQUU7b0JBQ1IsS0FBSyxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7b0JBQ3RDLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLElBQUksaUJBQUUsQ0FBQyx5QkFBeUIsRUFBRSxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUN6RSxPQUFPO2lCQUNQO2dCQUNELDhCQUE4QjtnQkFDOUIsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUM7Z0JBQ3RDLHlCQUF5QjtnQkFDekIsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQztnQkFDekQscUNBQXFDO2dCQUNyQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDakMsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN0RCxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxHQUFHO29CQUN4QyxJQUFJLEdBQUc7d0JBQUUsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO29CQUM3QixLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ25FLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7U0FDSDthQUFNLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxLQUFLLE9BQU8sRUFBRTtZQUNoRCxJQUFJLDZCQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDOUIsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxzQ0FBc0MsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSztnQkFDZixPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLHVDQUF1QyxDQUFDLENBQUE7WUFDdkUsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLFVBQVUsR0FBVSxFQUFFLE1BQU0sRUFBRSxLQUFLO2dCQUN4RCxJQUFJLEdBQUcsRUFBRTtvQkFDUixLQUFLLENBQUMsQ0FBQyxFQUFFLFVBQVUsRUFBRSxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztvQkFDckMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxpQkFBRSxDQUFDLHlCQUF5QixFQUFFLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUE7b0JBQ3hFLE9BQU87aUJBQ1A7Z0JBQ0QsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUU7b0JBQ2hFLElBQUksR0FBRyxFQUFFO3dCQUNSLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDckIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsR0FBRyxjQUFjLENBQUMsQ0FBQztxQkFDcEQ7eUJBQU0sSUFBSSxNQUFNLENBQUMsT0FBTyxLQUFLLFlBQVksRUFBRTt3QkFDM0MsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLHdDQUF3QyxDQUFDLENBQUMsQ0FBQzt3QkFDL0YsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUMsQ0FBQzt3QkFDcEcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDakIsSUFBSSxLQUFLLENBQUM7d0JBQ1YsTUFBTSxZQUFZLEdBQUcsQ0FBQyxHQUFHLEVBQUUsRUFBRTs0QkFDNUIsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDOzRCQUNyQixLQUFLLEdBQUcsR0FBRyxDQUFDOzRCQUNaLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsYUFBYSxDQUFDLENBQUM7NEJBQ25ELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQzs0QkFDYixLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7d0JBQ2YsQ0FBQyxDQUFDO3dCQUNGLEtBQUssQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO3dCQUNoQyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQzt3QkFDL0IsS0FBSyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFOzRCQUN0QixJQUFJLENBQUMsS0FBSztnQ0FBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7d0JBQ2hELENBQUMsQ0FBQyxDQUFBO3FCQUNGO3lCQUFNO3dCQUNOLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztxQkFDbkM7Z0JBQ0YsQ0FBQyxDQUFDLENBQUE7WUFDSCxDQUFDLENBQUMsQ0FBQztTQUNIO2FBQU07WUFDTixLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2pCO0tBQ0Q7U0FBTTtRQUNOLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDakI7QUFDRixDQUFDO0FBRUQsc0VBQXNFO0FBRXRFLDBCQUEwQixLQUFrQjtJQUMzQyx1RUFBdUU7SUFDdkUsTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUEwQixFQUFFLEVBQUUsQ0FDNUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDNUMsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7SUFDekMsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7SUFDckMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFZLENBQUMsQ0FBQztJQUMzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVFLE1BQU0sVUFBVSxHQUFXLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN0RSxJQUFJLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxLQUFLLFVBQVUsSUFBSSxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUMsRUFBRTtRQUNwSSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNsRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxQyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDeEIsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ3BHLENBQUMsQ0FBQyxDQUFBO1FBQ0YsSUFBSSxRQUFRLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0IsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLHdEQUF3RDtRQUN4RCxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxVQUFVLElBQUksUUFBUSxHQUFHLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsUUFBUTtZQUN2RyxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDekIsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQ0FBMkMsRUFBRSxRQUFRLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQzNGO0lBQ0QsSUFBSSxlQUFVLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRTtRQUM3QixJQUFJLFFBQVEsQ0FBQyxZQUFZLENBQUMsZUFBZSxFQUFFO1lBQzFDLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUM3RSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3JDLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsZUFBZSxFQUFFLFVBQVUsR0FBRyxHQUFHLEdBQUcsS0FBSyxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ25JLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMvQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDL0IsTUFBTSxTQUFTLEdBQUcsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDekIsS0FBSyxDQUFDLENBQUMsRUFBRSwyQ0FBMkMsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsT0FBTyxFQUNwRix5RUFBeUU7b0JBQ3pFLG9FQUFvRTtvQkFDcEUsdURBQXVELENBQUMsQ0FBQztnQkFDMUQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsOENBQThDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3hFLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDakIsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNYLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDbEIsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3ZCLENBQUMsQ0FBQztZQUNGLFFBQVEsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ2hDLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFdBQVcsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ25DLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO2dCQUN0RCxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2xCLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN2QixDQUFDLENBQUMsQ0FBQTtTQUNGO2FBQU07WUFDTixVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbEIsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO1NBQ3RCO0lBQ0YsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtRQUNqQixrQ0FBa0M7UUFFbEMsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDN0QsTUFBTSxNQUFNLEdBQUcsZUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdELE9BQU8sZUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsZUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBVSxFQUFFLEVBQUU7WUFDaEgsSUFBSSxHQUFHLEVBQUU7Z0JBQ1IsT0FBTyxLQUFLO3FCQUNWLEdBQUcsQ0FBQyxDQUFDLEVBQUUsd0NBQXdDLENBQUM7cUJBQ2hELEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDdkQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ2I7aUJBQU07Z0JBQ04sT0FBTyx1QkFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBUSxDQUFDO2FBQ3hDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtZQUN6QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFZLENBQUMsQ0FBQztZQUNsRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRTtnQkFDdEIsbUJBQW1CLEVBQUUsTUFBTTtnQkFDM0IsTUFBTSxFQUFFLE9BQU87YUFDZixDQUFDLENBQUE7UUFDSCxDQUFDLENBQUMsQ0FBQTtJQUNILENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ2hCLENBQUMifQ==