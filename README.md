If you want to help cover the cost of making this all happen, use https://www.paypal.me/Arlen22. Your help is appreciated and directly affects my work on TiddlyServer.

## TiddlyServer 2.0 "Lite"

TiddlyServer 2.0 takes the server command of TiddlyWiki on NodeJS and adds it to a static file server. This means you can load and serve any TiddlyWiki data folder in the same way you can serve a single file TiddlyWiki. 

But you don't need to serve files and folders from just one place, you can serve them from multiple places anywhere on your harddrive (literally anywhere NodeJS can stat, readdir, and readFile). You can even organize them into virtual folders (aka "aliases" in Apache and "mounts" in Express). 

The main point, of course, is that you can actually edit your files, not just look at them. Single file TiddlyWikis use the put saver, which needs to be patched using a bookmarklet included on the index page. The instructions for this are below under the heading "One thing that needs to be noted".

And, of course, you can edit data folder tiddlywikis just like you were running `node tiddlywiki.js data --server`, except that you run it on the path that you found it at (e.g. http://localhost/personal/notes). You can have as many data folders open as you want, they don't conflict (though they will each take memory).

Data folders store individual tiddlers instead of entire wikis. They take less disk space as they also do not store the core and plugins. This means they also save much quicker, especially over the internet. They also save immediately (within 10 seconds or so) and they save drafts.

### Benefits

* Seemlessly convert between data folders and single-file wikis.
* Allows relative linking to external files. The same link works in both data folders and single files. 
* Allows you to access your wikis from any computer on the network. 
* Files save and load instantly on the same computer, and quickly across the network.
* Mount any location on your computer (in theory, anything NodeJS can stat).

### Features
 - Uses a folder structure specified in settings.json allowing you serve any folders on the filesystem in whatever tree structure you like.
 - Serves all files found in the folder structure.
 - Saves individual files using the put saver.
 - Allows you to upload a file to any directory (but not categories), or create new directories and data folders. 
   - Want to make a custom data folder? First create it as a directory, then upload your custom `tiddlywiki.info` file to it.
 - Loads data folders using TiddlyWiki then forwards all requests to the server command. All data folders are mounted on the path they are found at (e.g. `/personal/mydatafolder`)
 - Saves a backup of the original everytime a single-file TiddlyWiki is saved (if a backup folder is specified in the settings file).

## One thing that needs to be noted for single file wikis before 5.1.15

This does not apply to data folders. 

TiddlyWiki5 files currently use the put saver. The put saver URI encodes the document location, which is usually already encoded by the browser, resulting in a 404 error when saving, if the URL contains any characters that get converted to percent codes (such as %20). 

You will need to use the bookmarklet included in the directory pages to fix the saving. The bookmarklet needs to be clicked each time the affected wiki is opened, after which saving should work normally until the page is reloaded. If there are unsaved changes, another change needs to be made to trigger a save.

The updated tiddler is also included as another link and may be dragged into the wiki to import the tiddler normally. After import the wiki will still need to be saved, either by downloading or by using the bookmarklet.

This is a bug in TiddlyWiki, and is fixed in version 5.1.15. 

## [Change log](CHANGELOG.md)

## Quick Upgrade

Just follow the installation instructions, and copy the `settings.json` file from the old installation to the new one. Any breaking changes in `settings.json` after 2.0.10 will be noted here.

## Quick Install 

* Download and install NodeJS from https://nodejs.org
  * **ProTip:** TiddlyServer only requires `node.exe`, allowing a portable install. The current directory (aka cwd) is completely ignored.
* Download the latest release from https://github.com/Arlen22/TiddlyServer/releases and unzip the TiddlyServer folder contained in the zip file to wherever you want it. 
* If upgrading, copy `settings.json` from your previous install. Otherwise, copy `example-settings-simple.json` and rename it `settings.json`. 
  * This configuration serves a folder named `data` located in the same folder as `settings.json`. This folder does not exist and must be created. You can also change the folder structure to however you like.
  * It also expects to save single-file backups to a folder named `backups`, which must also be created. If you do not want backups, just set it to an empty string.
  * Please refer to [the `settings.json` docs](SETTINGS.md).
* Open command prompt and run `/path/to/node /path/to/tiddlyserver/server.js`.

## TiddlyServer for "the-not-so-techy"

Inspired by those black and yellow books, I present [The Getting Started Guide](GETTINGSTARTED.md)

## FAQ

If these do not answer your question, feel free to open an issue or ask on the TiddlyWiki Google Group.

### TiddlyServer throws a Syntax Error on start up

Make sure you are running at least Node version 6. This is the minimum supported.

## `settings.json`

Some users find the exacting requirements of JSON to be somewhat difficult. If you get the error `The settings file could not be parsed correctly`, it means the settings file contains invalid JSON and could not be parsed. **It does not mean the settings are incorrect, rather that it cannot read them.** It should show you where in the file the error occured, but you can also use a service like https://jsonlint.com/ to help you find problems -- just paste in your settings file and click Validate.

Please refer to [the Settings Docs](SETTINGS.md) for detailed documentation on all keys in `settings.json`. 

## Detailed Installation Instructions

If upgrading from a previous release of TiddlyServer, do not copy the new files into the old distribution. Unzip the new folder and only copy `settings.json` into it from the old folder. 

Another TiddlyWiki user has written an install guide. It is clear and concise, and will be useful for the average user.

https://www.didaxy.com/introduction-to-tiddlyserver

### Old instructions

TiddlyServer contains all its dependancies directly in the repository and therefore does not use NPM. The NodeJS executable still needs to be installed (which will also install NPM), or can be copied into the folder for a portable install.

The editions folder from TiddlyWiki is not included because of the number of files it contains. Since it only contains data folders, it is not needed for TiddlyServer to operate. It is included in each release (or in an earlier release) as a separate zip file and is always from the same version of TiddlyWiki as is used in that release.

For convenience, the "server" edition is also included as a separate download because this is used as a data folder template.

If you want to make TiddlyServer portable, just download the binary file instead of the installer. The LTS version (the default) is fine. You will need to download the correct architecture. 32-bit is recommended for maximum portability on most desktops and laptops. If you are going to be using it on a linux or android device, you may need the ARM binaries as the ARM architecture is generally found in micro pc builds, mobile devices, and tablets. __Put the NodeJS binary (node.exe) in the TiddlyServer folder.__ None of the other NodeJS files are needed for a portable install.

 1. Download and install NodeJS from https://nodejs.org
 1. Download the latest release from https://github.com/Arlen22/TiddlyServer/releases and unzip the folder contained in the zip file to wherever you want it. 
 1. Rename `example-settings.json` to just `settings.json` and configure your tree with the actual folders you want to serve. See below for details on settings.json.
 1. Open your terminal or command prompt and run `node server.js` (or `npm start`) or `node server.js /path/to/settings.json` OR run `start.cmd`.

## Questions or Comments?
 - Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this app, and your requests will show me where to focus next.
 - If you see a bug, please open an issue describing what is going on and I will try to answer it.

## A final thought

If you want to help cover the cost of making this all happen, use https://www.paypal.me/Arlen22. Your help is appreciated and will increase the likelihood of future improvements.

