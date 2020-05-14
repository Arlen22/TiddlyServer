import * as path from "path";
import * as fs from "fs";
import { FileSystemLoaderOuter, Wiki } from './types';

type $tw = {

}

export const factoryFileSystemLoader: ($tw: $tw) => typeof FileSystemLoaderOuter = ($tw) => factory($tw);

function factory($tw) {

  class FileSystemLoaderInner {
    wiki: any;
    extraPlugins: any[];
    constructor(wiki: Wiki, extraPlugins: any[]) {
      this.wiki = wiki;
      this.extraPlugins = extraPlugins;
    }
    /*
    Load the tiddlers contained in a particular file (and optionally extract fields from the accompanying .meta file) returned as {filepath:,type:,tiddlers:[],hasMetaFile:}
    */
    loadTiddlersFromFile(filepath, fields) {
      var ext = path.extname(filepath), extensionInfo = $tw.utils.getFileExtensionInfo(ext), type = extensionInfo ? extensionInfo.type : null, typeInfo = type ? $tw.config.contentTypeInfo[type] : null, data = fs.readFileSync(filepath, typeInfo ? typeInfo.encoding : "utf8"), tiddlers = this.wiki.deserializeTiddlers(ext, data, fields), metadata = this.loadMetadataForFile(filepath);
      if (metadata) {
        if (type === "application/json") {
          tiddlers = [{ text: data, type: "application/json" }];
        }
        tiddlers = [$tw.utils.extend({}, tiddlers[0], metadata)];
      }
      return { filepath: filepath, type: type, tiddlers: tiddlers, hasMetaFile: !!metadata };
    }
    /*
      Load the metadata fields in the .meta file corresponding to a particular file
      */
    loadMetadataForFile(filepath) {
      var metafilename = filepath + ".meta";
      if (fs.existsSync(metafilename)) {
        return $tw.utils.parseFields(fs.readFileSync(metafilename, "utf8") || "");
      }
      else {
        return null;
      }
    }
    /*
      Load all the tiddlers recursively from a directory, including honouring `tiddlywiki.files` files for drawing in external files. Returns an array of {filepath:,type:,tiddlers: [{..fields...}],hasMetaFile:}. Note that no file information is returned for externally loaded tiddlers, just the `tiddlers` property.
      */
    loadTiddlersFromPath(filepath, excludeRegExp?) {
      excludeRegExp = excludeRegExp || $tw.boot.excludeRegExp;
      var self = this, tiddlers: any[] = [];
      if (fs.existsSync(filepath)) {
        var stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
          var files = fs.readdirSync(filepath);
          // Look for a tiddlywiki.files file
          if (files.indexOf("tiddlywiki.files") !== -1) {
            Array.prototype.push.apply(tiddlers, self.loadTiddlersFromSpecification(filepath, excludeRegExp));
          }
          else {
            // If not, read all the files in the directory
            $tw.utils.each(files, function (file) {
              if (!excludeRegExp.test(file) && file !== "plugin.info") {
                tiddlers.push.apply(tiddlers, self.loadTiddlersFromPath(filepath + path.sep + file, excludeRegExp));
              }
            });
          }
        }
        else if (stat.isFile()) {
          tiddlers.push(self.loadTiddlersFromFile(filepath, { title: filepath }));
        }
      }
      return tiddlers;
    }
    /*
      Load all the tiddlers defined by a `tiddlywiki.files` specification file
      filepath: pathname of the directory containing the specification file
      */
    loadTiddlersFromSpecification(filepath, excludeRegExp) {
      var self = this, tiddlers: any[] = [];
      // Read the specification
      var filesInfo = JSON.parse(fs.readFileSync(filepath + path.sep + "tiddlywiki.files", "utf8"));
      // Helper to process a file
      var processFile = function (filename, isTiddlerFile, fields) {
        var extInfo = $tw.config.fileExtensionInfo[path.extname(filename)], type = (extInfo || {}).type || fields.type || "text/plain", typeInfo = $tw.config.contentTypeInfo[type] || {}, pathname = path.resolve(filepath, filename), text = fs.readFileSync(pathname, typeInfo.encoding || "utf8"), metadata = self.loadMetadataForFile(pathname) || {}, fileTiddlers;
        if (isTiddlerFile) {
          fileTiddlers = self.wiki.deserializeTiddlers(path.extname(pathname), text, metadata) || [];
        }
        else {
          fileTiddlers = [$tw.utils.extend({ text: text }, metadata)];
        }
        var combinedFields = $tw.utils.extend({}, fields, metadata);
        $tw.utils.each(fileTiddlers, function (tiddler) {
          $tw.utils.each(combinedFields, function (fieldInfo, name) {
            if (typeof fieldInfo === "string" || $tw.utils.isArray(fieldInfo)) {
              tiddler[name] = fieldInfo;
            }
            else {
              var value = tiddler[name];
              switch (fieldInfo.source) {
                case "filename":
                  value = path.basename(filename);
                  break;
                case "filename-uri-decoded":
                  value = decodeURIComponent(path.basename(filename));
                  break;
                case "basename":
                  value = path.basename(filename, path.extname(filename));
                  break;
                case "basename-uri-decoded":
                  value = decodeURIComponent(path.basename(filename, path.extname(filename)));
                  break;
                case "extname":
                  value = path.extname(filename);
                  break;
                case "created":
                  value = new Date(fs.statSync(pathname).birthtime);
                  break;
                case "modified":
                  value = new Date(fs.statSync(pathname).mtime);
                  break;
              }
              if (fieldInfo.prefix) {
                value = fieldInfo.prefix + value;
              }
              if (fieldInfo.suffix) {
                value = value + fieldInfo.suffix;
              }
              tiddler[name] = value;
            }
          });
        });
        tiddlers.push({ tiddlers: fileTiddlers });
      };
      // Process the listed tiddlers
      $tw.utils.each(filesInfo.tiddlers, function (tidInfo) {
        if (tidInfo.prefix && tidInfo.suffix) {
          tidInfo.fields.text = { prefix: tidInfo.prefix, suffix: tidInfo.suffix };
        }
        else if (tidInfo.prefix) {
          tidInfo.fields.text = { prefix: tidInfo.prefix };
        }
        else if (tidInfo.suffix) {
          tidInfo.fields.text = { suffix: tidInfo.suffix };
        }
        processFile(tidInfo.file, tidInfo.isTiddlerFile, tidInfo.fields);
      });
      // Process any listed directories
      $tw.utils.each(filesInfo.directories, function (dirSpec) {
        // Read literal directories directly
        if (typeof dirSpec === "string") {
          var pathname = path.resolve(filepath, dirSpec);
          if (fs.existsSync(pathname) && fs.statSync(pathname).isDirectory()) {
            tiddlers.push.apply(tiddlers, self.loadTiddlersFromPath(pathname, excludeRegExp));
          }
        }
        else {
          // Process directory specifier
          var dirPath = path.resolve(filepath, dirSpec.path), files = fs.readdirSync(dirPath), fileRegExp = new RegExp(dirSpec.filesRegExp || "^.*$"), metaRegExp = /^.*\.meta$/;
          for (var t = 0; t < files.length; t++) {
            var filename = files[t];
            if (filename !== "tiddlywiki.files" && !metaRegExp.test(filename) && fileRegExp.test(filename)) {
              processFile(dirPath + path.sep + filename, dirSpec.isTiddlerFile, dirSpec.fields);
            }
          }
        }
      });
      return tiddlers;
    }
    /*
      Load the tiddlers from a plugin folder, and package them up into a proper JSON plugin tiddler
      */
    loadPluginFolder(filepath, excludeRegExp?) {
      excludeRegExp = excludeRegExp || $tw.boot.excludeRegExp;
      var self = this;
      var infoPath = filepath + path.sep + "plugin.info";
      if (fs.existsSync(filepath) && fs.statSync(filepath).isDirectory()) {
        // Read the plugin information
        if (!fs.existsSync(infoPath) || !fs.statSync(infoPath).isFile()) {
          console.log("Warning: missing plugin.info file in " + filepath);
          return null;
        }
        var pluginInfo = JSON.parse(fs.readFileSync(infoPath, "utf8"));
        // Read the plugin files
        var pluginFiles = self.loadTiddlersFromPath(filepath, excludeRegExp);
        // Save the plugin tiddlers into the plugin info
        pluginInfo.tiddlers = pluginInfo.tiddlers || Object.create(null);
        for (var f = 0; f < pluginFiles.length; f++) {
          var tiddlers = pluginFiles[f].tiddlers;
          for (var t = 0; t < tiddlers.length; t++) {
            var tiddler = tiddlers[t];
            if (tiddler.title) {
              pluginInfo.tiddlers[tiddler.title] = tiddler;
            }
          }
        }
        // Give the plugin the same version number as the core if it doesn't have one
        if (!("version" in pluginInfo)) {
          pluginInfo.version = $tw.packageInfo.version;
        }
        // Use "plugin" as the plugin-type if we don't have one
        if (!("plugin-type" in pluginInfo)) {
          pluginInfo["plugin-type"] = "plugin";
        }
        pluginInfo.dependents = pluginInfo.dependents || [];
        pluginInfo.type = "application/json";
        // Set plugin text
        pluginInfo.text = JSON.stringify({ tiddlers: pluginInfo.tiddlers }, null, 4);
        delete pluginInfo.tiddlers;
        // Deserialise array fields (currently required for the dependents field)
        for (var field in pluginInfo) {
          if ($tw.utils.isArray(pluginInfo[field])) {
            pluginInfo[field] = $tw.utils.stringifyList(pluginInfo[field]);
          }
        }
        return pluginInfo;
      }
      else {
        return null;
      }
    }
    /*
      name: Name of the plugin to find
      paths: array of file paths to search for it
      Returns the path of the plugin folder
      */
    findLibraryItem(name, paths) {
      var pathIndex = 0;
      do {
        var pluginPath = path.resolve(paths[pathIndex], "./" + name);
        if (fs.existsSync(pluginPath) && fs.statSync(pluginPath).isDirectory()) {
          return pluginPath;
        }
      } while (++pathIndex < paths.length);
      return null;
    }
    /*
      name: Name of the plugin to load
      paths: array of file paths to search for it
      */
    loadPlugin(name, paths) {
      var pluginPath = this.findLibraryItem(name, paths);
      if (pluginPath) {
        var pluginFields = this.loadPluginFolder(pluginPath);
        if (pluginFields) {
          this.wiki.addTiddler(pluginFields);
          return;
        }
      }
      console.log("Warning: Cannot find plugin '" + name + "'");
    }
    /*
      libraryPath: Path of library folder for these plugins (relative to core path)
      envVar: Environment variable name for these plugins
      Returns an array of search paths
      */
    getLibraryItemSearchPaths(libraryPath, envVar) {
      var pluginPaths = [path.resolve($tw.boot.corePath, libraryPath)], env = process.env[envVar];
      if (env) {
        env.split(path.delimiter).map(function (item) {
          if (item) {
            pluginPaths.push(item);
          }
        });
      }
      return pluginPaths;
    }
    /*
      plugins: Array of names of plugins (eg, "tiddlywiki/filesystemadaptor")
      libraryPath: Path of library folder for these plugins (relative to core path)
      envVar: Environment variable name for these plugins
      */
    loadPlugins(plugins, libraryPath, envVar) {
      if (plugins) {
        var pluginPaths = this.getLibraryItemSearchPaths(libraryPath, envVar);
        for (var t = 0; t < plugins.length; t++) {
          this.loadPlugin(plugins[t], pluginPaths);
        }
      }
    }
    /*
      path: path of wiki directory
      options:
        parentPaths: array of parent paths that we mustn't recurse into
        readOnly: true if the tiddler file paths should not be retained
      */
    loadWikiTiddlers(wikiPath, options?) {
      options = options || {};
      var self = this, parentPaths = options.parentPaths || [], wikiInfoPath = path.resolve(wikiPath, $tw.config.wikiInfo), wikiInfo, pluginFields;
      // Bail if we don't have a wiki info file
      if (fs.existsSync(wikiInfoPath)) {
        wikiInfo = JSON.parse(fs.readFileSync(wikiInfoPath, "utf8"));
      }
      else {
        return null;
      }
      // Load any parent wikis
      if (wikiInfo.includeWikis) {
        parentPaths = parentPaths.slice(0);
        parentPaths.push(wikiPath);
        $tw.utils.each(wikiInfo.includeWikis, function (info) {
          if (typeof info === "string") {
            info = { path: info };
          }
          var resolvedIncludedWikiPath = path.resolve(wikiPath, info.path);
          if (parentPaths.indexOf(resolvedIncludedWikiPath) === -1) {
            var subWikiInfo = self.loadWikiTiddlers(resolvedIncludedWikiPath, {
              parentPaths: parentPaths,
              readOnly: info["read-only"]
            });
            // Merge the build targets
            wikiInfo.build = $tw.utils.extend([], subWikiInfo.build, wikiInfo.build);
          }
          else {
            $tw.utils.error("Cannot recursively include wiki " + resolvedIncludedWikiPath);
          }
        });
      }
      // Load any plugins, themes and languages listed in the wiki info file
      self.loadPlugins(wikiInfo.plugins, $tw.config.pluginsPath, $tw.config.pluginsEnvVar);
      self.loadPlugins(wikiInfo.themes, $tw.config.themesPath, $tw.config.themesEnvVar);
      self.loadPlugins(wikiInfo.languages, $tw.config.languagesPath, $tw.config.languagesEnvVar);
      // Load the wiki files, registering them as writable
      var resolvedWikiPath = path.resolve(wikiPath, $tw.config.wikiTiddlersSubDir);
      $tw.utils.each(self.loadTiddlersFromPath(resolvedWikiPath), function (tiddlerFile) {
        if (!options.readOnly && tiddlerFile.filepath) {
          $tw.utils.each(tiddlerFile.tiddlers, function (tiddler) {
            self.wiki.files[tiddler.title] = {
              filepath: tiddlerFile.filepath,
              type: tiddlerFile.type,
              hasMetaFile: tiddlerFile.hasMetaFile
            };
          });
        }
        self.wiki.addTiddlers(tiddlerFile.tiddlers);
      });
      // Save the original tiddler file locations if requested
      var config = wikiInfo.config || {};
      if (config["retain-original-tiddler-path"]) {
        var output = {}, relativePath;
        for (var title in self.wiki.files) {
          relativePath = path.relative(resolvedWikiPath, self.wiki.files[title].filepath);
          output[title] =
            path.sep === "/" ?
              relativePath :
              relativePath.split(path.sep).join("/");
        }
        self.wiki.addTiddler({ title: "$:/config/OriginalTiddlerPaths", type: "application/json", text: JSON.stringify(output) });
      }
      // Save the path to the tiddlers folder for the filesystemadaptor
      self.wiki.wikiTiddlersPath = path.resolve(self.wiki.wikiPath, config["default-tiddler-location"] || $tw.config.wikiTiddlersSubDir);
      // Load any plugins within the wiki folder
      var wikiPluginsPath = path.resolve(wikiPath, $tw.config.wikiPluginsSubDir);
      if (fs.existsSync(wikiPluginsPath)) {
        var pluginFolders = fs.readdirSync(wikiPluginsPath);
        for (var t = 0; t < pluginFolders.length; t++) {
          pluginFields = self.loadPluginFolder(path.resolve(wikiPluginsPath, "./" + pluginFolders[t]));
          if (pluginFields) {
            self.wiki.addTiddler(pluginFields);
          }
        }
      }
      // Load any themes within the wiki folder
      var wikiThemesPath = path.resolve(wikiPath, $tw.config.wikiThemesSubDir);
      if (fs.existsSync(wikiThemesPath)) {
        var themeFolders = fs.readdirSync(wikiThemesPath);
        for (var t = 0; t < themeFolders.length; t++) {
          pluginFields = self.loadPluginFolder(path.resolve(wikiThemesPath, "./" + themeFolders[t]));
          if (pluginFields) {
            self.wiki.addTiddler(pluginFields);
          }
        }
      }
      // Load any languages within the wiki folder
      var wikiLanguagesPath = path.resolve(wikiPath, $tw.config.wikiLanguagesSubDir);
      if (fs.existsSync(wikiLanguagesPath)) {
        var languageFolders = fs.readdirSync(wikiLanguagesPath);
        for (var t = 0; t < languageFolders.length; t++) {
          pluginFields = self.loadPluginFolder(path.resolve(wikiLanguagesPath, "./" + languageFolders[t]));
          if (pluginFields) {
            self.wiki.addTiddler(pluginFields);
          }
        }
      }
      return wikiInfo;
    }
    loadTiddlersNode() {
      var self = this;
      // Load the boot tiddlers
      $tw.utils.each(self.loadTiddlersFromPath($tw.boot.bootPath), function (tiddlerFile) {
        self.wiki.addTiddlers(tiddlerFile.tiddlers);
      });
      // Load the core tiddlers
      self.wiki.addTiddler(self.loadPluginFolder($tw.boot.corePath));
      // Load any extra plugins
      $tw.utils.each(self.extraPlugins, function (name) {
        if (name.charAt(0) === "+") { // Relative path to plugin
          var pluginFields = self.loadPluginFolder(name.substring(1));
          ;
          if (pluginFields) {
            self.wiki.addTiddler(pluginFields);
          }
        }
        else {
          var parts = name.split("/"), type = parts[0];
          if (parts.length === 3 && ["plugins", "themes", "languages"].indexOf(type) !== -1) {
            self.loadPlugins([parts[1] + "/" + parts[2]], $tw.config[type + "Path"], $tw.config[type + "EnvVar"]);
          }
        }
      });
      // Load the tiddlers from the wiki directory
      if (self.wiki.wikiPath) {
        self.wiki.wikiInfo = self.loadWikiTiddlers(self.wiki.wikiPath);
      }
    }
  }

  /*
  A default set of files for TiddlyWiki to ignore during load.
  This matches what NPM ignores, and adds "*.meta" to ignore tiddler
  metadata files.
  */
  $tw.boot.excludeRegExp = /^\.DS_Store$|^.*\.meta$|^\..*\.swp$|^\._.*$|^\.git$|^\.hg$|^\.lock-wscript$|^\.svn$|^\.wafpickle-.*$|^CVS$|^npm-debug\.log$/;

  return FileSystemLoaderInner;
};

