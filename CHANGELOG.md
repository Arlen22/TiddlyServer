### 2.2

- PutSaver no longer advertises in the OPTION response unless putsaver is enabled for that path and user/interface.
- Added `datafolder` and `websocket` option to user/interface permissions and updated default permissions to better reflect common the most common use case.
- `localhost` no longer has separate defaults for `localAddressPermissions`. `localhost` may still be specified if desired.
- If a secure plugin is developed it will be considered a separate local address. 
- WebSockets now use the same access checks as regular requests. An invalid path will return a 404 error. Not being logged in when required will return the same status code (and HTML page if the loginlink permission allows it) as specified in the tree. 
- TiddlyServer no longer adds the wss variable to the data folder $tw variable. Plugins should instead listen for the server start hook and add it if desired.  
- The tiddlywiki directory is now the `tiddlywiki-production` node module. The `_datafoldertarget` setting may still be used to provide a custom path. TiddlyServer will specify the exact version of `tiddlywiki-production` in package.json. 
- Removed logging option. The debug output (aka error log) goes to stderr and the access log goes to stdout. The startup preamble is printed using `console.log`. I recommend using pm2 or another process manager if you are needing to do more than just log it to console. PM2 is nice because it separates the stdout and stderr streams allowing you to see the latest messages on both. Data folders have been untouched. They should log to wherever they usually do. That's another reason the logging wasn't a perfect option. 

### 2.1.0

#### Breaking changes
We've upgraded to TiddlyWiki 5.1.19 and `settings.json` has completely changed. Details are included below.

#### Changes to settings.json during Beta
- `hostLevelPermissions` was renamed `localAddressPermissions`.

#### Changes postponed for a future release
- Routing requests according to the host header.

#### Improvements

The settings format is completely changed and is now called Server Config.
* Run `node upgrade-settings old-file.json new-file.json` to upgrade to the new format. Both fies must be specified, and the new file must NOT exist already. To find out exactly how the old format maps to the new format, find the `ConvertSettings` function in `server-types.ts`.
* The tree format has changed significantly to allow better control over individual directories. The upgrade script will modify the tree to make it compatible with the new version. Folder as root is still supported. The syntax is based on XML, which makes it much easier to add things like per-folder auth and index options. In the future, a path to an XML file will be allowed in `settings.tree` instead of an object.
* The `host` parameter has been replaced with several parameters in the `bindInfo` section.
* `allowLocalhost` and `allowNetwork` have been replaced with a hashmap under `settings.bindInfo.hostLevelPermissions`
* `useTW5path` is set to `true` during the upgrade. If you prefer to access data folders without the trailing slash, you need to set this to false. This affects relative links, but nothing else. The TiddlyWeb adapter gets the page URL from a different source.
* The settings file now includes a JSON Schema, which editors such as VS Code can use to provide descriptions and intellisense. TiddlyServer uses `ajv` to validate the settings file based on the schema specified (using JSON Schema draft 6).
* The settings file (and any other JSON files specified in it) are parsed using the JSON5 parser, which allows comments and some sloppy syntax (such as a comma after the last item in an object or array). 

The root `server.js` file is more involved in the server startup process. It basically loads the rest of TiddlyServer as a module. If you are interested in extending TiddlyServer significantly or integrating it into existing systems, definitely check it out. 

Websocket support is built into TiddlyServer, but the TiddlyWiki server integration is still being finalized. Plugins which want to listen for websocket connections need to listen for the `th-server-command-post-start` hook in TiddlyWiki. It provides 3 arguments: the NodeJS server instance, an event emitter, and the string `tiddlyserver`. The event emitter emits the event `ws-client-connect` with three arguments when there is a new WebSocket connection.
* the `WebSocket` client
* the `IncomingMessage` from the NodeJS server request 
* the `string` subpath of the request (the portion after the datafolder URL)

HTTPS is now supported. See the https.js file for details on generating an SSL certificate. The path to the file must be set in `bindInfo` > `https`.

### 2.0.14

* Upgraded to TiddlyWiki 5.1.17.

### 2.0.13

#### Breaking changes
* Added `/static` as a reserved mount path and moved `/icons` to `/static/icons`.
* Upgraded to TiddlyWiki 5.1.16

#### Improvements
* Added a warning if a mount path in `settings.json` is reserved.
* Added a settings page at `/admin/settings/`. The `tree` and `types` options are not yet available.
* Added `allowLocalhost` hashmap to `settings.json` identical to `allowNetwork`. Options for one of them does not affect options for the other one, so localhost can be more restricted than network. 
* Added several options related to logging, and now allows logs to be saved to file using NodeJS `appendFile`.
  * Added options: `logAccess`, `logError`, `logColorsToFile`, `logToConsoleAlso`.
* Added `debugLevel` to set the debug level of the messages to be logged to console or the error log.
* Added filename field to specify the filename of the file being uploaded.

### 2.0.12 

* Use webpack to bundle the dependancies.
* Add the ability to upload files to a directory and create directories and data folders.
* Add `allowNetwork` hashmap to `settings.json` to specify whether requests from the network (i.e. any requests
  not coming in through the loopback interface) are allowed to take certain actions. See the readme for details.

### 2.0.11
* Upgrade to TiddlyWiki 5.1.15.

### 2.0.9

* Add the `etag` and `etagWindow` options to partially or completely disable etag checking. 
* Remove the trailing slash from data folders in order to allow relative links in tiddlers imported from single file wikis to continue to work without changing the folder structure. 
  * Data folders are opaque and appear to the user to be identical to a single file TiddlyWiki, therefore the relative links should also work the same.
* Move the TiddlyWiki bundle into the repository since changes have been made to the boot code. 
* Add a websocket server to TiddlyServer and add hooks to the data folders.
* * Currently there is no real way to make use of the server in TiddlyWiki.
* Point to the actual TiddlyWiki package.json file in the bundle instead of having a copy in the src folder. 

### 2.0.8

* Use the username specified in `settings.json` for signing edits in data folders.
* Improve the error message in the console when a stale single file wiki is PUT to the server. It is also known as error 412 Edit Conflict and indicates a file edit conflict, not a tiddler edit conflict within the file. 

### 2.0.7

* A new favicon inspired by the NodeJS icon. This might not be the final icon. I posted a request for comments on the Google Group: https://groups.google.com/forum/#!topic/tiddlywiki/0Jl6EaH6rQM
* The source code installation method has changed, and no longer uses `npm install`. The readme has been updated to reflect this.
* A custom error message has been added to indicate exactly where the problem is when `settings.json` fails to parse. Usually the error is either an extra comma or bracket, so you may need to look at the previous line to the one indicated in the error message to find the actual source of the problem.
* Under the hood, the files have been modified somewhat to support compiling using nexe. This is still in the testing stage but it should be stable, so if you're interested you can download the "nexe" version for your OS. The executable is inside the `dist` folder.
* A mac app launcher script has been added, and users are welcome to test it and let me know how it works. To use it, rename the TiddlyServer folder to Contents, then place it inside another folder and name that folder `Tiddlyserver.app`. You should now be able to double-click it to launch TiddlyServer. To open the folder, right click on it and click Examine Package Contents (or something like that). This is very much experimental so all feedback is welcome.

### 2.0.6

Probably the first release which did not qualify as a beta product. Everything worked and a few error messages were updated. 