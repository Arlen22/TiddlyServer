### 2.1

* Settings format is changed. Run `node upgrade-settings old-file.json new-file.json` to upgrade to the new format.
  * To find out exactly how the old format maps to the new format, find the `ConvertSettings` function in `server-types.ts`.
  * The tree format has changed significantly to allow better control over individual directories. The upgrade script will modify the tree to make it compatible with the new version. Folder as root is still supported.
	* The host parameter has been replaced with several parameters in the `server` section.
  * `useTW5path` is set to `true` during the upgrade. If you prefer to access data folders without the trailing slash, you need to set this to false. This affects relative links.
	* The settings file now includes a JSON Schema, which editors such as VS Code can use to provide descriptions and intellisense. 
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