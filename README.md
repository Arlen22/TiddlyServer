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

## Major changes since 2.0.7

* TiddlyServer now correctly uses the username specified in `settings.json` for signing edits in data folders.

## Installation

Another TiddlyWiki user has written an install guide. It is clear and concise, and will be useful for the average user.

https://www.didaxy.com/introduction-to-tiddlyserver

The instructions below are intended to be detailed and thorough, so read on if you're interested. 

### Bundled version

The bundled version contains all the npm dependancies for TiddlerServer, and therefore does not use NPM. The NodeJS executable still needs to be installed (which will also install NPM) or copied into the folder, but the prodedure is a lot simpler. The bundled file is named `TiddlyServer-x.x.x-bundled.zip`.

The editions folder is not included in the bundled version because of the number of files it contains. Since it only contains data folders, it is not needed for TiddlyServer to operate. It is included in each release as a separate zip file and is always from the same version of TiddlyWiki as the bundled file contains. 

For convenience, the "server" edition is also included as a separate download because this is used as a data folder template.

 1. Download and install NodeJS from https://nodejs.org
    - If you want to make a portable TiddlyServer, just download the binary file. The LTS version (the default) is fine. You will need to download the correct architecture. 32-bit is recommended for maximum portability on most desktops and laptops. If you are going to be using it on a linux or android device, you may need the ARM binaries as the ARM architecture is generally found in micro pc builds, mobile devices, and tablets.
 2. Download the latest `TiddlyServer-x.x.x-bundled.zip` from https://github.com/Arlen22/TiddlyServer/releases and unzip the folder contained in the zip file to wherever you want it. __Put the NodeJS binary (node.exe) in this folder if you want it to be portable.__ None of the other NodeJS files are needed for a portable install.  
 3. Rename `example-settings.json` to just `settings.json` and configure your tree with the actual folders you want to serve. See below for details on settings.json.
 4. Open your terminal or command prompt and run `node server.js` or `node server.js /path/to/settings.json` or run `start.cmd`.

### Source code version
 1. Download and unzip the source code from the latest release of TiddlyServer: https://github.com/Arlen22/TiddlyServer/releases
 1. Download and unzip the source code from the latest release of TiddlyWiki5 into the TiddlyServer folder: https://github.com/Jermolene/TiddlyWiki5/releases
    * Or run `npm install`, then move the tiddlywiki folder from *inside* the node_modules folder to *beside* it. After that you may delete the node_modules folder.
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

These are the default values, except for `tree`, which has no default value and must be specified in settings.json.

All relative folder paths in settings.json are resolved relative to the settings.json file itself.

Tree is an object and its children may be either object or string. If a child value is a string, it refers to a path that will be loaded for that alias. If it is an object, it is a sub tree.

So `/alias2/alias2child/` would end up serving the folder named "folder relative to settings file" next to the settings.json file, and `/alias` will load an absolute path on the file system.

There are a few aliases which cannot be used directly under tree as they are reserved for other things on the server. Currently they are `favicon.ico`, `directory.css`, `icons`, and `admin`. If tree contains any of these they will simply be ignored. This only applies to the top level tree, not to sub trees.

If the backupDirectory is specified, it must exist, otherwise saving will fail for all single-file wikis. TiddlyWiki Folders are not backed up and therefore will still save as usual even if the directory does not exist.

## Questions or Comments?
 - Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this app, and your requests will show me where to focus next.
 - If you see a bug, please open an issue describing what is going on and I will try to answer it.

## A word to you

If you want to help cover the cost of making this all happen, use https://www.paypal.me/Arlen22. Your help is appreciated and will increase the likelihood of future improvements.
