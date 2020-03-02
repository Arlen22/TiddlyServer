// import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
import * as fs from "fs";
import { Stats } from "fs";
import * as path from "path";
import { promisify } from "util";
import * as zlib from "zlib";

import * as formidable from "formidable";
import { handleDataFolderRequest, init as initDatafolder } from "./datafolder";
import { OptionsConfig } from "./server-config";
import {
  as,
  Config,
  ER,
  getTreeOptions,
  getTreePathFiles,
  PathResolverResult,
  resolvePath,
  sendDirectoryIndex,
  serveFile,
  ServerConfig,
  ServerEventEmitter,
  StateObject,
  StatPathResult,
  statWalkPath
} from "./server-types";

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

export function init(eventer: ServerEventEmitter) {
  eventer.on("settings", function(set: ServerConfig) {});
  initDatafolder(eventer);
}

export async function handleTiddlyServerRoute(
  state: StateObject
): Promise<void> {
  function catchPromiseError(err) {
    if (err) {
      state.log(2, "Error caught " + err.toString());
      state.throw(500);
    }
  }

  let result: PathResolverResult =
    resolvePath(state, state.hostRoot) || (null as never);
  if (!result) return state.throw<never>(404);
  state.ancestry = [...result.ancestry, result.item];
  state.treeOptions = getTreeOptions(state);

  {
    //check authList
    let { authList, authError } = state.treeOptions.auth;
    let denyAccess =
      Array.isArray(authList) && authList.indexOf(state.authAccountsKey) === -1;
    if (denyAccess)
      return state
        .respond(authError)
        .string(
          authAccessDenied(
            authError,
            state.allow.loginlink,
            !!state.authAccountsKey
          )
        );
  }

  if (Config.isGroup(result.item))
    return serveDirectoryIndex(result, state).catch(catchPromiseError);

  function stateItemType<T extends StatPathResult["itemtype"]>(
    state: StateObject,
    itemtype: T
  ): state is StateObject<
    Extract<StatPathResult, { itemtype: typeof itemtype }>
  > {
    return state.statPath.itemtype === itemtype;
  }

  state.statPath = await statWalkPath(result); //.then((statPath) => {

  if (stateItemType(state, "folder")) {
    serveDirectoryIndex(result, state).catch(catchPromiseError);
  } else if (stateItemType(state, "datafolder")) {
    handleDataFolderRequest(result, state);
  } else if (stateItemType(state, "file")) {
    if (["HEAD", "GET"].indexOf(state.req.method as string) > -1) {
      handleGETfile(state, result);
    } else if (["PUT"].indexOf(state.req.method as string) > -1) {
      handlePUTfile(state);
    } else if (["OPTIONS"].indexOf(state.req.method as string) > -1) {
      state
        .respond(200, "", {
          "x-api-access-type": "file",
          dav: "tw5/put"
        })
        .string("GET,HEAD,PUT,OPTIONS");
    } else {
      state.throw(405);
    }
  } else if (state.statPath.itemtype === "error") {
    state.throw(404);
  } else {
    state.throw(500);
  }
  // }).catch((err) => {
  // if (err) { console.log(err); console.log(new Error().stack); }
  // });
}

function handleGETfile(
  state: StateObject<
    import("./server-types").IStatPathResult<"file", fs.Stats, undefined, true>,
    any
  >,
  result: PathResolverResult
) {
  state.send({
    root: (result.item as Config.PathElement).path,
    filepath: result.filepathPortion.join("/"),
    error: err => {
      state.log(2, "%s %s", err.status, err.message);
      if (state.allow.writeErrors) state.throw(500);
    },
    headers: (statPath => filepath => {
      const statItem = statPath.stat;
      const mtime = Date.parse(statPath.stat.mtime as any);
      const etag = JSON.stringify(
        [statItem.ino, statItem.size, mtime].join("-")
      );
      return { Etag: etag };
    })(state.statPath)
  });
}

function authAccessDenied(
  authError: number,
  loginlink: boolean,
  authAccountsKeySet: boolean
): string {
  return `
<html><body>
<h2>Error ${authError}</h2>
<p>
${
  authAccountsKeySet
    ? "You do not have access to this URL"
    : "In this case you are not logged in. "
}
${
  loginlink
    ? '<br/> Try logging in using the <a href="/admin/authenticate/login.html">login page</a>.'
    : ""
}
</p>
</body></html>
`;
}

