My work on tools related to TiddlyWiki is entirely a side project for me that does not generate any income. If you want to help cover the cost of the time it takes to make these tools, you are welcome to donate at https://www.paypal.me/Arlen22. 

# TiddlyServer 2.2

https://arlen22.github.io/tiddlyserver/

TiddlyServer takes the server command of TiddlyWiki on NodeJS and adds it to a static file server. This means you can load and serve any TiddlyWiki data folder in the same way you can serve a single file TiddlyWiki. 

### Notes for 2.2

- You can run `npm install -g tiddlyserver` and everything will be installed properly. Installation instructions are below.
- The terms "settings.json" and "config file" both refer to the same thing. I'm changing the terminology to keep things simple, because the config file can be specified as a command line option `tiddlyserver --config settings.json`.
- Logging to file has been removed, as it was not completely consistent anyway. Instead you can use a process manager such as PM2 to capture stdout and stderr to file. 

### Benefits

* Open single-file wikis and data folder wikis with a single click.
* Allows you to access your wikis from any computer on the network. 
* Files save and load instantly on the same computer, and quickly across the network.
* Mount any location on your computer (in theory anything NodeJS can stat).

### Features
 - Uses a folder structure specified in settings.json allowing you serve any folders on the filesystem in whatever tree structure you like.
 - Serves all files found in the folder structure.
 - Saves individual files using the put saver.
 - Allows you to upload a file to any directory (but not categories), or create new directories and data folders. 
   - Want to make a new data folder? First create a directory, then upload your `tiddlywiki.info` file to it.
 - Loads data folders using TiddlyWiki then forwards all requests to the listen command. All data folders are mounted on the path they are found at (e.g. `/personal/mydatafolder`)
 - Saves a backup of the original everytime a single-file TiddlyWiki is saved (if a backup folder is specified in the settings file).

## Installation

### Global install using NPM

 - Install TiddlyServer globally using `npm install tiddlyserver -g`. 
 - Create your [config file](https://arlen22.github.io/tiddlyserver/docs/settingsjson).
 - Run `tiddlyserver --config ~/path/to/settings.json`. Additional options are `[--stay-on-error] [--dry-run]`.
 - All paths in the config are relative to the config file. The working directory is not used by TiddlyServer for anything. TiddlyWiki Data Folders do not use the working directory for anything either. 

### Portable install

- Create a new folder and `cd` into the folder or open it in your favorite terminal. 
- Run `npm init -y` to quickly create a package.json file. 
- Run "`npm install tiddlyserver --save-exact`".
  - Notice there is no `-g` option there.
- Create your [config file](https://arlen22.github.io/tiddlyserver/docs/settingsjson).
- Test it by running `npx tiddlyserver --config settings.json`.
- Create your bash or batch file with the following command.
  - "`node node_modules/tiddlyserver/index.js --config settings.json`"
- You can also download the Node executable and put in in the directory for a truly portable install.
  - Windows CMD will use this immediately, but bash and other shells usually require you to change the command `node` to `./node`. 

## How to upgrade

Upgrading is simple. Just follow the installation instructions as usual, then copy your `settings.json` file from your old installation to your new one. If upgrading from 2.0.x to 2.1.x, just use the `example-settings.json` file as your starting point and copy the tree over from your old settings file. 

## Getting started

See the [Getting Started Guide][getting-started-guide] and the [man page][man-page] in
the [docs][docs] directory.

[getting-started-guide]: https://github.com/phlummox-patches/TiddlyServer/blob/v2.2/docs/gettingstarted.md
[man-page]: https://github.com/phlummox-patches/TiddlyServer/blob/v2.2/docs/man-page.md
[docs]: https://github.com/phlummox-patches/TiddlyServer/tree/v2.2/docs

## FAQ

If these do not answer your question, feel free to open an issue or ask on the TiddlyWiki Google Group.

### TiddlyServer throws a Syntax Error on start up

The minimum Node version required is 

- TiddlyServer 2.0: Node v6
- TiddlyServer 2.1: Node v8
- TiddlyServer 2.2: Node v10

## Questions or Comments?
 - Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this app, and your requests will show me where to focus next.
 - If you see a bug, please open an issue describing what is going on and I will try to answer it. Including the console output from the server is very useful to me. The browser console or network request log may contain clues as well. 

## A final thought

If you want to help cover the cost of making this all happen, use https://www.paypal.me/Arlen22. Your help is appreciated and will increase the likelihood of future improvements.
