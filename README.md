This is the first release of TiddlyServer 2.0 "Lite". 

# Installation

 1. Download the files from master (Clone or download link at the top right)
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
    "password": ""
}
```

Tree is an object and its children may be either object or string. If a child value is a string, it refers to a path that will be loaded for that alias. If it is an object, it is a sub tree.

So `/alias2/alias2child/` would end up serving the folder named "relative folder path" in the current working directory, and `/alias` will load an absolute path on the file system.

# Questions or Comments?
 - Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this.
 - If you see a bug, please open an issue describing what is going on and I will try to answer it.