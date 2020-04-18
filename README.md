[![Build Status](https://travis-ci.org/someguynamedmatt/TiddlyServer.svg?branch=master)](https://travis-ci.org/someguynamedmatt/TiddlyServer)

# TiddlyServer

> Forked from [Arlen22](https://github.com/Arlen22/TiddlyServer)

### Why forked?

I want to take this project in a different direction both architecturally and ergonomically. Perhaps in the future the two (this and [the original](https://github.com/Arlen22/TiddlyServer)) can be brought back together. But, for now, the directions are a little too different.

### Major TODOs

> See the issues section for more up-to-date thoughts

- Convert _everything_ to TypeScript
- Dockerization
- Remove unnecessary dependencies
- Complete restructure of directories
- Code cleanup
- Update non-TW5 pages (e.g. `/admin/authenticate/login.html`) to React

TiddlyServer takes the server command of TiddlyWiki on NodeJS and adds it to a static file server. This means you can load and serve any TiddlyWiki data folder in the same way you can serve a single file TiddlyWiki.

### Benefits

- Open single-file wikis and data folder wikis with a single click.
- Allows you to access your wikis from any computer on the network.
- Files save and load instantly on the same computer, and quickly across the network.
- Mount any location on your computer (in theory anything NodeJS can stat).

### Features

- Uses a folder structure specified in settings.json allowing you serve any folders on the filesystem in whatever tree structure you like.
- Serves all files found in the folder structure.
- Saves individual files using the put saver.
- Allows you to upload a file to any directory (but not categories), or create new directories and data folders.
  - Want to make a new data folder? First create a directory, then upload your `tiddlywiki.info` file to it.
- Loads data folders using TiddlyWiki then forwards all requests to the listen command. All data folders are mounted on the path they are found at (e.g. `/personal/mydatafolder`)
- Saves a backup of the original everytime a single-file TiddlyWiki is saved (if a backup folder is specified in the settings file).

## Installation

The guide from [the original repository](https://arlen22.github.io/tiddlyserver/docs/gettingstarted.html) is the best place to get started.

## Short instructions

- Install or download NodeJS v8+. Only the Node binary is required, nothing else.
- Download TiddlyServer and unzip it to an empty directory so you don't merge with an existing directory.
- Create your [settings.json](https://arlen22.github.io/tiddlyserver/docs/settingsjson) file and put it in the TiddlyServer folder or specify it as the first argument to `server.js`.
- Run `node server.js [--config /path/to/settings.json] [--stay-on-error] [--dry-run]`
- The working directory is not used by TiddlyServer except for locating the config file if specified. Otherwise it expects to find it in the TiddlyServer folder with the server.js file. All other paths are relative to the settings file. This does not apply inside the TiddlyWiki data folder environment, but TiddyWiki does not normally use it either because it uses the data folder path and the boot.js path as its reference paths.

## How to upgrade

Upgrading is simple. Just follow the installation instructions as usual, then copy your `settings.json` file from your old installation to your new one. If upgrading from 2.0.x to 2.1.x, just use the `example-settings.json` file as your starting point and copy the tree over from your old settings file.

## Questions or Comments?

- Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this app, and your requests will show me where to focus next.

- If you see a bug, please open an issue describing what is going on and I will try to answer it. Including the console output from the server is very useful to me. The browser console or network request log may contain clues as well.