function handleFileError(
  debugTag: string,
  state: StateObject,
  err: NodeJS.ErrnoException
) {
  StateObject.DebugLogger(debugTag).call(
    state,
    2,
    "%s %s\n%s",
    err.code,
    err.message,
    err.path
  );
}
function debugState(debugTag: string, state: StateObject) {
  return StateObject.DebugLogger(debugTag).bind(state);
}
async function serveDirectoryIndex(
  result: PathResolverResult,
  state: StateObject
) {
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
      let files = await promisify(fs.readdir)(result.fullfilepath);
      let indexFiles: string[] = [];
      indexFile.forEach(e => {
        indexExts.forEach(f => {
          let g = "";
          if (f === "") g = e;
          else g = e + "." + f;
          if (files.indexOf(g) !== -1) indexFiles.push(g);
        });
      });
      let index = indexFiles[0];
      if (index) {
        return serveFile(state, index, result.fullfilepath);
      } else if (defaultType === 403 || defaultType === 404) {
        return state.throw(defaultType);
      }
    } else if (result.item.$element === "group" && result.item.indexPath) {
      let { indexPath } = result.item;
      state.send({
        root: undefined,
        filepath: indexPath,
        error: err => {
          let error = new ER("error sending index", err.toString());
          state.log(2, error.message).throwError(500, error);
        }
      });
      return;
    }

    //check if we can autogenerate the index
    if (
      state.treeOptions.index.defaultType === 403 ||
      state.treeOptions.index.defaultType === 404
    ) {
      return state.throw(state.treeOptions.index.defaultType);
    }

    //generate the index using generateDirectoryListing.js
    const format = state.treeOptions.index.defaultType as "html" | "json";
    const options = {
      upload: isFolder && allow.upload,
      mkdir: isFolder && allow.mkdir,
      mixFolders: state.settings.directoryIndex.mixFolders,
      isLoggedIn: state.username
        ? state.username + " (group " + state.authAccountsKey + ")"
        : (false as false),
      format,
      extTypes: state.settings.directoryIndex.types
    };
    let contentType = {
      html: "text/html",
      json: "application/json"
    };
    let e = await getTreePathFiles(result, state);
    let res = await sendDirectoryIndex([e, options]);
    state
      .respond(200, "", {
        "Content-Type": contentType[format],
        "Content-Encoding": "utf-8"
      })
      // @ts-ignore
      .buffer(Buffer.from(res, "utf8"));
  } else if (state.req.method === "POST") {
    var form = new formidable.IncomingForm();
    // console.log(state.url);
    if (state.url.query.formtype === "upload") {
      if (Config.isGroup(result.item))
        return state.throwReason(400, "upload is not possible for tree groups");
      if (!allow.upload) return state.throwReason(403, "upload is not allowed");
      uploadPostRequest(form, state, result);
    } else if (state.url.query.formtype === "mkdir") {
      if (Config.isGroup(result.item))
        return state.throwReason(400, "mkdir is not possible for tree items");
      if (!allow.mkdir) return state.throwReason(403, "mkdir is not allowed");
      mkdirPostRequest(form, state, result);
    } else {
      state.throw(400);
    }
  } else {
    state.throw(405);
  }
}

function uploadPostRequest(
  form: any,
  state: StateObject<StatPathResult, any>,
  result: PathResolverResult
) {
  form.parse(state.req, function(err: Error, fields, files) {
    if (err) {
      debugState("SER-DIR", state)(2, "upload %s", err.toString());
      state.throwError(500, new ER("Error recieving request", err.toString()));
      return;
    }
    // console.log(fields, files);
    var oldpath = files.filetoupload.path;
    //get the filename to use
    let newname = fields.filename || files.filetoupload.name;
    //sanitize this to make sure we just
    newname = path.basename(newname);
    var newpath = path.join(result.fullfilepath, newname);
    fs.rename(oldpath, newpath, function(err) {
      if (err) handleFileError("SER-DIR", state, err);
      state.redirect(state.url.pathname + (err ? "?error=upload" : ""));
    });
  });
}

