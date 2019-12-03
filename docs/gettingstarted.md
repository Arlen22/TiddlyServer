---
id: gettingstarted
title: The Getting Started Guide
---

## Short instructions

 - Install or download NodeJS v8+. Only the Node binary is required, nothing else. 
 - [Download TiddlyServer source code](https://github.com/Arlen22/TiddlyServer/releases/latest) and unzip it to an empty directory so you don't merge with an existing directory. You do not need to run any build commands. 
 - Create your settings.json file and put it in the TiddlyServer folder or specify it as the first argument to `server.js`. If you don't know what goes in settings.json, follow the guide below "Where to Start".
 - Run `node server.js [/path/to/settings.json] [--stay-on-error] [--dry-run]`
 - The working directory is not used by TiddlyServer except for locating the settings file if specified. Otherwise it expects to find it in the TiddlyServer folder with the server.js file. All other paths are relative to the settings file. This does not apply inside the TiddlyWiki data folder environment, but TiddyWiki does not normally use it either because it uses the data folder path and the boot.js path as its reference paths. 

## How to upgrade

Upgrading is simple. Just follow the installation instructions as usual, then copy your `settings.json` file from your old installation to your new one. If upgrading from 2.0.x to 2.1.x, things are a little different. Use the `example-settings.json` or `example-settings-quick.json` files and then copy the tree property over from your old file. 

## Where to Start

This guide is intended for those who like more verbose instructions or if this is your first time setting up TiddlyServer. 

The first thing you need to do is download and install NodeJS on your computer. If you're on Linux, read the note below this paragraph. If you have never heard of NodeJS and you either don't know what a "command prompt" or "terminal" is or you never use it, then just go to the NodeJS website (https://nodejs.org/en/download/), and download the installer for your operating system. Once it's downloaded, you can just run the downloaded file. 

> LINUX TIP: Most Linux distributions allow Node to be installed using `apt-get` or whatever the equivelant package manager is for your flavor of linux. 

> PRO TIP: TiddlyServer is completely portable, so the only thing required is the node executable. You can just drop the node executable into the folder and then run TiddlyServer by calling `node server.js`.

Once you have NodeJS installed on your computer, the next step is to download TiddlyServer. This can be done by going to https://github.com/Arlen22/TiddlyServer/releases/latest and download the source code zip or tar.gz (whichever you prefer). Once it's downloaded, you can unzip it to wherever you like. 

Now you need to create `settings.json`.

- If you are upgrading from a previous 2.1 version, copy your `settings.json` file from your old installation. 
- If you are upgrading from 2.0, follow the instructions below, but replace the tree property with the one from your old `settings.json` file. 
- Otherwise, create a `settings.json` file with the following content (or run `cat example-settings.json >> settings.json` then edit the file as desired). 
> The double `>>` will append `example-settings.json` to `settings.json` so if there is somehow a `settings.json` there already it should not get overwritten. 

> You can also use `example-settings-quick.json` for a very quick way to get started without all the comments. 

> I prefer to edit my settings.json file with VS Code, because it uses the `$schema` to give intellisense hints and descriptions of the various properties available in settings.json. 

<div style="color: rgb(0, 0, 0); font-family: Menlo, Monaco, &quot;Courier New&quot;, monospace; font-size: 12px; line-height: 18px; white-space: pre; overflow: scroll hidden;"><div>{</div><div>  <span style="color: rgb(0, 128, 0);">//The JSON5 parser allows comments!</span></div><div>  <span style="color: rgb(0, 128, 0);">//All relative paths are relative to this file.</span></div><div>  <span style="color: rgb(0, 128, 0);">//The user directory prefix ~ is allowed.</span></div><br><div>  <span style="color: rgb(0, 128, 0);">//remove one of these</span></div><div>  <span style="color: rgb(4, 81, 165);">"tree"</span>: <span style="color: rgb(163, 21, 21);">"../webroot"</span>, <span style="color: rgb(0, 128, 0);">//this tree is just going to mount a folder as root: ../webroot</span></div><div>  </div><div>  <span style="color: rgb(4, 81, 165);">"tree"</span>: { <span style="color: rgb(0, 128, 0);">//this tree is going to mount a group containing folders and another group</span></div><div>    <span style="color: rgb(4, 81, 165);">"myfolder"</span>: <span style="color: rgb(163, 21, 21);">"../personal"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"workstuff"</span>: <span style="color: rgb(163, 21, 21);">"../work"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"user"</span>: <span style="color: rgb(163, 21, 21);">"~/Desktop/random"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"projects_group"</span>: {</div><div>      <span style="color: rgb(4, 81, 165);">"tiddlyserver"</span>: <span style="color: rgb(163, 21, 21);">"~/Desktop/Github/TiddlyServer"</span>,</div><div>      <span style="color: rgb(4, 81, 165);">"material-theme"</span>: <span style="color: rgb(163, 21, 21);">"~/Dropbox/Material Theme"</span></div><div>    }</div><div>  },</div><br><div>  <span style="color: rgb(4, 81, 165);">"bindInfo"</span>: {</div><div>    <span style="color: rgb(0, 128, 0);">// V V V V Uncomment one of the following V V V V </span></div><br><div>    <span style="color: rgb(0, 128, 0);">//bind to localhost only (you can specify any other ip address in this array, and it will bind to all available addresses)</span></div><div>    <span style="color: rgb(0, 128, 0);">// "bindAddress": ["127.0.0.1"],</span></div><br><div>    <span style="color: rgb(0, 128, 0);">//bind to 0.0.0.0</span></div><div>    <span style="color: rgb(0, 128, 0);">// "bindWildcard": true</span></div><br><div>    <span style="color: rgb(0, 128, 0);">//workaround for android devices (bind to all available private ip addresses on startup)</span></div><div>    <span style="color: rgb(0, 128, 0);">// "bindWildcard": false, "bindAddress": ["192.168.0.0/16", "10.0.0.0/8", "172.31.0.0/16"], "filterBindAddress": true,</span></div><div>  },</div><div>  <span style="color: rgb(4, 81, 165);">"putsaver"</span>: {</div><div>    <span style="color: rgb(0, 128, 0);">//single file wikis will backup to this directory on every save</span></div><div>    <span style="color: rgb(4, 81, 165);">"backupFolder"</span>: <span style="color: rgb(163, 21, 21);">"../backups"</span> <span style="color: rgb(0, 128, 0);">// comment out or set to "" to disable backups</span></div><div>  },</div><div>  <span style="color: rgb(4, 81, 165);">"$schema"</span>: <span style="color: rgb(163, 21, 21);">"./settings-2-1.schema.json"</span></div><div>}</div></div>

Uncomment one of the lines in `bindInfo` according to your use case. The bindAddress array may be set to any IP addresses desired.

Remove one of the tree properties, according to your use case. Be sure to create the appropriate folders on your hard-drive if they do not already exist. No error will be thrown in the server if a path does not exist, but it will have an error icon in the directory listing and will return 404 if accessed by the client. 

Create a `backups` folder _beside_ the TiddlyServer folder unless you set a different path for the `putsaver.backupFolder` property.


Please refer to [settings.json](SettingsJson.md) and [ServerConfig](ServerConfig.md) for more information.

## Ready to Run

You have multiple options depending on your operating system.

### Windows

 - Open the start menu (Windows 7 or later) or press Win + R, then enter `cmd` and press enter. Use the `cd` command to navigate to the TiddlyServer directory, then run `node server.js`. 
 - You can also right-click on the TiddlyServer folder while holding down Shift, and click "Open in Command Prompt". Then run `node server.js`.
 - You can also make a copy of the shortcut for NodeJS and then add `server.js` to the target field of the shortcut. Node will look for the `server.js` file in the "start in" directory, so set it to the TiddlyServer directory. You can also specify the absolute path of `server.js`. The "start in" directory (aka 'cwd') has no affect on TiddlyServer itself.

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

Sorry, we're still kind of up the creek on this one, but if you can find a way to run Node on iOS, then that's what you need. 

### Anything else

In case you haven't figured it out yet, TiddlyServer's only dependancy is Node itself, so it should run on anything that supports Node. 

## TiddlyWiki prior to 5.1.15

> Note: This does not apply to data folders. 
>
> TiddlyWiki5 files currently use the put saver. The put saver URI encodes the document location, which is usually already encoded by the browser, resulting in a 404 error when saving, if the URL contains any characters that get converted to percent codes (such as %20). 
>
> You will need to use the bookmarklet included in the directory pages to fix the saving. The bookmarklet needs to be clicked each time the affected wiki is opened, after which saving should work normally until the page is reloaded. If there are unsaved changes, another change needs to be made to trigger a save.
>
> The updated tiddler is also included as another link and may be dragged into the wiki to import the tiddler normally. After import, the wiki will still need to be saved, either by downloading or by using the bookmarklet.
>
> This is a bug in TiddlyWiki, and is fixed in version 5.1.15. 
