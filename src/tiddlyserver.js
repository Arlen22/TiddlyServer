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
            return state.respond(authError).string(authAccessDenied(authError, state.allow.loginlink, !!state.authAccountsKey));
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
            handleGETfile(state, result);
        }
        else if (['PUT'].indexOf(state.req.method) > -1) {
            handlePUTfile(state);
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
function handleGETfile(state, result) {
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
function authAccessDenied(authError, loginlink, authAccountsKeySet) {
    return `
<html><body>
<h2>Error ${authError}</h2>
<p>
${authAccountsKeySet ? "You do not have access to this URL" : "In this case you are not logged in. "}
${loginlink ? '<br/> Try logging in using the <a href="/admin/authenticate/login.html">login page</a>.' : ""}
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
async function handlePUTfile(state) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGlkZGx5c2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsa0dBQWtHO0FBQ2xHLHlCQUF5QjtBQUV6Qiw2QkFBNkI7QUFDN0IsK0JBQWlDO0FBQ2pDLDZCQUE2QjtBQUU3QixvREFBZ0Q7QUFDaEQsNkNBQStFO0FBRS9FLGlEQUErTjtBQUUvTiw4REFBOEQ7QUFDOUQsa0NBQWtDO0FBQ2xDLCtDQUErQztBQUMvQyx5QkFBeUI7QUFDekIsMkNBQTJDO0FBQzNDLDhDQUE4QztBQUM5Qyx5Q0FBeUM7QUFDekMsNEJBQTRCO0FBQzVCLFFBQVE7QUFDUixPQUFPO0FBQ1AsaUJBQWlCO0FBQ2pCLElBQUk7QUFFSixTQUFnQixJQUFJLENBQUMsT0FBMkI7SUFDOUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxHQUFpQixJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3pELGlCQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDMUIsQ0FBQztBQUhELG9CQUdDO0FBRU0sS0FBSyxVQUFVLHVCQUF1QixDQUFDLEtBQWtCO0lBRTlELFNBQVMsaUJBQWlCLENBQUMsR0FBRztRQUM1QixJQUFJLEdBQUcsRUFBRTtZQUNQLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGVBQWUsR0FBRyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUMvQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2xCO0lBQ0gsQ0FBQztJQUVELElBQUksTUFBTSxHQUF1QiwwQkFBVyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksSUFBYSxDQUFDO0lBQ3JGLElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFRLEdBQUcsQ0FBQyxDQUFDO0lBQzVDLEtBQUssQ0FBQyxRQUFRLEdBQUcsQ0FBQyxHQUFH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