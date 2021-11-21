// import { Observable, Subject, Scheduler, Operator, Subscriber, Subscription } from "../lib/rx";
import * as fs from "fs";
import { Stats } from "fs";
import * as path from "path";
import { promisify } from "util";
import * as zlib from "zlib";
import { mime } from "send";
import * as formidable from "formidable";
import { handleDataFolderRequest, handleWebsocketConnection } from "./data-folder";
import { OptionsConfig } from "./server-config";
import {
  as,
  Config,
  ER,
  // getTreeOptions,
  // getTreePathFiles,
  PathResolverResult,
  resolvePath,
  sendDirectoryIndex,
  serveFile,
  ServerConfig,
  ServerEventEmitter,
  StatPathResult,
  statWalkPath,
  DirectoryIndexData,
  IStatPathResult,
  getStatPathResult,
  DirectoryIndexOptions,
} from "./server-types";
import { StateObject } from "./state-object";
import { RequestEvent } from "./request-event";
import { parse } from "url";
import { generateDirectoryListing } from './generate-directory-listing';
import { contains, first, keys } from "./utils-functions";


// it isn't pretty but I can't find a way to improve it - 2020/04/10
// it still isn't pretty, but it finally uses classes - 2020/04/14

function generateErrorPage(type: 403 | 404, path: string, state: {
  settings: ServerConfig, authAccountKey: string, username: string
}) {
  // let options = this.getDirectoryIndexOptions(false);
  return generateDirectoryListing({ entries: [], path, type }, {
    upload: false,
    mkdir: false,
    mixFolders: state.settings.directoryIndex.mixFolders,
    isLoggedIn: state.username ? state.username + " (group " + state.authAccountKey + ")" : (false as false),
    format: "html",
    extIcons: state.settings.directoryIndex.types
  });
}

export async function handleTreeRoute(event: RequestEvent, eventer: ServerEventEmitter): Promise<void> {

  let pathname = parse(event.url).pathname;
  if (!pathname) return event.close(400);

  let result: PathResolverResult = resolvePath(pathname.split('/'), event.hostRoot) || (null as never);
  if (!result) return event.close(404, generateErrorPage(404, pathname, event));

  let treeOptions = event.getTreeOptions(result);

  let { authList, authError } = treeOptions.auth;


  if (Array.isArray(authList) && authList.indexOf(event.authAccountKey) === -1)
    return event.close(403, authAccessDenied(
      authError,
      event.allow.loginlink,
      !!event.authAccountKey,
      event.url
    ));

  if (Config.isGroup(result.item)) {
    if (event.type === "client") return event.close(404);
    const state = new TreeStateObject(eventer, event, result, null as never);
    return state.serveDirectoryIndex().catch(state.catchPromiseError);
  }

  let statPath = await statWalkPath(result);

  if (event.type === "client")
    return handleWebsocketConnection(event, result, treeOptions, statPath);

  const state = new TreeStateObject(eventer, event, result, statPath, treeOptions);


  if (state.isStatPathResult("folder")) {
    state.serveDirectoryIndex().catch(state.catchPromiseError);
  } else if (state.isStatPathResult("datafolder")) {
    if (!state.allow.datafolder) state.respond(403).string(generateErrorPage(403, state.url.pathname, state));
    else handleDataFolderRequest(result, state);
  } else if (state.isStatPathResult("file")) {
    if (["HEAD", "GET"].indexOf(state.req.method as string) > -1) {
      state.handleGETfile();
    } else if (["PUT"].indexOf(state.req.method as string) > -1) {
      state.handlePUTfile();
    } else if (["OPTIONS"].indexOf(state.req.method as string) > -1) {
      state
        .respond(200, "", { "x-api-access-type": "file", ...(state.putsaverEnabled ? { dav: "tw5/put" } : {}) })
        .string("GET,HEAD,PUT,OPTIONS");
    } else {
      state.throw(405);
    }
  } else if (state.statPath.itemtype === "error") {
    state.respond(404).string(generateErrorPage(404, state.url.pathname, state));
  } else {
    state.throw(500);
  }
}

function handleFileError(debugTag: string, state: TreeStateObject, err: NodeJS.ErrnoException) {
  TreeStateObject.DebugLogger(debugTag).call(state, 2, "%s %s\n%s", err.code, err.message, err.path);
}
function debugState(debugTag: string, state: TreeStateObject) {
  return TreeStateObject.DebugLogger(debugTag).bind(state);
}

/// file handler section =============================================


function authAccessDenied(
  authError: number,
  loginlink: boolean,
  authAccountsKeySet: boolean,
  requestURL: string
): string {
  return `
<html><body>
<h2>Error ${authError}</h2>
<p>
${authAccountsKeySet
      ? "You do not have access to this URL"
      : "In this case you are not logged in. "}
${loginlink
      ? `<br/> Try logging in using the <a href="/admin/authenticate/login.html?redirect=${encodeURIComponent(requestURL)}">login page</a>.`
      : ""}
</p>
</body></html>
`;
}

