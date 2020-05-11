//@ts-check
/*\
title: $:/plugins/tiddlywiki/filesystem/filesystemadaptor.js
type: application/javascript
module-type: syncadaptor

A sync adaptor module for synchronising with the local filesystem via node.js APIs

\*/
// (function () {

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// Get a reference to the file system
var fs = require("fs"),
  path = require("path");

/** @constructor */
function FileSystemAdaptor(options) {
  this.wiki = options.wiki;
  // this.logger = new this.utils.Logger("filesystem",{colour: "blue"});
  this.files = options.files;
  this.wikiTiddlersPath = options.wikiTiddlersPath;
  this.utils = options.utils;
  this.utils.createDirectory(this.wikiTiddlersPath);
}

FileSystemAdaptor.prototype.name = "filesystem";

FileSystemAdaptor.prototype.supportsLazyLoading = false;

FileSystemAdaptor.prototype.isReady = function () {
  // The file system adaptor is always ready
  return true;
};

FileSystemAdaptor.prototype.getTiddlerInfo = function (tiddler) {
  return {};
};

/*
Return a fileInfo object for a tiddler, creating it if necessary:
  filepath: the absolute path to the file containing the tiddler
  type: the type of the tiddler file (NOT the type of the tiddler -- see below)
  hasMetaFile: true if the file also has a companion .meta file
 
The boot process populates $tw.boot.files for each of the tiddler files that it loads. The type is found by looking up the extension in $tw.config.fileExtensionInfo (eg "application/x-tiddler" for ".tid" files).
 
It is the responsibility of the filesystem adaptor to update $tw.boot.files for new files that are created.
*/
FileSystemAdaptor.prototype.getTiddlerFileInfo = function (tiddler, callback) {
  // See if we've already got information about this file
  var title = tiddler.fields.title,
    fileInfo = this.files[title];
  if (!fileInfo) {
    // Otherwise, we'll need to generate it
    fileInfo = this.utils.generateTiddlerFileInfo(tiddler, {
      directory: this.wikiTiddlersPath,
      pathFilters: this.wiki.getTiddlerText("$:/config/FileSystemPaths", "").split("\n"),
      wiki: this.wiki
    });
    this.files[title] = fileInfo;
  }
  callback(null, fileInfo);
};


/*
Save a tiddler and invoke the callback with (err,adaptorInfo,revision)
*/
FileSystemAdaptor.prototype.saveTiddler = function (tiddler, callback) {
  // var self = this;
  this.getTiddlerFileInfo(tiddler, (err, fileInfo) => {
    if (err) {
      return callback(err);
    }
    this.utils.saveTiddlerToFile(tiddler, fileInfo, callback);
  });
};

/*
Load a tiddler and invoke the callback with (err,tiddlerFields)
 
We don't need to implement loading for the file system adaptor, because all the tiddler files will have been loaded during the boot process.
*/
FileSystemAdaptor.prototype.loadTiddler = function (title, callback) {
  callback(null, null);
};

/*
Delete a tiddler and invoke the callback with (err)
*/
FileSystemAdaptor.prototype.deleteTiddler = function (title, callback, options) {
  var fileInfo = this.files[title];
  // Only delete the tiddler if we have writable information for the file
  if (fileInfo) {
    // Delete the file
    fs.unlink(fileInfo.filepath, (err) => {
      if (err) {
        return callback(err);
      }
      // Delete the metafile if present
      if (fileInfo.hasMetaFile) {
        fs.unlink(fileInfo.filepath + ".meta", (err) => {
          if (err) {
            return callback(err);
          }
          return this.utils.deleteEmptyDirs(path.dirname(fileInfo.filepath), callback);
        });
      } else {
        return this.utils.deleteEmptyDirs(path.dirname(fileInfo.filepath), callback);
      }
    });
  } else {
    callback(null);
  }
};

if (fs) {
  exports.FileSystemAdaptor = FileSystemAdaptor;
}

// })();
