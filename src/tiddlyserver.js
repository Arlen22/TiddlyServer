"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("../lib/rx");
const server_types_1 = require("./server-types");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const datafolder_1 = require("./datafolder");
exports.doTiddlyWikiRoute = datafolder_1.doTiddlyWikiRoute;
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
function doTiddlyServerRoute(input) {
    // const resolvePath = (settings.tree);
    return input.mergeMap((state) => {
        var result = server_types_1.resolvePath(state, settings.tree);
        if (!result)
            return state.throw(404);
        else if (typeof result.item === "object") {
            serveDirectoryIndex(result);
            return rx_1.Observable.empty();
        }
        else {
            return server_types_1.statWalkPath(result).map(stat => {
                state.statPath = stat;
                return result;
            });
        }
    }).map(result => {
        const { state } = result;
        if (state.statPath.itemtype === "folder") {
            serveDirectoryIndex(result);
        }
        else if (state.statPath.itemtype === "datafolder") {
            datafolder_1.datafolder(result);
        }
        else if (state.statPath.itemtype === "file") {
            if (['HEAD', 'GET'].indexOf(state.req.method) > -1) {
                bundled_lib_1.send(state.req, result.filepathPortion.join('/'), { root: result.item })
                    .on('error', (err) => {
                    state.log(0, '%s %s', err.status, err.message).error().throw(500);
                }).on('headers', (res, filepath) => {
                    const statItem = state.statPath.stat;
                    const mtime = Date.parse(state.statPath.stat.mtime);
                    const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
                    res.setHeader('Etag', etag);
                }).pipe(state.res);
            }
            else if (['PUT'].indexOf(state.req.method) > -1) {
                handlePUTrequest(state);
            }
            else if (['OPTIONS'].indexOf(state.req.method) > -1) {
                state.res.writeHead(200, {
                    'x-api-access-type': 'file',
                    'dav': 'tw5/put'
                });
                state.res.write("GET,HEAD,PUT,OPTIONS");
                state.res.end();
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
    }).ignoreElements();
}
exports.doTiddlyServerRoute = doTiddlyServerRoute;
function serveDirectoryIndex(result) {
    const { state } = result;
    if (!state.url.path.endsWith("/")) {
        state.redirect(state.url.path + "/");
    }
    else if (state.req.method === "GET") {
        rx_1.Observable.of(result)
            .concatMap(server_types_1.getTreeItemFiles)
            .concatMap(server_types_1.sendDirectoryIndex)
            .subscribe(res => {
            state.res.writeHead(200);
            state.res.write(res);
            state.res.end();
        });
    }
    else if (state.req.method === "POST") {
        var form = new bundled_lib_1.formidable.IncomingForm();
        form.parse(state.req, function (err, fields, files) {
            console.log(fields, Object.keys(files));
            if (fields.formtype === "upload") {
                var oldpath = files.filetoupload.path;
                var newpath = path.join(result.fullfilepath, files.filetoupload.name);
                fs.rename(oldpath, newpath, function (err) {
                    if (err)
                        debug(2, "%s %s\n%s", err.code, err.message, err.path);
                    state.redirect(state.url.path + (err ? "?error=upload" : ""));
                });
            }
            else if (fields.formtype === "mkdir") {
                fs.mkdir(path.join(result.fullfilepath, fields.dirname), (err) => {
                    if (err)
                        debug(2, "%s %s\n%s", err.code, err.message, err.path);
                    state.redirect(state.url.path + (err ? "?error=mkdir" : ""));
                });
            }
        });
    }
    else {
        state.throw(405);
    }
}
/// file handler section =============================================
function handlePUTrequest(state) {
    // const hash = createHash('sha256').update(fullpath).digest('base64');
    const fullpath = state.statPath.statpath;
    const statItem = state.statPath.stat;
    const mtime = Date.parse(state.statPath.stat.mtime);
    const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join('-'));
    if (settings.etag !== "disabled" && (state.req.headers['if-match'] || settings.etag === "required") && (state.req.headers['if-match'] !== etag)) {
        const ifmatch = JSON.parse(state.req.headers['if-match']).split('-');
        const _etag = JSON.parse(etag).split('-');
        console.log('412 ifmatch %s', state.req.headers['if-match']);
        console.log('412 etag %s', etag);
        ifmatch.forEach((e, i) => {
            if (_etag[i] !== e)
                console.log("412 caused by difference in %s", ['inode', 'size', 'modified'][i]);
        });
        let headTime = +ifmatch[2];
        let diskTime = mtime;
        // console.log(settings.etagWindow, diskTime, headTime);
        if (!settings.etagWindow || diskTime - (settings.etagWindow * 1000) > headTime)
            return state.throw(412);
        console.log('412 prevented by etagWindow of %s seconds', settings.etagWindow);
    }
    new rx_1.Observable((subscriber) => {
        if (settings.backupDirectory) {
            const backupFile = state.url.path.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
            const ext = path.extname(backupFile);
            const backupWrite = fs.createWriteStream(path.join(settings.backupDirectory, backupFile + "-" + mtime + ext + ".gz"));
            const fileRead = fs.createReadStream(fullpath);
            const gzip = zlib.createGzip();
            const pipeError = (err) => {
                debug(3, 'Error saving backup file for %s: %s\r\n%s', state.url.path, err.message, "Please make sure the backup directory actually exists or else make the " +
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
        let stream = state.req;
        const write = stream.pipe(fs.createWriteStream(fullpath));
        const finish = rx_1.Observable.fromEvent(write, 'finish').take(1);
        return rx_1.Observable.merge(finish, rx_1.Observable.fromEvent(write, 'error').takeUntil(finish)).switchMap((err) => {
            if (err) {
                return state
                    .log(0, "Error writing the updated file to disk")
                    .log(0, [err.name, err.message, err.stack].join(': '))
                    .error().throw(500);
            }
            else {
                return server_types_1.obs_stat(false)(fullpath);
            }
        }).map(([err, statNew]) => {
            const mtimeNew = Date.parse(statNew.mtime);
            const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join('-'));
            state.res.writeHead(200, {
                'x-api-access-type': 'file',
                'etag': etagNew
            });
            state.res.end();
        });
    }).subscribe();
}
