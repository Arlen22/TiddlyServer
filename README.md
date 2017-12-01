If you want to help cover the cost of making this all happen, use https://www.paypal.me/Arlen22. Your help is appreciated and will increase the likelihood of future improvements.

## TiddlyServer 2.0 "Lite"

TiddlyServer 2.0 takes the server command of TiddlyWiki on NodeJS and adds it to a static file server. This means you can load and serve any TiddlyWiki data folder in the same way you can serve a single file TiddlyWiki. 

But you don't need to serve files and folders from just one place, you can serve them from multiple places anywhere on your harddrive (literally anywhere NodeJS can stat, readdir, and readFile). You can even organize them into virtual folders (aka aliases in Apache and mounts in Express). 

The main point, of course, is that you can actually edit your files, not just look at them. Single file TiddlyWikis use the put saver, which needs to be patched using a bookmarklet included on the index page. The instructions for this are below under the heading "One thing that needs to be noted".

And, of course, you can edit data folder tiddlywikis just like you were running `node tiddlywiki.js data --server`, except that you run it on the path that you found it at (e.g. http://localhost/personal/notes/). You can have as many data folders open as you want, they don't conflict (though they will each take memory).

Data folders store individual tiddlers instead of entire wikis. They take less disk space as they also do not store the core and plugins. This means they also save much quicker, especially over the internet. They also save immediately (within 10 seconds or so) and they save drafts.

### Benefits
  - Allows relative linking to external files.
    - All files found in the folder structure can be served. Relative and path urls work fine. You can even link to the folder, if you like.
  - Easy access to data folders and files from any computer on the network and any browser. Saving on localhost is as fast as TiddlyFox (no benchmarks, but localhost never goes across the network, making it instant).

### Features
 - Uses a folder structure specified in settings.json allowing you serve any folders on the filesystem in whatever tree structure you like.
 - Serves any files found in the folder structure.
 - Saves individual files using the put saver.
 - Loads data folders using a certain core/boot version (currently whatever gets installed with `npm install` or the bundled version if you use that) then forwards all requests to the server command. All data folders are mounted on the path they are found at (e.g. `/personal/mydatafolder/`)
 - Saves a backup of the original everytime a single-file TiddlyWiki is saved (if a backup folder is specified in the settings file).

## One thing that needs to be noted

TiddlyWiki Five files currently use the put saver. The put saver URI encodes the document location, which is usually already encoded by the browser, resulting in a 404 error when saving, if the URL contains any characters that get converted to percent codes (such as %20). 

You will need to use the bookmarklet included in the directory pages to fix the saving. The bookmarklet needs to be clicked each time the affected wiki is opened, after which saving should work normally until the page is reloaded. This does not apply to data folders.

This is a bug in TiddlyWiki, and is fixed in TW5.1.15.

## [Change log](CHANGELOG.md)

## Installation

If upgrading from a previous release of TiddlyServer, do not copy the new files into the old distribution. Unzip the new folder and only copy `settings.json` into it from the old folder. 

Another TiddlyWiki user has written an install guide. It is clear and concise, and will be useful for the average user.

https://www.didaxy.com/introduction-to-tiddlyserver

The instructions below are intended to be detailed and thorough, so read on if you're interested. 

### Bundled version

The bundled version contains all the npm dependancies for TiddlerServer, and therefore does not use NPM. The NodeJS executable still needs to be installed (which will also install NPM) or copied into the folder, but the prodedure is a lot simpler. The bundled file is named `TiddlyServer-x.x.x-bundled.zip`.

The editions folder is not included in the bundled version because of the number of files it contains. Since it only contains data folders, it is not needed for TiddlyServer to operate. It is included in each release as a separate zip file and is always from the same version of TiddlyWiki as the bundled file contains. 

For convenience, the "server" edition is also included as a separate download because this is used as a data folder template.

 1. Download the latest `TiddlyServer-x.x.x-bundled.zip` from https://github.com/Arlen22/TiddlyServer/releases and unzip the folder contained in the zip file to wherever you want it. 
 2. Download and install NodeJS from https://nodejs.org
    - If you want to make TiddlyServer portable, just download the binary file. The LTS version (the default) is fine. You will need to download the correct architecture. 32-bit is recommended for maximum portability on most desktops and laptops. If you are going to be using it on a linux or android device, you may need the ARM binaries as the ARM architecture is generally found in micro pc builds, mobile devices, and tablets. __Put the NodeJS binary (node.exe) in the TiddlyServer folder.__ None of the other NodeJS files are needed for a portable install.  
 3. Rename `example-settings.json` to just `settings.json` and configure your tree with the actual folders you want to serve. See below for details on settings.json.
 4. Open your terminal or command prompt and run `node server.js` or `node server.js /path/to/settings.json` or run `start.cmd`.

### Source code version
 1. Download and unzip the source code from the latest release of TiddlyServer: https://github.com/Arlen22/TiddlyServer/releases
 1. The target version of TiddlyWiki is now included in the repository to ease the maintenance burden of each release and because TiddlyServer includes the boot code in the src folder already so it does not need to be installed separately anymore.
 1. Rename the `TiddlyWiki5-x.x.x` folder to just `tiddlywiki`.
 1. Copy `example-settings.json` and rename it `settings.json`.
 1. Configure your tree with the actual folders you want to serve. See below for details on settings.json.
 1. `node server.js` (`npm start`) or `node server.js /path/to/settings.json`

## settings.json

Some users find the exact requirements of JSON to be somewhat difficult. If you get the error `The settings file could not be parsed correctly`, it means the settings file contains invalid JSON and could not be parsed. **It does not mean the settings are incorrect, rather that it cannot read them.** You can use a service like https://jsonlint.com/ to show you where the problem is in your JSON file -- just paste in your settings file and click Validate.

```json
// all comments need to be removed for settings.json to parse correctly
{
    "tree": { 
        "alias": "C:/my folder path",
        "alias2": {
            "alias2child": "folder relative to settings file"
        }
    },
    "types":{  
        "htmlfile": ["htm", "html"] 
    }, 
    "username": "",  
    "password": "",  
    "host": "127.0.0.1",  
    "port": 8080,                
    "backupDirectory": "" 
}
```

All relative folder paths in settings.json are resolved relative to the settings.json file itself.

### tree

An object (hashmap) with the key being the "folder" name (`http://localhost/alias/`) and the value being either a folder path string, or a hashmap containing "folder" names under that folder. 

In the example above, `/alias2/alias2child/` would end up serving the folder named "folder relative to settings file" next to the settings.json file, and `/alias` will load an absolute path on the file system.

There is no default value for tree. The program will throw an exception if it is not specified. 

There are a few aliases which cannot be used directly under tree as they are reserved for other things on the server. Currently they are `favicon.ico`, `directory.css`, `icons`, and `admin`. If tree contains any of these they will simply be ignored. This only applies to the top level tree, not to sub trees.

### types

A hashmap with the key being the name of a png file in `assets/icons/files` (without the extension), and the value being an array of extensions listed under that type. This is only used in the directory listing currently.

### username

A string specifying the username for Basic Auth and for signing tiddlers when editing data folders. Single file wikis do not get the username set, but will still require Basic Auth. Defaults to an empty string.

### password

The password for Basic Auth. Defaults to an empty string.

### host

The host IP address to listen on. 

If `127.0.0.1` is specified, then only browsers and software on the local computer will be able to access the server. This is the default if nothing is specified.

If an IP address is specified, then any computer on the network will be able to access the server via that IP address if that IP address is actually assigned to a network interface on the server.

If `0.0.0.0` is specified, then the server will listen on all IP addresses. 

Under the hood, this just uses the default Node HTTP server, so you may refer to that documentation if you want more technical information.

### port

The port to listen on. The default is `8080`.

### backupDirectory

On every save for all single-file TiddlyWikis, TiddlyServer will gzip the old version and write it to this folder before saving the new version.

If the backupDirectory is specified, it must exist, otherwise saving will fail for all single-file wikis. TiddlyWiki Folders are not backed up and therefore will still save as usual even if the directory does not exist.

If not specified, backup is disabled.

### etag

Either `required` or `disabled`. If not specified then only checks etag if the client provides one.

### etagWindow

If the etag gets checked and does not match, allow it to save if the file on disk was not modified more than this many seconds later than the modified time in the etag. 

The rationale behind this is that if you have two copies of the same wiki open in two different browser windows, and spend hours working and saving in one, you won't be purposely saving changes to a 3 hour old copy of your wiki for any reason whatsoever. 

But if the file on disk is only 3 seconds newer than the copy in the browser, you probably aren't going to have that much substantial work being saved. If this is your work flow and you want to disable etag altogether, that is possible by setting `etag` to `disabled` (see above).

If nothing is specified, then the etag must match exactly if checked.


## Questions or Comments?
 - Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this app, and your requests will show me where to focus next.
 - If you see a bug, please open an issue describing what is going on and I will try to answer it.

## A final thought

If you want to help cover the cost of making this all happen, use https://www.paypal.me/Arlen22. Your help is appreciated and will increase the likelihood of future improvements.

