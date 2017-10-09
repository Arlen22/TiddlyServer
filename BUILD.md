## Build Instructions

The root folder is the repository folder.

### Bundle

The TiddlyWiki bundle contains all the parts required to run as a dependancy. The `editions` folder is not required and so is not included. The core is actually a plugin, and so is bundled the same as all the other plugins. `tiddlywiki.js` is optional.

### Mac OS X

We're still working on this one.

1. Download the latest node v6 binary from nodejs.org and put in root folder.
2. Rename the root folder `Contents` and drop into a folder named Tiddlyserver.app.

The supporting launch files are in the MacOS folder and will kick in once they are in this folder hierarchy. 

### Windows

For now, it would just be download the correct executable and drop it into the root folder.

## Nexe

Eventually I hope to have nexe builds available, but right now TiddlyWiki has trouble, so I still need to investigate. 