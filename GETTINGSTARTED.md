# The Getting Started Guide

This guide is intended for those who are less techy or who just like more verbose instructions. 

## Where to Start

The first thing you need to do is download and install NodeJS on your computer. If you're on Linux, read the note below this paragraph. If you have never heard of NodeJS and you either don't know what a "command prompt" or "terminal" is or you never use it, then just go to the NodeJS website (https://nodejs.org/en/download/), and download the installer for your operating system. Once it's downloaded, you can just run the downloaded file. 

> LINUX TIP: Most Linux distributions allow Node to be installed using `apt-get` or whatever the equivelant package manager is for your flavor of linux. 

> PRO TIP: TiddlyServer is completely portable, so the only thing required is the node executable. You can just drop the node executable into the folder and then run TiddlyServer by calling `node server.js`.

Once you have NodeJS installed on your computer, the next step is to download TiddlyServer. This can be done by going to https://github.com/Arlen22/TiddlyServer/releases/latest and download the source code zip or tar.gz (whichever you prefer). Once it's downloaded, you can unzip it to wherever you like. 

Copy the `example-settings-simple.json` file and name it `settings.json`. 

There are two keys in the JSON file that need to be set. The one is `backupDirectory`, which either needs to be created next to `settings.json` or the key needs to be set to an existing path. The other is `tree`, which needs to be set according to the folders you want to serve. 

## Ready to Run

You have multiple options depending on your operating system.

### Windows

 - Open the start menu (Windows 7 or later) or press Win + R, then enter `cmd` and press enter. Use the `cd` command to navigate to the TiddlyServer directory, then run `node server.js`. 
 - You can also right-click on the TiddlyServer folder while holding down Shift, and click "Open in Command Prompt". Then run `node server.js`.
 - You can also make a copy of the shortcut for NodeJS and then add `server.js` to the target field of the shortcut. Node will look for the `server.js` file in the "start in" directory, so set it to the TiddlyServer directory. 

### Mac OS

I don't have a Mac, but you should be able to easily find documentation online for using NodeJS on Mac. The relevent command is, of course, `node server.js`.

### Linux

Open the terminal if you aren't already there, then `cd` to the TiddlyServer directory and run `node server.js`. 

### Android

If you want to install it on Android, I recommend using the Termux app. Once you enable shared storage you can use your file manager to unzip the TiddlyServer files and then access them from Termux. You can install Node on Termux using the built-in package manager. 

### iOS

Sorry, we're still kind of up the creek on this one, but if you can find a way to install Node on iOS, then that's what you need. 

### Anything else

In case you haven't figured it out yet, TiddlyServer's only dependancy is Node itself, so it should run on anything that supports Node. 

## Configuration 

See [SETTINGS](SETTINGS.md) for details on configuring `settings.json`. 

## The History of TiddlyServer

The inspiration for TiddlyServer came from some discussions between sevaral TiddlyWiki developers about a new version of Firefox that was to be released in the middle of 2017. It was a massively rewrite and no longer had some of the features that we needed to be able to save TiddlyWiki files in Firefox. 

I had worked with NodeJS and Apache servers for a few years already and so I got the idea to create a file server that would let you load your wikis from various places on your computer and edit and save them in any browser, not just Firefox. 

Another TiddlyWiki enthusiast had written a TiddlyServer 1.x which had the ability to load data folders as separate node instances and proxy them alongside single file wikis. It was based on TiddlyDesktop, but was still running into bugs. This inspired me to try to build a file server which would serve data folders, but without using the somewhat cumbersome and error-prone port proxying of TiddlyServer 1. I had already done this with ExpressJS and liked the result.

With the Firefox 57 Apocolypse looming, I smashed together a working prototype and posted it on the TiddlyWiki Google Group. The response was overwhelmingly positive, and the feedback was very helpful. That's when mklauber and I agreed to call it TiddlyServer 2. So now you know what happened to version 1. 