function mkdirPostRequest(
  form: any,
  state: StateObject<StatPathResult, any>,
  result: PathResolverResult
) {
  form.parse(state.req, async function(err: Error, fields, files) {
    if (err) {
      debugState("SER-DIR", state)(2, "mkdir %s", err.toString());
      state.throwError(500, new ER("Error recieving request", err.toString()));
      return;
    }
    const newdir = fields.dirname;
    const normdir = path.basename(path.normalize(fields.dirname));
    //if normalize changed anything, it's probably bad
    if (normdir !== newdir || normdir.indexOf("..") !== -1) {
      debugState("SER-DIR", state)(
        2,
        "mkdir normalized path %s didnt match %s",
        normdir,
        newdir
      );
      state.throwError(
        400,
        new ER(
          "Error parsing request - invalid name",
          "invalid path given in dirname"
        )
      );
      return;
    }
    if (
      await promisify(fs.mkdir)(path.join(result.fullfilepath, normdir)).catch(
        err => {
          handleFileError("SER-DIR", state, err);
          state.redirect(state.url.pathname + "?error=mkdir");
          return true;
        }
      )
    )
      return;

    if (fields.dirtype === "datafolder") {
      let read = fs.createReadStream(
        path.join(__dirname, "../datafolder-template.json")
      );
      let write = fs.createWriteStream(
        path.join(result.fullfilepath, normdir, "tiddlywiki.info")
      );
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
        if (!error) state.redirect(state.url.pathname);
      });
      read.pipe(write);
    } else {
      state.redirect(state.url.pathname);
    }
  });
}

/// file handler section =============================================

async function handlePUTfile(
  state: StateObject<Extract<StatPathResult, { itemtype: "file" }>>
) {
  if (!state.settings.putsaver.enabled || !state.allow.putsaver) {
    let message = "PUT saver is disabled";
    state.log(-2, message);
    state.respond(405, message).string(message);
    return;
  }
  // const hash = createHash('sha256').update(fullpath).digest('base64');
  const first = (header?: string | string[]) =>
    Array.isArray(header) ? header[0] : header;
  const t = state.statPath;
  const fullpath = state.statPath.statpath;
  const statItem = state.statPath.stat;
  const mtime = Date.parse(state.statPath.stat.mtime as any);
  const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join("-"));
  const ifmatchStr: string = first(state.req.headers["if-match"]) || "";
  if (
    state.settings.putsaver.etag !== "disabled" &&
    (ifmatchStr || state.settings.putsaver.etag === "required") &&
    ifmatchStr !== etag
  ) {
    const ifmatch = JSON.parse(ifmatchStr).split("-");
    const _etag = JSON.parse(etag).split("-");
    console.log("412 ifmatch %s", ifmatchStr);
    console.log("412 etag %s", etag);
    ifmatch.forEach((e, i) => {
      if (_etag[i] !== e)
        console.log(
          "412 caused by difference in %s",
          ["inode", "size", "modified"][i]
        );
    });
    let headTime = +ifmatch[2];
    let diskTime = mtime;
    // console.log(settings.etagWindow, diskTime, headTime);
    if (
      !state.settings.putsaver.etagAge ||
      diskTime - state.settings.putsaver.etagAge * 1000 > headTime
    )
      return state.throw(412);
    console.log(
      "412 prevented by etagWindow of %s seconds",
      state.settings.putsaver.etagAge
    );
  }
  await new Promise((resolve, reject) => {
    if (state.treeOptions.putsaver.backupFolder) {
      const backupFile = state.url.pathname.replace(
        /[^A-Za-z0-9_\-+()\%]/gi,
        "_"
      );
      const ext = path.extname(backupFile);
      const backupWrite = fs.createWriteStream(
        path.join(
          state.treeOptions.putsaver.backupFolder,
          backupFile + "-" + mtime + ext + ".gz"
        )
      );
      const fileRead = fs.createReadStream(fullpath);
      const gzip = zlib.createGzip();
      const pipeError = err => {
        debugState("SER-SFS", state)(
          3,
          "Error saving backup file for %s: %s\r\n%s",
          state.url.pathname,
          err.message,
          "Please make sure the backup directory actually exists or else make the " +
            "backupDirectory key falsy in your settings file (e.g. set it to a " +
            "zero length string or false, or remove it completely)"
        );
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
    } else {
      resolve();
    }
  }); //.then(() => {
  await new Promise((resolve, reject) => {
    const write = state.req.pipe(fs.createWriteStream(fullpath));
    write.on("finish", () => {
      resolve();
    });
    write.on("error", (err: Error) => {
      state
        .log(2, "Error writing the updated file to disk")
        .log(2, err.stack || [err.name, err.message].join(": "))
        .throw(500);
      reject();
    });
  });
  let statNew = await promisify(fs.stat)(fullpath).catch(err => {
    state.log(2, "statNew target does not exist");
    state.throw(500);
    return Promise.reject();
  });
  const mtimeNew = Date.parse(statNew.mtime as any);
  const etagNew = JSON.stringify(
    [statNew.ino, statNew.size, mtimeNew].join("-")
  );
  state
    .respond(200, "", { "x-api-access-type": "file", etag: etagNew })
    .empty();
  // }).catch(() => {
  //   //this just means the request got handled early
  // })
}
