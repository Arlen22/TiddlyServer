## TiddlyServer 2.0 "Lite". 

TiddlyServer 2.0 takes the server command of TiddlyWiki on NodeJS and adds it to a static file server. This means you can load and serve any TiddlyWiki data folder in the same way you can serve a single file TiddlyWiki. But you don't need to serve files and folders from just one place, you can serve them from multiple places anywhere on your harddrive (literally anywhere NodeJS can stat, readdir, and readFile). You can even organize them into virtual folders (aka aliases in Apache and mounts in Express). 

But the main point is that you can actually edit your files, not just look at them. Single file TiddlyWikis use the put saver, which needs to be patched using a bookmarklet (this is to be fixed) included on the index page. 

And, of course, you can edit data folder tiddlywikis just like you were running `node tiddlywiki.js data --server`, except that you run it on the path that you found it at (e.g. http://localhost/personal/notes/). You can have as many data folders open as you want, they don't conflict (though they will each take memory).

# Major changes in master since last release

 - The host is now `127.0.0.1` by default. In order to access TiddlyServer over the network, set it to a specific IP address, or  `0.0.0.0` to listen on all IP addresses on the computer.

# Installation

 1. Download and unzip the source code from the latest release. https://github.com/Arlen22/TiddlyServer/releases
 2. `npm install`
 3. Rename `example-settings.json` to just `settings.json` and configure your tree with the actual folders you want to serve. See below for details on settings.json.
 4. `npm start` or `node server.js`

# Benefits
  - Allows relative linking to external files.
    - All files found in the folder structure can be served. Relative and path urls work fine. You can even link to the folder, if you like.
  - Easy access to data folders and files from any computer on the network and any browser. Saving on localhost is as fast as TiddlyFox (no benchmarks, but localhost never goes across the network, making it instant).

# Features
 - Uses a folder structure specified in settings.json allowing you serve any folders on the filesystem in whatever tree structure you like.
 - Serves any files found in the folder structure.
 - Saves individual files using the put saver.
 - Loads data folders using a certain core/boot version (currently whatever gets installed with `npm install`) then forwards all requests to the server command. All data folders are mounted on the path they are found at (e.g. `/personal/mydatafolder/`)

# settings.json

```json
{
    "tree": {
        "alias": "C:/my folder path",
        "alias2": {
            "alias2child": "relative folder path"
        }
    },
    "types":{
        "htmlfile": ["htm", "html"]
    }, 
    "username": "",
    "password": "",
    "host": "127.0.0.1",
    "port": 8080
}
```
If not specified, username and password are not set, and types, host and port are set to the values above. Tree must be specified.

Tree is an object and its children may be either object or string. If a child value is a string, it refers to a path that will be loaded for that alias. If it is an object, it is a sub tree.

So `/alias2/alias2child/` would end up serving the folder named "relative folder path" in the current working directory, and `/alias` will load an absolute path on the file system.

There are a few aliases which cannot be used directly under tree as they are reserved for other things on the server. Currently they are `favicon.ico`, `directory.css`, `icons`, and `admin`. If tree contains any of these they will simply be ignored. This only applies to the top level tree, not to sub trees.

# Questions or Comments?
 - Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this app, and your requests will show me where to focus next.
 - If you see a bug, please open an issue describing what is going on and I will try to answer it.
