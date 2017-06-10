This is the first release of TiddlyServer 2.0 Lite. 

# Benefits
  - Allows relative linking to external files.
    - All files found in the folder structure can be served. Relative and path urls work fine. You can even link to the folder, if you like.
  - Easy access to data folders and files from any computer on the network and any browser. Saving on localhost is as fast as TiddlyFox (no benchmarks, but localhost never goes across the network, making it instant).

# Features
 - Uses a folder structure specified in settings.json allowing you serve any folders on the filesystem in whatever tree structure you like.
 - Serves any files found in the folder structure.
 - Saves individual files using the put saver.
 - Loads data folders using a certain core/boot version (currently whatever gets installed with `npm install`) then forwards all requests to the server command. All data folders are mounted on the path they are found at (e.g. `/personal/mydatafolder/`)

# Questions or Comments?
 - Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this.
 - If you see a bug, please open an issue describing what is going on and I will try to answer it.