export class TreeStateObject<STATPATH extends StatPathResult = StatPathResult> extends StateObject {
  isStatPathResult<T extends StatPathResult["itemtype"]>(
    itemtype: T
  ): this is TreeStateObject<getStatPathResult<T>> {
    return this.statPath.itemtype === itemtype;
  }

  ancestry: Config.MountElement[];
  treeOptions: OptionsConfig;
  pathOptions: {
    noTrailingSlash: boolean;
    noDataFolder: boolean;
  };

  constructor(
    eventer: ServerEventEmitter,
    event: RequestEvent,
    public result: PathResolverResult,
    public statPath: STATPATH,
    treeOptions?: OptionsConfig
  ) {
    super(eventer, event);
    this.ancestry = [...result.ancestry, result.item];
    this.treeOptions = treeOptions || event.getTreeOptions(result);
    this.pathOptions = Config.isPath(result.item) ? {
      noDataFolder: result.item.noDataFolder || false,
      noTrailingSlash: result.item.noTrailingSlash || false
    } : { noDataFolder: false, noTrailingSlash: false };
  }
  /**
   * Returns the keys and paths from the PathResolverResult directory. If there
   * is an error it will be sent directly to the client and nothing will be emitted.
   *
   * @param {PathResolverResult} result
   * @returns
   */
  getTreePathFiles(): Promise<DirectoryIndexData> {
    let dirpath = [
      this.result.treepathPortion.join("/"),
      this.result.filepathPortion.join("/")
    ].filter(e => e).join("/");
    const type = Config.isGroup(this.result.item) ? "group" : "folder";
    if (Config.isGroup(this.result.item)) {
      let $c = this.result.item.$children;
      const keys = $c.map(e => e.key);
      const paths = $c.map(e => (Config.isPath(e) ? e.path : true));
      return Promise.resolve({
        keys,
        paths,
        dirpath,
        type: type as "group" | "folder",
      });
    } else {
      return promisify(fs.readdir)(this.result.fullfilepath).then(keys => {
        const paths = keys.map(k => path.join(this.result.fullfilepath, k));
        return { keys, paths, dirpath, type: type as "group" | "folder" };
      }).catch(err => {
        if (!err) return Promise.reject(err);
        this.log(2, 'Error calling readdir on folder "%s": %s', this.result.fullfilepath, err.message);
        this.throw(500);
        return Promise.reject(false);
      });
    }
  }

