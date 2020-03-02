"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const zlib = require("zlib");
const formidable = require("formidable");
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
    eventer.on("settings", function (set) { });
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
            return state
                .respond(authError)
                .string(authAccessDenied(authError, state.allow.loginlink, !!state.authAccountsKey));
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
        if (["HEAD", "GET"].indexOf(state.req.method) > -1) {
            handleGETfile(state, result);
        }
        else if (["PUT"].indexOf(state.req.method) > -1) {
            handlePUTfile(state);
        }
        else if (["OPTIONS"].indexOf(state.req.method) > -1) {
            state
                .respond(200, "", {
                "x-api-access-type": "file",
                dav: "tw5/put"
            })
                .string("GET,HEAD,PUT,OPTIONS");
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
        filepath: result.filepathPortion.join("/"),
        error: err => {
            state.log(2, "%s %s", err.status, err.message);
            if (state.allow.writeErrors)
                state.throw(500);
        },
        headers: (statPath => filepath => {
            const statItem = statPath.stat;
            const mtime = Date.parse(statPath.stat.mtime);
            const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join("-"));
            return { Etag: etag };
        })(state.statPath)
    });
}
function authAccessDenied(authError, loginlink, authAccountsKeySet) {
    return `
<html><body>
<h2>Error ${authError}</h2>
<p>
${authAccountsKeySet
        ? "You do not have access to this URL"
        : "In this case you are not logged in. "}
${loginlink
        ? '<br/> Try logging in using the <a href="/admin/authenticate/login.html">login page</a>.'
        : ""}
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
                error: err => {
                    let error = new server_types_1.ER("error sending index", err.toString());
                    state.log(2, error.message).throwError(500, error);
                }
            });
            return;
        }
        //check if we can autogenerate the index
        if (state.treeOptions.index.defaultType === 403 ||
            state.treeOptions.index.defaultType === 404) {
            return state.throw(state.treeOptions.index.defaultType);
        }
        //generate the index using generateDirectoryListing.js
        const format = state.treeOptions.index.defaultType;
        const options = {
            upload: isFolder && allow.upload,
            mkdir: isFolder && allow.mkdir,
            mixFolders: state.settings.directoryIndex.mixFolders,
            isLoggedIn: state.username
                ? state.username + " (group " + state.authAccountsKey + ")"
                : false,
            format,
            extTypes: state.settings.directoryIndex.types
        };
        let contentType = {
            html: "text/html",
            json: "application/json"
        };
        let e = await server_types_1.getTreePathFiles(result, state);
        let res = await server_types_1.sendDirectoryIndex([e, options]);
        state
            .respond(200, "", {
            "Content-Type": contentType[format],
            "Content-Encoding": "utf-8"
        })
            // @ts-ignore
            .buffer(Buffer.from(res, "utf8"));
    }
    else if (state.req.method === "POST") {
        var form = new formidable.IncomingForm();
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
            const errorHandler = err => {
                handleFileError("SER-DIR", state, err);
                error = err;
                state.redirect(state.url.pathname + "?error=mkdf");
                read.close();
                write.close();
            };
            write.on("error", errorHandler);
            read.on("error", errorHandler);
            write.on("close", () => {
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
    const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join("-"));
    const ifmatchStr = first(state.req.headers["if-match"]) || "";
    if (state.settings.putsaver.etag !== "disabled" &&
        (ifmatchStr || state.settings.putsaver.etag === "required") &&
        ifmatchStr !== etag) {
        const ifmatch = JSON.parse(ifmatchStr).split("-");
        const _etag = JSON.parse(etag).split("-");
        console.log("412 ifmatch %s", ifmatchStr);
        console.log("412 etag %s", etag);
        ifmatch.forEach((e, i) => {
            if (_etag[i] !== e)
                console.log("412 caused by difference in %s", ["inode", "size", "modified"][i]);
        });
        let headTime = +ifmatch[2];
        let diskTime = mtime;
        // console.log(settings.etagWindow, diskTime, headTime);
        if (!state.settings.putsaver.etagAge ||
            diskTime - state.settings.putsaver.etagAge * 1000 > headTime)
            return state.throw(412);
        console.log("412 prevented by etagWindow of %s seconds", state.settings.putsaver.etagAge);
    }
    await new Promise((resolve, reject) => {
        if (state.treeOptions.putsaver.backupFolder) {
            const backupFile = state.url.pathname.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
            const ext = path.extname(backupFile);
            const backupWrite = fs.createWriteStream(path.join(state.treeOptions.putsaver.backupFolder, backupFile + "-" + mtime + ext + ".gz"));
            const fileRead = fs.createReadStream(fullpath);
            const gzip = zlib.createGzip();
            const pipeError = err => {
                debugState("SER-SFS", state)(3, "Error saving backup file for %s: %s\r\n%s", state.url.pathname, err.message, "Please make sure the backup directory actually exists or else make the " +
                    "backupDirectory key falsy in your settings file (e.g. set it to a " +
                    "zero length string or false, or remove it completely)");
                state.log(3, "Backup could not be saved, see server output").throw(500);
                fileRead.close();
                gzip.end();
                backupWrite.end();
                reject();
            };
            fileRead.on("error", pipeError);
            gzip.on("error", pipeError);
            backupWrite.on("error", pipeError);
            fileRead
                .pipe(gzip)
                .pipe(backupWrite)
                .on("close", () => {
                resolve();
            });
        }
        else {
            resolve();
        }
    }); //.then(() => {
    await new Promise((resolve, reject) => {
        const write = state.req.pipe(fs.createWriteStream(fullpath));
        write.on("finish", () => {
            resolve();
        });
        write.on("error", (err) => {
            state
                .log(2, "Error writing the updated file to disk")
                .log(2, err.stack || [err.name, err.message].join(": "))
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
    const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join("-"));
    state
        .respond(200, "", { "x-api-access-type": "file", etag: etagNew })
        .empty();
    // }).catch(() => {
    //   //this just means the request got handled early
    // })
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5c2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RpZGRseXNlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGtHQUFrRztBQUNsRyx5QkFBeUI7QUFFekIsNkJBQTZCO0FBQzdCLCtCQUFpQztBQUNqQyw2QkFBNkI7QUFFN0IseUNBQXlDO0FBQ3pDLDZDQUErRTtBQUUvRSxpREFld0I7QUFFeEIsOERBQThEO0FBQzlELGtDQUFrQztBQUNsQywrQ0FBK0M7QUFDL0MseUJBQXlCO0FBQ3pCLDJDQUEyQztBQUMzQyw4Q0FBOEM7QUFDOUMseUNBQXlDO0FBQ3pDLDRCQUE0QjtBQUM1QixRQUFRO0FBQ1IsT0FBTztBQUNQLGlCQUFpQjtBQUNqQixJQUFJO0FBRUosU0FBZ0IsSUFBSSxDQUFDLE9BQTJCO0lBQzlDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLFVBQVMsR0FBaUIsSUFBRyxDQUFDLENBQUMsQ0FBQztJQUN2RCxpQkFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzFCLENBQUM7QUFIRCxvQkFHQztBQUVNLEtBQUssVUFBVSx1QkFBdUIsQ0FDM0MsS0FBa0I7SUFFbEIsU0FBUyxpQkFBaUIsQ0FBQyxHQUFHO1FBQzVCLElBQUksR0FBRyxFQUFFO1lBQ1AsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZUFBZSxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQy9DLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDbEI7SUFDSCxDQUFDO0lBRUQsSUFBSSxNQUFNLEdBQ1IsMEJBQVcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFLLElBQWMsQ0FBQztJQUN4RCxJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBUSxHQUFHLENBQUMsQ0FBQztJQUM1QyxLQUFLLENBQUMsUUFBUSxHQUFH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