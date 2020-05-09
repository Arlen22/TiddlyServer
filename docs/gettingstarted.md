---
id: gettingstarted
title: The Getting Started Guide
---

## Installation

TiddlyServer is published to NPM. This means that you need NodeJS and NPM installed on your computer. 

- On Windows and Mac, download and run the installer from https://nodejs.org/en/download/.
- On Linux, you can usually install the `nodejs` package using your package manager. You may need to run `apt update` to update the package registry. 
- If you're on anything else, you probably know how to do this yourself, and if not, you should be able to Google it. 

### Global install using NPM

 - Install TiddlyServer globally using `npm install tiddlyserver -g`. 
 - Create your [config file](https://arlen22.github.io/tiddlyserver/docs/settingsjson).
 - Run `tiddlyserver --config ~/path/to/settings.json`. 
 - Run `tiddlyserver --help` for additional options.
 - All paths in the config are relative to the config file. The working directory is not used by TiddlyServer for anything. TiddlyWiki Data Folders do not use the working directory for anything either. 

### Portable install

- Create a new folder and `cd` into the folder or open it in your favorite terminal. 
- Run `npm init -y` to quickly create a package.json file. 
- Run "`npm install tiddlyserver --save-exact`".
  - Notice there is no `-g` option there.
- Create the JSON Schema by running `npx tiddlyserver --gen-schema` (notice `npx`, not `npm`). 
- Create your [config file](https://arlen22.github.io/tiddlyserver/docs/settingsjson).
- Test it by running `npx tiddlyserver --config settings.json`.
- Create your bash or batch file with the following command.
  - "`node node_modules/tiddlyserver/index.js --config settings.json`"
- You can also copy the Node executable into the folder for a truly portable install. 
  - Windows CMD will use this immediately, but bash and other shells usually require you to change the command `node` to `./node`. 
- Whenever you want to upgrade to a new version, run `npm install tiddlyserver@latest --save-exact`.
- Copy the entire folder onto your USB drive or wherever you store it. 

## How to upgrade

Upgrading is simple. Just run `npm install -g tiddlyserver@latest`. Remove the `-g` flag if this is a portable install. TiddlyServer always exactly specifies the latest version of TiddlyWiki at the time it is published so this will also update the TiddlyWiki version that TiddlyServer uses. This will not affect your global install of TiddlyWiki, as the files are completely separate. 

## Where to Start

Here's a more detailed version of the above instructions.

The first thing you need to do is download and install NodeJS on your computer. If you're on Linux, read the note below this paragraph. If you have never heard of NodeJS and you either don't know what a "command prompt" or "terminal" is or you never use it, then just go to the NodeJS website (https://nodejs.org/en/download/), and download the installer for your operating system. Once it's downloaded, you can just run the downloaded file. 

> LINUX TIP: Most Linux distributions allow Node to be installed using `apt-get` or whatever the equivelant package manager is for your flavor of linux. The package name is `nodejs`, not `node`, even though the command you type into the console is `node`.

> PRO TIP: TiddlyServer is completely portable, so the only thing required to actually run it is the node executable. See the portable install instructions at the top of this page.

Install TiddlyServer globally using `npm install tiddlyserver@latest -g`. 

Now you need to create `tiddlyserver.json`.

- If you are upgrading from a previous 2.1 version, copy your `settings.json` file from your old installation. 
- If you are upgrading from 2.0, follow the instructions below, but replace the tree property with the one from your old `settings.json` file. 
- Otherwise, create a `tiddlyserver.json` file with the following content.

> I prefer to edit my settings.json file with VS Code, because it uses the `$schema` property to give intellisense hints and descriptions of the various properties available in settings.json. Run `tiddlyserver --gen-schema` in your config file directory to generate the `tiddlyserver-2-2.schema.json` file.

<div style="color: rgb(0, 0, 0); font-family: Menlo, Monaco, &quot;Courier New&quot;, monospace; font-size: 12px; line-height: 18px; white-space: pre; overflow: scroll hidden;"><div>{</div><div>  <span style="color: rgb(0, 128, 0);">//The JSON5 parser allows comments!</span></div><div>  <span style="color: rgb(0, 128, 0);">//All relative paths are relative to this file.</span></div><div>  <span style="color: rgb(0, 128, 0);">//The user directory prefix ~ is allowed.</span></div><br><div>  <span style="color: rgb(0, 128, 0);">//remove one of these</span></div><div>  <span style="color: rgb(4, 81, 165);">"tree"</span>: <span style="color: rgb(163, 21, 21);">"../webroot"</span>, <span style="color: rgb(0, 128, 0);">//this tree is just going to mount a folder as root: ../webroot</span></div><div>  </div><div>  <span style="color: rgb(4, 81, 165);">"tree"</span>: { <span style="color: rgb(0, 128, 0);">//this tree is going to mount a group containing folders and another group</span></div><div>    <span style="color: rgb(4, 81, 165);">"myfolder"</span>: <span style="color: rgb(163, 21, 21);">"../personal"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"workstuff"</span>: <span style="color: rgb(163, 21, 21);">"../work"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"user"</span>: <span style="color: rgb(163, 21, 21);">"~/Desktop/random"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"projects_group"</span>: {</div><div>      <span style="color: rgb(4, 81, 165);">"<span zeum4c32="PR_3_0" data-ddnwab="PR_3_0" data-wpkgv="true">tiddlyserver</span>"</span>: <span style="color: rgb(163, 21, 21);">"~/Desktop/Github/TiddlyServer"</span>,</div><div>      <span style="color: rgb(4, 81, 165);">"material-theme"</span>: <span style="color: rgb(163, 21, 21);">"~/Dropbox/Material Theme"</span></div><div>    }</div><div>  },</div><br><div>  <span style="color: rgb(4, 81, 165);">"bindInfo"</span>: {</div><div>    <span style="color: rgb(0, 128, 0);">// V V V V Uncomment one of the following V V V V </span></div><br><div>    <span style="color: rgb(0, 128, 0);">//bind to localhost only (you can specify any other ip address in this array, and it will bind to all available addresses)</span></div><div>    <span style="color: rgb(0, 128, 0);">// "bindAddress": ["127.0.0.1"],</span></div><br><div>    <span style="color: rgb(0, 128, 0);">//bind to 0.0.0.0</span></div><div>    <span style="color: rgb(0, 128, 0);">// "bindWildcard": true</span></div><br><div>    <span style="color: rgb(0, 128, 0);">//workaround for android devices (bind to all available private ip addresses on startup)</span></div><div>    <span style="color: rgb(0, 128, 0);">// "bindWildcard": false, "bindAddress": ["192.168.0.0/16", "10.0.0.0/8", "172.31.0.0/16"], "filterBindAddress": true,</span></div><div>  },</div><div>  <span style="color: rgb(4, 81, 165);">"putsaver"</span>: {</div><div>    <span style="color: rgb(0, 128, 0);">//single file wikis will backup to this directory on every save</span></div><div>    <span style="color: rgb(4, 81, 165);">"backupFolder"</span>: <span style="color: rgb(163, 21, 21);">"./backups"</span> <span style="color: rgb(0, 128, 0);">// comment out or set to "" to disable backups</span></div><div>  },</div><div>  <span style="color: rgb(4, 81, 165);">"$schema"</span>: <span style="color: rgb(163, 21, 21);">"./tiddlyserver-2-2.schema.json"</span></div><div>}</div></div>

Uncomment one of the lines in `bindInfo` according to your use case. The bindAddress array may be set to any IP addresses desired.

Remove one of the tree properties, according to your use case. Be sure to create the appropriate folders on your hard-drive if they do not already exist. No error will be thrown in the server if a path does not exist, but it will have an error icon in the directory listing and will return 404 if accessed by the client. 

Create a `backups` folder _beside_ your `tiddlyserver.json` file. 

Please refer to [ServerConfig](ServerConfig.md) for more information.

## Ready to Run

You have multiple options depending on your operating system.

### Windows, Mac OS, and Linux

Open the terminal or command prompt and run `tiddlyserver --config path/to/settings.json`

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