  async serveDirectoryIndex() {
    const state: TreeStateObject<getStatPathResult<"folder">> = this as any;
    if (!state.url.pathname.endsWith("/")) return state.redirect(state.url.pathname + "/");
    if (state.req.method === "GET") {
      const isFolder = state.result.item.$element === "folder";
      let { indexFile, indexExts, defaultType } = state.treeOptions.index;

      // check for user-specified index files
      if (isFolder && indexExts.length && indexFile.length) {
        let files = await promisify(fs.readdir)(state.result.fullfilepath);
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
          return serveFile(state, index, state.result.fullfilepath);
        } else if (defaultType === 403 || defaultType === 404) {
          return state.throw(defaultType);
        }
      } else if (state.result.item.$element === "group" && state.result.item.indexPath) {
        let { indexPath } = state.result.item;
        state.send({
          root: undefined,
          filepath: indexPath,
          error: err => {
            let error = new ER("error sending index", err.toString());
            state.log(2, error.message).throwError(500, error);
          },
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
      const options = this.getDirectoryIndexOptions(isFolder);
      let contentType: { [K in DirectoryIndexOptions["format"]]: string } = {
        html: "text/html",
        json: "application/json",
        rss: "application/rss"
      };
      const format = first(state.url.query.format);
      if (contains(keys(contentType), format)) {
        options.format = format;
      }
      let e = await state.getTreePathFiles();
      let res = await sendDirectoryIndex(e, options);
      state
        .respond(200, "", {
          "Content-Type": options.format,
          "Content-Encoding": "utf-8",
        })
        // @ts-ignore
        .buffer(Buffer.from(res, "utf8"));
    } else if (state.req.method === "POST") {

      // console.log(state.url);
      if (state.url.query.formtype === "upload") {
        if (Config.isGroup(state.result.item))
          return state.throwReason(400, "upload is not possible for tree groups");
        if (!state.allow.upload) return state.throwReason(403, "upload is not allowed");
        this.uploadPostRequest();
      } else if (state.url.query.formtype === "mkdir") {
        if (Config.isGroup(state.result.item))
          return state.throwReason(400, "mkdir is not possible for tree items");
        if (!state.allow.mkdir) return state.throwReason(403, "mkdir is not allowed");
        this.mkdirPostRequest();
      } else {
        state.throw(400);
      }
    } else {
      state.throw(405);
    }
  }


  private getDirectoryIndexOptions(isFolder: boolean): DirectoryIndexOptions {
    return {
      upload: isFolder && this.allow.upload,
      mkdir: isFolder && this.allow.mkdir,
      mixFolders: this.settings.directoryIndex.mixFolders,
      isLoggedIn: this.username
        ? this.username + " (group " + this.authAccountKey + ")"
        : (false as false),
      format: this.treeOptions.index.defaultType as "html" | "json",
      extIcons: this.settings.directoryIndex.types
    };
  }

  handleGETfile() {
    let state: TreeStateObject<getStatPathResult<"file">> = this as any;
    let result = state.result;
    state.send({
      root: (result.item as Config.FolderElement).path,
      filepath: result.filepathPortion.join("/"),
      error: err => {
        state.log(2, "%s %s", err.status, err.message);
        if (state.allow.writeErrors) state.throw(500);
      },
      headers: (statPath => filepath => {
        const statItem = statPath.stat;
        const mtime = Date.parse(statPath.stat.mtime as any);
        const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join("-"));
        return { Etag: etag };
      })(state.statPath),
    });
  }
  get putsaverEnabled() {
    return this.treeOptions.putsaver.enabled && this.allow.putsaver;
  }
  async handlePUTfile(this: TreeStateObject<getStatPathResult<"file">>) {
    let state = this;
    if (!state.putsaverEnabled) {
      let message = "PUT saver is disabled";
      state.log(-2, message);
      state.respond(405, message).string(message);
      return;
    }
    const first = (header?: string | string[]) => (Array.isArray(header) ? header[0] : header);
    const fullpath = state.statPath.statpath;
    const statItem = state.statPath.stat;
    const mtime = Date.parse(state.statPath.stat.mtime as any);
    const etag = JSON.stringify([statItem.ino, statItem.size, mtime].join("-"));
    const ifmatchStr: string = first(state.req.headers["if-match"]) || "";
    if (
      state.settings.putsaver.etag !== "disabled"
      &&
      (ifmatchStr || state.settings.putsaver.etag === "required")
      &&
      ifmatchStr !== etag
    ) {
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
      if (
        !state.settings.putsaver.etagAge ||
        diskTime - state.settings.putsaver.etagAge * 1000 > headTime
      )
        return state.throw(412);
      console.log("412 prevented by etagWindow of %s seconds", state.settings.putsaver.etagAge);
    }
    await new Promise<void>((resolve, reject) => {
      if (state.treeOptions.putsaver.backupFolder) {
        const backupFile = state.url.pathname.replace(/[^A-Za-z0-9_\-+()\%]/gi, "_");
        const ext = path.extname(backupFile);
        const backupWrite = fs.createWriteStream(
          path.join(state.treeOptions.putsaver.backupFolder, backupFile + "-" + mtime + ext + ".gz")
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
    await new Promise<void>((resolve, reject) => {
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
    const etagNew = JSON.stringify([statNew.ino, statNew.size, mtimeNew].join("-"));
    state.respond(200, "", { "x-api-access-type": "file", etag: etagNew }).empty();
  }
  uploadPostRequest() {
    let state: TreeStateObject<getStatPathResult<"folder">> = this as any;
    let result = state.result;
    var form = new formidable.IncomingForm({
      uploadDir: result.fullfilepath,
      maxFileSize: state.treeOptions.upload.maxFileSize
    });
    form.parse(state.req, function (err: Error, fields, files) {
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
      fs.rename(oldpath, newpath, function (err) {
        if (err) handleFileError("SER-DIR", state, err);
        state.redirect(state.url.pathname + (err ? "?error=upload" : ""));
      });
    });
  }

  mkdirPostRequest() {
    var form = new formidable.IncomingForm();
    let state: TreeStateObject<getStatPathResult<"folder">> = this as any;
    let result = state.result;
    form.parse(state.req, async function (err: Error, fields, files) {
      if (err) {
        debugState("SER-DIR", state)(2, "mkdir %s", err.toString());
        state.throwError(500, new ER("Error recieving request", err.toString()));
        return;
      }
      const newdir = fields.dirname;
      const normdir = path.basename(path.normalize(fields.dirname));
      //if normalize changed anything, it's probably bad
      if (normdir !== newdir || normdir.indexOf("..") !== -1) {
        debugState("SER-DIR", state)(2, "mkdir normalized path %s didnt match %s", normdir, newdir);
        state.throwError(
          400,
          new ER("Error parsing request - invalid name", "invalid path given in dirname")
        );
        return;
      }
      if (
        await promisify(fs.mkdir)(path.join(result.fullfilepath, normdir)).catch(err => {
          handleFileError("SER-DIR", state, err);
          state.redirect(state.url.pathname + "?error=mkdir");
          return true;
        })
      )
        return;

      if (fields.dirtype === "datafolder") {
        let read = fs.createReadStream(path.join(state.settings.__assetsDir, "datafolder-template.json"));
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
          if (!error) state.redirect(state.url.pathname);
        });
        read.pipe(write);
      } else {
        state.redirect(state.url.pathname);
      }
    });
  }
  catchPromiseError = (err) => {
    if (err) {
      this.log(2, "Error caught " + err.toString());
      this.throw(500);
    }
  };


}
