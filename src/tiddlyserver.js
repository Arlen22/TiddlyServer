"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const zlib = require("zlib");
const bundled_lib_1 = require("../lib/bundled-lib");
const datafolder_1 = require("./datafolder");
const server_types_1 = require("./server-types");
// export function parsePath(path: string, jsonFile: string) {
//   var regCheck = /${([^}])}/gi;
//   path.replace(regCheck, (str, pathVar) => {
//     switch (pathVar) {
//       case "execPath": return __dirname;
//       case "currDir": return process.cwd();
//       case "jsonDir": return jsonFile;
//       default: return "";
//     }
//   })
//   return path;
// }
function init(eventer) {
    eventer.on('settings', function (set) { });
    datafolder_1.init(eventer);
}
exports.init = init;
async function handleTiddlyServerRoute(state) {
    function catchPromiseError(err) {
        if (err) {
            state.log(2, "Error caught " + err.toString());
            state.throw(500);
        }
    }
    let result = server_types_1.resolvePath(state, state.hostRoot) || null;
    if (!result)
        return state.throw(404);
    state.ancestry = [...result.ancestry, result.item];
    state.treeOptions = server_types_1.getTreeOptions(state);
    {
        //check authList
        let { authList, authError } = state.treeOptions.auth;
        let denyAccess = Array.isArray(authList) && authList.indexOf(state.authAccountsKey) === -1;
        if (denyAccess)
            return state.respond(authError).string(authAccessDenied(authError, state.allow.loginlink));
    }
    if (server_types_1.Config.isGroup(result.item))
        return serveDirectoryIndex(result, state).catch(catchPromiseError);
    function stateItemType(state, itemtype) {
        return state.statPath.itemtype === itemtype;
    }
    state.statPath = await server_types_1.statWalkPath(result); //.then((statPath) => {
    if (stateItemType(state, "folder")) {
        serveDirectoryIndex(result, state).catch(catchPromiseError);
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
            handlePUTrequest(state);
        }
        else if (['OPTIONS'].indexOf(state.req.method) > -1) {
            state.respond(200, "", {
                'x-api-access-type': 'file',
                'dav': 'tw5/put'
            }).string("GET,HEAD,PUT,OPTIONS");
        }
        else {
            state.throw(405);
        }
    }
    else if (state.statPath.itemtype === "error") {
        state.throw(404);
    }
    else {
        state.throw(500);
    }
    // }).catch((err) => {
    // if (err) { console.log(err); console.log(new Error().stack); }
    // });
}
exports.handleTiddlyServerRoute = handleTiddlyServerRoute;
function authAccessDenied(authError, loginlink) {
    return `
<html><body>
<h2>Error ${authError}</h2>
<p>
In this case you are not logged in. 
${loginlink ? ' Try logging in using the <a href="/admin/authenticate/login.html">login page</a>.' : ""}
</p>
</body></html>
`;
}
function handleFileError(debugTag, state, err) {
    server_types_1.StateObject.DebugLogger(debugTag).call(state, 2, "%s %s\n%s", err.code, err.message, err.path);
}
function debugState(debugTag, state) {
    return server_types_1.StateObject.DebugLogger(debugTag).bind(state);
}
async function serveDirectoryIndex(result, state) {
    // const { state } = result;
    const allow = state.allow;
    // console.log(state.url);
    if (!state.url.pathname.endsWith("/"))
        return state.redirect(state.url.pathname + "/");
    if (state.req.method === "GET") {
        const isFolder = result.item.$element === "folder";
        // Promise.resolve().then(async () => {
        let { indexFile, indexExts, defaultType } = state.treeOptions.index;
        // check for user-specified index files
        if (isFolder && indexExts.length && indexFile.length) {
            let files = await util_1.promisify(fs.readdir)(result.fullfilepath);
            let indexFiles = [];
            indexFile.forEach(e => {
                indexExts.forEach(f => {
                    let g = "";
                    if (f === "")
                        g = e;
                    else
                        g = e + "." + f;
                    if (files.indexOf(g) !== -1)
                        indexFiles.push(g);
                });
            });
            let index = indexFiles[0];
            if (index) {
                return server_types_1.serveFile(state, index, result.fullfilepath);
            }
            else if (defaultType === 403 || defaultType === 404) {
                return state.throw(defaultType);
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
            return;
        }
        //check if we can autogenerate the index
        if (state.treeOptions.index.defaultType === 403 || state.treeOptions.index.defaultType === 404) {
            return state.throw(state.treeOptions.index.defaultType);
        }
        //generate the index using generateDirectoryListing.js
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
    }
    else if (state.req.method === "POST") {
        var form = new bundled_lib_1.formidable.IncomingForm();
        // console.log(state.url);
        if (state.url.query.formtype === "upload") {
            if (server_types_1.Config.isGroup(result.item))
                return state.throwReason(400, "upload is not possible for tree groups");
            if (!allow.upload)
                return state.throwReason(403, "upload is not allowed");
            uploadPostRequest(form, state, result);
        }
        else if (state.url.query.formtype === "mkdir") {
            if (server_types_1.Config.isGroup(result.item))
                return state.throwReason(400, "mkdir is not possible for tree items");
            if (!allow.mkdir)
                return state.throwReason(403, "mkdir is not allowed");
            mkdirPostRequest(form, state, result);
        }
        else {
            state.throw(400);
        }
    }
    else {
        state.throw(405);
    }
}
function uploadPostRequest(form, state, result) {
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
function mkdirPostRequest(form, state, result) {
    form.parse(state.req, async function (err, fields, files) {
        if (err) {
            debugState("SER-DIR", state)(2, "mkdir %s", err.toString());
            state.throwError(500, new server_types_1.ER("Error recieving request", err.toString()));
            return;
        }
        const newdir = fields.dirname;
        const normdir = path.basename(path.normalize(fields.dirname));
        //if normalize changed anything, it's probably bad
        if (normdir !== newdir || normdir.indexOf("..") !== -1) {
            debugState("SER-DIR", state)(2, "mkdir normalized path %s didnt match %s", normdir, newdir);
            state.throwError(400, new server_types_1.ER("Error parsing request - invalid name", "invalid path given in dirname"));
            return;
        }
        if (await util_1.promisify(fs.mkdir)(path.join(result.fullfilepath, normdir)).catch(err => {
            handleFileError("SER-DIR", state, err);
            state.redirect(state.url.pathname + "?error=mkdir");
            return true;
        }))
            return;
        if (fields.dirtype === "datafolder") {
            let read = fs.createReadStream(path.join(__dirname, "../datafolder-template.json"));
            let write = fs.createWriteStream(path.join(result.fullfilepath, normdir, "tiddlywiki.info"));
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
}
/// file handler section =============================================
async function handlePUTrequest(state) {
    if (!state.settings.putsaver.enabled || !state.allow.putsaver) {
        let message = "PUT saver is disabled";
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
    await new Promise((resolve, reject) => {
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
    }); //.then(() => {
    await new Promise((resolve, reject) => {
        const write = state.req.pipe(fs.createWriteStream(fullpath));
        write.on("finish", () => { resolve(); });
        write.on("error", (err) => {
            state
                .log(2, "Error writing the updated file to disk")
                .log(2, err.stack || [err.name, err.message].join(': '))
                .throw(500);
            reject();
        });
    });
    let statNew = await util_1.promisify(fs.stat)(fullpath).catch(err => {
        state.log(2, "statNew target does not exist");
        state.throw(500);
        return Promise.reject();
    });
    const mtimeNew = Date.parse(statNew.mtime);
    const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join('-'));
    state.respond(200, "", { 'x-api-access-type': 'file', 'etag': etagNew }).empty();
    // }).catch(() => {
    //   //this just means the request got handled early
    // })
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGlkZGx5c2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsa0dBQWtHO0FBQ2xHLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFDN0IsK0JBQWlDO0FBQ2pDLDZCQUE2QjtBQUM3QixvREFBZ0Q7QUFDaEQsNkNBQStFO0FBRS9FLGlEQUl3QjtBQUd4Qiw4REFBOEQ7QUFDOUQsa0NBQWtDO0FBQ2xDLCtDQUErQztBQUMvQyx5QkFBeUI7QUFDekIsMkNBQTJDO0FBQzNDLDhDQUE4QztBQUM5Qyx5Q0FBeUM7QUFDekMsNEJBQTRCO0FBQzVCLFFBQVE7QUFDUixPQUFPO0FBQ1AsaUJBQWlCO0FBQ2pCLElBQUk7QUFFSixTQUFnQixJQUFJLENBQUMsT0FBMkI7SUFDOUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxHQUFpQixJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3pELGlCQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDMUIsQ0FBQztBQUhELG9CQUdDO0FBRU0sS0FBSyxVQUFVLHVCQUF1QixDQUFDLEtBQWtCO0lBRTlELFNBQVMsaUJBQWlCLENBQUMsR0FBRztRQUM1QixJQUFJLEdBQUcsRUFBRTtZQUNQLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGVBQWUsR0FBRyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUMvQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2xCO0lBQ0gsQ0FBQztJQUVELElBQUksTUFBTSxHQUF1QiwwQkFBVyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksSUFBYSxDQUFDO0lBQ3JGLElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFRLEdBQUcsQ0FBQyxDQUFDO0lBQzVDLEtBQUssQ0FBQyxRQUFRLEdBQUcsQ0FBQyxHQUFH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