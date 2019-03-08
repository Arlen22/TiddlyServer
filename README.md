My work on tools related to TiddlyWiki is entirely a side project for me that does not generate any income. If you want to help cover the cost of the time it takes to make these tools, you are welcome to donate at https://www.paypal.me/Arlen22. 

# TiddlyServer 2.1

TiddlyServer takes the server command of TiddlyWiki on NodeJS and adds it to a static file server. This means you can load and serve any TiddlyWiki data folder in the same way you can serve a single file TiddlyWiki. 

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
   - Want to make a new data folder? First create it as a directory, then upload your `tiddlywiki.info` file to it.
 - Loads data folders using TiddlyWiki then forwards all requests to the listen command. All data folders are mounted on the path they are found at (e.g. `/personal/mydatafolder`)
 - Saves a backup of the original everytime a single-file TiddlyWiki is saved (if a backup folder is specified in the settings file).

### TiddlyWiki prior to 5.1.15

> Note: This does not apply to data folders. 
>
> TiddlyWiki5 files currently use the put saver. The put saver URI encodes the document location, which is usually already encoded by the browser, resulting in a 404 error when saving, if the URL contains any characters that get converted to percent codes (such as %20). 
>
> You will need to use the bookmarklet included in the directory pages to fix the saving. The bookmarklet needs to be clicked each time the affected wiki is opened, after which saving should work normally until the page is reloaded. If there are unsaved changes, another change needs to be made to trigger a save.
>
> The updated tiddler is also included as another link and may be dragged into the wiki to import the tiddler normally. After import the wiki will still need to be saved, either by downloading or by using the bookmarklet.
>
> This is a bug in TiddlyWiki, and is fixed in version 5.1.15. 

# The Getting Started Guide

This guide is intended for those who are less techy or who just like more verbose instructions. 

## How to upgrade

Upgrading is simple. Just follow the installation instructions as usual, then copy your `settings.json` file from your old installation to your new one. If upgrading from 2.0, you need to run `node upgrade-settings.json` after you copy it in.

## Where to Start

The first thing you need to do is download and install NodeJS on your computer. If you're on Linux, read the note below this paragraph. If you have never heard of NodeJS and you either don't know what a "command prompt" or "terminal" is or you never use it, then just go to the NodeJS website (https://nodejs.org/en/download/), and download the installer for your operating system. Once it's downloaded, you can just run the downloaded file. 

> LINUX TIP: Most Linux distributions allow Node to be installed using `apt-get` or whatever the equivelant package manager is for your flavor of linux. 

> PRO TIP: TiddlyServer is completely portable, so the only thing required is the node executable. You can just drop the node executable into the folder and then run TiddlyServer by calling `node server.js`.

Once you have NodeJS installed on your computer, the next step is to download TiddlyServer. This can be done by going to https://github.com/Arlen22/TiddlyServer/releases/latest and download the source code zip or tar.gz (whichever you prefer). Once it's downloaded, you can unzip it to wherever you like. 

Now you need to create `settings.json`.

- If you are upgrading, copy your `settings.json` file from your old installation. 
- If you are upgrading from 2.0, you need to run `node upgrade-settings.js` and follow the instructions. 
- Otherwise, create a `settings.json` file with the following content.

```json
{
  //The JSON5 parser allows comments!
  //All relative paths are relative to this file.
  "tree": {
    //this tree is just going to mount one folder
    "$element": "folder",
    "path": "../webroot",
  },
  "bindInfo": {
    //bind to localhost only
    "bindAddress": ["127.0.0.1"] 
  },
  "putsaver": {
    "backupDirectory": "../backups" // or "" to disable backups
  },
  "$schema": "./settings.schema.json"
}
```
## Ready to Run

You have multiple options depending on your operating system.

### Windows

 - Open the start menu (Windows 7 or later) or press Win + R, then enter `cmd` and press enter. Use the `cd` command to navigate to the TiddlyServer directory, then run `node server.js`. 
 - You can also right-click on the TiddlyServer folder while holding down Shift, and click "Open in Command Prompt". Then run `node server.js`.
 - You can also make a copy of the shortcut for NodeJS and then add `server.js` to the target field of the shortcut. Node will look for the `server.js` file in the "start in" directory, so set it to the TiddlyServer directory. 

### Mac OS

Open Terminal and use the `cd` command to navigate to the TiddlyServer directory, then run `node server.js`. 

### Linux

Open the terminal if you aren't already there, then `cd` to the TiddlyServer directory and run `node server.js`. You will need to figure out how to get Node installed on your particular distribution of Linux, but it's pretty simple.

### Android

The easy way to install it on Android is to use Dory (https://play.google.com/store/apps/details?id=io.tempage.dorynode). Open the app, tap the + button on the bottom right, then select "file". Select the TiddlyServer server.js file in your filesystem. If your settings.json file isn't next to the server.js file, paste the full path into the "argument" field (not the "Node option" field). That's basically all there is to it. Save it, then hit back to return to the list of scripts and tap start. Tap stdout to see the terminal output, including any error messages.

The other option is to use Termux. If you have a keyboard attached to your Android, you can basically 
 - Once you enable shared storage inside Termux you can use your regular Android file manager to unzip the TiddlyServer files and then cd to the directory to access them from Termux. 
 - You can install Node on Termux using the built-in package manager. 

### iOS

Sorry, we're still kind of up the creek on this one, but if you can find a way to install Node on iOS, then that's what you need. 

### Anything else

In case you haven't figured it out yet, TiddlyServer's only dependancy is Node itself, so it should run on anything that supports Node. 

## FAQ

If these do not answer your question, feel free to open an issue or ask on the TiddlyWiki Google Group.

### TiddlyServer throws a Syntax Error on start up

Make sure you are running at least Node version 6. This is the minimum supported.

## Questions or Comments?
 - Feature requests! If you have a feature you would like to see, open an issue and I will see what I can do. I see many possibilities with this app, and your requests will show me where to focus next.
 - If you see a bug, please open an issue describing what is going on and I will try to answer it. Including the console output from the server is very useful to me. The browser console or network request log may contain clues as well. 

## A final thought

If you want to help cover the cost of making this all happen, use https://www.paypal.me/Arlen22. Your help is appreciated and will increase the likelihood of future improvements.

# Configuration 

See [SETTINGS](SETTINGS.md) for details on configuring `settings.json`. 

# The History of TiddlyServer

The inspiration for TiddlyServer came from some discussions between several TiddlyWiki developers about a new version of Firefox that was to be released in the middle of 2017. It was a massively rewrite and no longer had some of the features that we needed to be able to save TiddlyWiki files in Firefox. 

I had worked with NodeJS and Apache servers for a few years already and so I got the idea to create a file server that would let you load your wikis from various places on your computer and edit and save them in any browser, not just Firefox. 

Another TiddlyWiki enthusiast (mklauber) had written TiddlyServer 1.x which had the ability to load data folders as separate node instances and proxy them alongside single file wikis. It was based on TiddlyDesktop, but was still running into bugs. This inspired me to try to build a file server which would serve data folders, but without using the somewhat cumbersome and error-prone port proxying of TiddlyServer 1. I had already done this with ExpressJS and liked the result.

With the Firefox 57 Apocolypse looming, I smashed together a working prototype and posted it on the TiddlyWiki Google Group. The response was overwhelmingly positive, and the feedback was very helpful. That's when mklauber and I agreed to call it TiddlyServer 2. So now you know what happened to version 1. 

## Remember

If you want to help cover the cost of making this all happen, use https://www.paypal.me/Arlen22. Your help is appreciated and will increase the likelihood of future improvements.
