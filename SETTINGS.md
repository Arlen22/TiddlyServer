# `settings.json`

The settings.json follows this TypeScript interface definition, except for the properties marked "internal use".

```ts
export interface ServerConfig {
  __dirname: string;          //internal use
  __filename: string;         //internal use
  __assetsDir: string;        //internal use
  _disableLocalHost: boolean; //internal use
  tree: any, //string or "deep hashmap" of string
  types: {
      htmlfile: string[];
      [K: string]: string[]
  }
  username?: string,
  password?: string,
  host: string,
  port: number | 8080,
  backupDirectory?: string,
  etag: "required" | "disabled" | "", //otherwise if present
  etagWindow: number,
  useTW5path: boolean,
  debugLevel: number,
  allowNetwork: ServerConfig_AccessOptions,
  allowLocalhost: ServerConfig_AccessOptions,
  logAccess: string | false,
  logError: string,
  logColorsToFile: boolean,
  logToConsoleAlso: boolean;
  /** cache max age in milliseconds for different types of data */
  maxAge: { tw_plugins: number }           // Coming soon
  tsa: { alwaysRefreshCache: boolean; },   // Coming soon
}
export interface ServerConfig_AccessOptions {
  upload: boolean
  mkdir: boolean
  settings: boolean
  WARNING_all_settings_WARNING: boolean
}
```

All relative folder paths in settings.json are resolved relative to the `settings.json` file itself.

### `tree`

An object (hashmap) with the key being the "folder" name (`http://localhost/alias/`) and the value being either a folder path string, or a hashmap containing "folder" names under that folder. 

In the example above, `/alias2/alias2child/` would end up serving the folder named "folder relative to settings file" next to the settings.json file, and `/alias` will load an absolute path on the file system.

There is no default value for tree. The program will throw an exception if it is not specified. 

There are a few aliases which cannot be used directly under tree as they are reserved for other things on the server. Currently they are `favicon.ico`, `directory.css`, `assets`, `icons`, and `admin`. If tree contains any of these they will simply be ignored. This only applies to the top level tree, not to sub trees.

### `types`

A hashmap with the key being the name of a png file in `assets/icons/files` (without the extension), and the value being an array of extensions listed under that type. This is only used in the directory listing currently.

### `username`

A string specifying the username for Basic Auth and for signing tiddlers when editing data folders. Single file wikis do not get the username set, but will still require Basic Auth. Defaults to an empty string.

### `password`

The password for Basic Auth. Defaults to an empty string.

### `host`

The host IP address to listen on. 

If `127.0.0.1` is specified, then only browsers and software on the local computer will be able to access the server. This is the default if nothing is specified.

If an IP address is specified, then any computer on the network will be able to access the server via that IP address if that IP address is actually assigned to a network interface on the server.

If `0.0.0.0` is specified, then the server will listen on all IP addresses. 

Under the hood, this just uses the default Node HTTP server, so you may refer to that documentation if you want more technical information.

### `port`

The port to listen on. The default is `8080`.

### `backupDirectory`

On every save for all single-file TiddlyWikis, TiddlyServer will gzip the old version and write it to this folder before saving the new version.

If the backupDirectory is specified, it must exist, otherwise saving will fail for all single-file wikis. TiddlyWiki Folders are not backed up and therefore will still save as usual even if the directory does not exist.

If not specified, backup is disabled.

### `etag`

Either `required` or `disabled`. If not specified then only checks etag if the client provides one.

### `etagWindow`

If the etag gets checked and does not match, allow it to save if the file on disk was not modified more than this many seconds later than the modified time in the etag. 

The rationale behind this is that if you have two copies of the same wiki open in two different browser windows, and spend hours working and saving in one, you won't be purposely saving changes to a 3 hour old copy of your wiki for any reason whatsoever. 

But if the file on disk is only 3 seconds newer than the copy in the browser, you probably aren't going to have that much substantial work being saved. If this is your work flow and you want to disable etag altogether, that is possible by setting `etag` to `disabled` (see above).

If nothing is specified, then the etag must match exactly if checked.

### debugLevel

Write debug messages at or above this value to the console. The max recommended is 2, and the minimum recommended is -1 for normal operation. Some debug messages are not implemented when they should be, but the following list is what I use to determine the debug level for a specific message.

 *  4 - Errors that require the process to exit for restart
 *  3 - Major errors that are handled and do not require a server restart
 *  2 - Warnings or errors that do not alter the program flow but need to be marked (minimum for status 500)
 *  1 - Info - Most startup messages
 *  0 - Normal debug messages and all software and request-side error messages
 * -1 - Detailed debug messages from high level apis
 * -2 - Response status messages and error response data
 * -3 - Request and response data for all messages (verbose)
 * -4 - Protocol details and full data dump (such as encryption steps and keys)

### `allowNetwork` and `allowLocalhost`

A set of options specifying whether different actions and pages are allowed for requests coming from the network (`allowNetwork`) and the loopback interface (`allowLocalhost`)

* `mkdir` - Allow network users to create a directory or data folder in the current directory.
* `upload` - Allow network users to upload files to the current directory.
* `settings` - Allow network users to modify some of the settings.
* `WARNING_all_settings_WARNING` - Allow network users to modify all settings.
  * `host`, `port`, `username`, `password`, `allowNetwork`, `allowLocalhost`, `useTW5path`

Whether `tree` will be allowed at all has not been decided yet. There are several serious security problems that need to be considered before allowing the tree variable to be updated via a web request. The main problem is that code running in a sandboxed environment such as a web browser can potentially make calls to localhost and modify the tree to expose sensitive operating system files. One possibility I have considered is to simply provide the new JSON text to the user to copy and paste into `settings.json` themself.

### `logAccess` and `logError`

Specifies the log files to log request info (`logAccess`) and debug info (`logError`) to. If a path is not specified, the info will instead be logged to console using `console.log(...)`.

### `logColorsToFile`

Log the color codes to file. Useful if you read the logs by writing them back to the console. 

### `logToConsoleAlso`.

Log to console regardless of whether we are logging to a file. 