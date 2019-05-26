"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const rx_1 = require("./rx");
exports.obs_stat = (tag = undefined) => (filepath) => new rx_1.Observable(subs => {
    fs.stat(filepath, (err, data) => {
        subs.next([err, data, tag, filepath]);
        subs.complete();
    });
});
exports.obs_exists = (tag = undefined) => (filepath) => new rx_1.Observable(subs => {
    fs.stat(filepath, (err, data) => {
        subs.next([!err, tag, filepath]);
        subs.complete();
    });
});
exports.obs_readdir = (tag = undefined) => (filepath) => new rx_1.Observable(subs => {
    fs.readdir(filepath, (err, data) => {
        subs.next([err, data, tag, filepath]);
        subs.complete();
    });
});
exports.obs_readFile = (tag = undefined) => (filepath, encoding) => new rx_1.Observable(subs => {
    const cb = (err, data) => {
        subs.next([err, data, tag, filepath]);
        subs.complete();
    };
    if (encoding)
        fs.readFile(filepath, encoding, cb);
    else
        fs.readFile(filepath, cb);
});
function obs_tw_each(obj) {
    return new rx_1.Observable(subs => {
        $tw.utils.each(obj, (item, index) => { subs.next([item, index]); });
        subs.complete();
    });
}
function loadTiddlersFromFile(filepath, fields) {
    var ext = path.extname(filepath), extensionInfo = $tw.utils.getFileExtensionInfo(ext), type = extensionInfo ? extensionInfo.type : null, typeInfo = type ? $tw.config.contentTypeInfo[type] : null;
    return exports.obs_readFile()(filepath, typeInfo ? typeInfo.encoding : "utf8").concatMap(data => {
        var tiddlers = $tw.wiki.deserializeTiddlers(ext, data, fields);
        if (ext !== ".json" && tiddlers.length === 1) {
            return $tw.loadMetadataForFile(filepath).map(metadata => {
                tiddlers = [$tw.utils.extend({}, tiddlers[0], metadata)];
                return { filepath: filepath, type: type, tiddlers: tiddlers, hasMetaFile: true };
            });
        }
        else {
            return rx_1.Observable.of({ filepath: filepath, type: type, tiddlers: tiddlers, hasMetaFile: false });
        }
    });
}
;
function loadMetadataForFile(filepath) {
    var metafilename = filepath + ".meta";
    return exports.obs_exists()(metafilename).concatMap(([exists]) => {
        if (exists)
            return exports.obs_readFile()(metafilename, "utf8");
        else
            return rx_1.Observable.of([true]);
    }).map(([err, data]) => {
        if (err)
            return {};
        else
            return $tw.utils.parseFields(data);
    });
}
;
$tw.boot.excludeRegExp = /^\.DS_Store$|^.*\.meta$|^\..*\.swp$|^\._.*$|^\.git$|^\.hg$|^\.lock-wscript$|^\.svn$|^\.wafpickle-.*$|^CVS$|^npm-debug\.log$/;
function loadTiddlersFromPath(filepath, excludeRegExp) {
    excludeRegExp = excludeRegExp || $tw.boot.excludeRegExp;
    return exports.obs_stat()(filepath).concatMap(([err, stat]) => {
        if (stat.isDirectory()) {
            return exports.obs_readdir()(filepath).concatMap(([err, files]) => {
                if (files.indexOf("tiddlywiki.files") !== -1)
                    return $tw.loadTiddlersFromSpecification(filepath, excludeRegExp);
                else
                    return rx_1.Observable.from(files).mergeMap(file => {
                        if (!excludeRegExp.test(file) && file !== "plugin.info") {
                            return $tw.loadTiddlersFromPath(filepath + path.sep + file, excludeRegExp);
                        }
                        else {
                            return rx_1.Observable.empty();
                        }
                    });
            });
        }
        else if (stat.isFile()) {
            return $tw.loadTiddlersFromFile(filepath, { title: filepath });
        }
        else {
            return rx_1.Observable.empty();
        }
    });
}
;
function loadTiddlersFromSpecification(filepath, excludeRegExp) {
    var tiddlers = [];
    // Read the specification
    return exports.obs_readFile()(filepath + path.sep + "tiddlywiki.files", "utf8").map(([err, data]) => {
        var filesInfo = JSON.parse(data);
        return rx_1.Observable.merge(
        // Process the listed tiddlers
        obs_tw_each(filesInfo.tiddlers).mergeMap(([tidInfo]) => {
            if (tidInfo.prefix && tidInfo.suffix) {
                tidInfo.fields.text = { prefix: tidInfo.prefix, suffix: tidInfo.suffix };
            }
            else if (tidInfo.prefix) {
                tidInfo.fields.text = { prefix: tidInfo.prefix };
            }
            else if (tidInfo.suffix) {
                tidInfo.fields.text = { suffix: tidInfo.suffix };
            }
            return processFile(tidInfo.file, tidInfo.isTiddlerFile, tidInfo.fields);
        }), 
        // Process any listed directories
        obs_tw_each(filesInfo.directories).mergeMap(([dirSpec]) => {
            // Read literal directories directly
            if (typeof dirSpec === "string") {
                var pathname = path.resolve(filepath, dirSpec);
                return exports.obs_stat()(pathname).mergeMap(([err, stat]) => {
                    if (!err && stat.isDirectory())
                        return $tw.loadTiddlersFromPath(pathname, excludeRegExp);
                    else
                        return rx_1.Observable.empty();
                });
            }
            else {
                // Process directory specifier
                var dirPath = path.resolve(filepath, dirSpec.path);
                return exports.obs_readdir()(dirPath).map(([err, files]) => {
                    var fileRegExp = new RegExp(dirSpec.filesRegExp || "^.*$"), metaRegExp = /^.*\.meta$/;
                    return rx_1.Observable.from(files).mergeMap(filename => {
                        if (filename !== "tiddlywiki.files" && !metaRegExp.test(filename) && fileRegExp.test(filename)) {
                            return processFile(dirPath + path.sep + filename, dirSpec.isTiddlerFile, dirSpec.fields);
                        }
                        else {
                            return rx_1.Observable.empty();
                        }
                    });
                });
            }
        }));
    });
    // Helper to process a file
    function processFile(filename, isTiddlerFile, fields) {
        var extInfo = $tw.config.fileExtensionInfo[path.extname(filename)], type = (extInfo || {}).type || fields.type || "text/plain", typeInfo = $tw.config.contentTypeInfo[type] || {}, pathname = path.resolve(filepath, filename);
        return rx_1.Observable.zip(exports.obs_readFile()(pathname, typeInfo.encoding || "utf8"), $tw.loadMetadataForFile(pathname)).mergeMap(([text, metadata]) => {
            var fileTiddlers;
            if (isTiddlerFile) {
                fileTiddlers = $tw.wiki.deserializeTiddlers(path.extname(pathname), text, metadata) || [];
            }
            else {
                fileTiddlers = [$tw.utils.extend({ text: text }, metadata)];
            }
            var combinedFields = $tw.utils.extend({}, fields, metadata);
            return obs_tw_each(fileTiddlers).mergeMap(tiddler => {
                return obs_tw_each(combinedFields).mergeMap(([fieldInfo, name]) => {
                    if (typeof fieldInfo === "string" || $tw.utils.isArray(fieldInfo)) {
                        tiddler[name] = fieldInfo;
                        //this will signal immediate completion
                        return rx_1.Observable.empty();
                    }
                    else {
                        var value = tiddler[name];
                        //holds an arraylike or observable with exactly one item
                        var newValue = (() => {
                            switch (fieldInfo.source) {
                                case "filename":
                                    return [path.basename(filename)];
                                case "filename-uri-decoded":
                                    return [decodeURIComponent(path.basename(filename))];
                                case "basename":
                                    return [path.basename(filename, path.extname(filename))];
                                case "basename-uri-decoded":
                                    return [decodeURIComponent(path.basename(filename, path.extname(filename)))];
                                case "extname":
                                    return [path.extname(filename)];
                                case "created":
                                    return exports.obs_stat()(pathname).map(([err, stat]) => new Date(stat.birthtime));
                                case "modified":
                                    return exports.obs_stat()(pathname).map(([err, stat]) => new Date(stat.mtime));
                            }
                        })();
                        //here we ignore elements to capture observable completion
                        return rx_1.Observable.from(newValue).do(value => {
                            if (fieldInfo.prefix) {
                                value = fieldInfo.prefix + value;
                            }
                            if (fieldInfo.suffix) {
                                value = value + fieldInfo.suffix;
                            }
                            tiddler[name] = value;
                        }).ignoreElements();
                    }
                }).reduce((n) => n, tiddler); //we reduce this so the tiddler is eventually returned
            }).reduce((n, e) => {
                n.tiddlers.push(e);
                return n;
            }, { tiddlers: [] });
        });
    }
    ;
}
function loadPluginFolder(filepath, excludeRegExp) {
    excludeRegExp = excludeRegExp || $tw.boot.excludeRegExp;
    var infoPath = filepath + path.sep + "plugin.info";
    return exports.obs_stat()(filepath).mergeMap(([err, stat]) => {
        if (err || !stat.isDirectory())
            return rx_1.Observable.empty();
        return exports.obs_readFile()(infoPath, "utf8").mergeMap(([err, data]) => {
            if (err) {
                console.log("Warning: missing plugin.info file in " + filepath);
                return rx_1.Observable.empty();
            }
            var pluginInfo = JSON.parse(data);
            return $tw.loadTiddlersFromPath(filepath, excludeRegExp).map(pluginFiles => {
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
            });
        });
    });
}
;
function findLibraryItem(name, paths) {
    return rx_1.Observable.from(paths)
        .map(e => path.resolve(e, "./" + name))
        .concatMap(pluginPath => exports.obs_stat()(pluginPath))
        .first(([err, stat]) => !err && stat.isDirectory())
        .map(([err, stat, tag, pluginPath]) => pluginPath);
}
;
function loadPlugin(name, paths) {
    return $tw.findLibraryItem(name, paths)
        .mergeMap(pluginPath => $tw.loadPluginFolder(pluginPath))
        .do(pluginInfo => $tw.wiki.addTiddler(pluginInfo))
        .ignoreElements();
}
;
function getLibraryItemSearchPaths(libraryPath, envVar) {
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
;
function loadPlugins(plugins, libraryPath, envVar) {
    var pluginPaths = $tw.getLibraryItemSearchPaths(libraryPath, envVar);
    if (plugins)
        return rx_1.Observable.from(plugins).mergeMap(plugin => $tw.loadPlugin(plugin, pluginPaths));
    else
        return rx_1.Observable.empty();
}
function loadWikiTiddlers(wikiPath, options) {
    options = options || {};
    var parentPaths = options.parentPaths || [], wikiInfoPath = path.resolve(wikiPath, $tw.config.wikiInfo), wikiInfo, pluginFields;
    return exports.obs_readFile()(wikiInfoPath, "utf8").mergeMap(([err, wikiInfoText]) => {
        var wikiInfo = JSON.parse(wikiInfoPath);
        // Load the wiki files, registering them as writable
        var resolvedWikiPath = path.resolve(wikiPath, $tw.config.wikiTiddlersSubDir);
        // Save the original tiddler file locations if requested
        var config = wikiInfo.config || {};
        if (config["retain-original-tiddler-path"]) {
            var output = {}, relativePath;
            for (var title in $tw.boot.files) {
                relativePath = path.relative(resolvedWikiPath, $tw.boot.files[title].filepath);
                output[title] =
                    path.sep === path.posix.sep ?
                        relativePath :
                        relativePath.split(path.sep).join(path.posix.sep);
            }
            $tw.wiki.addTiddler({ title: "$:/config/OriginalTiddlerPaths", type: "application/json", text: JSON.stringify(output) });
        }
        // Save the path to the tiddlers folder for the filesystemadaptor
        $tw.boot.wikiTiddlersPath = path.resolve($tw.boot.wikiPath, config["default-tiddler-location"] || $tw.config.wikiTiddlersSubDir);
        parentPaths = parentPaths.slice(0);
        parentPaths.push(wikiPath);
        var loadIncludesObs = obs_tw_each(wikiInfo.includeWikis || []).map(([info]) => {
            if (typeof info === "string") {
                info = { path: info };
            }
            var resolvedIncludedWikiPath = path.resolve(wikiPath, info.path);
            if (parentPaths.indexOf(resolvedIncludedWikiPath) === -1) {
                return $tw.loadWikiTiddlers(resolvedIncludedWikiPath, {
                    parentPaths: parentPaths,
                    readOnly: info["read-only"]
                }).map(subWikiInfo => {
                    // Merge the build targets
                    wikiInfo.build = $tw.utils.extend([], subWikiInfo.build, wikiInfo.build);
                });
            }
            else {
                $tw.utils.error("Cannot recursively include wiki " + resolvedIncludedWikiPath);
            }
        });
        var loadWiki = $tw.loadTiddlersFromPath(resolvedWikiPath).do((tiddlerFile) => {
            if (!options.readOnly && tiddlerFile.filepath) {
                $tw.utils.each(tiddlerFile.tiddlers, function (tiddler) {
                    $tw.boot.files[tiddler.title] = {
                        filepath: tiddlerFile.filepath,
                        type: tiddlerFile.type,
                        hasMetaFile: tiddlerFile.hasMetaFile
                    };
                });
            }
            $tw.wiki.addTiddlers(tiddlerFile.tiddlers);
        }).ignoreElements();
        // Load any plugins within the wiki folder
        var loadWikiPlugins = rx_1.Observable.of(path.resolve(wikiPath, $tw.config.wikiPluginsSubDir), path.resolve(wikiPath, $tw.config.wikiThemesSubDir), path.resolve(wikiPath, $tw.config.wikiLanguagesSubDir)).mergeMap(wpp => exports.obs_readdir()(wpp)).mergeMap(([err, pluginFolders, tag, wikiPluginsPath]) => {
            if (err)
                return rx_1.Observable.empty();
            return rx_1.Observable.from(pluginFolders).mergeMap(folder => {
                return $tw.loadPluginFolder(path.resolve(wikiPluginsPath, "./" + folder));
            }).do(pluginFields => {
                $tw.wiki.addTiddler(pluginFields);
            }).ignoreElements();
        });
        return rx_1.Observable.merge(
        // Load includeWikis
        loadIncludesObs, 
        // Load any plugins, themes and languages listed in the wiki info file
        $tw.loadPlugins(wikiInfo.plugins, $tw.config.pluginsPath, $tw.config.pluginsEnvVar), $tw.loadPlugins(wikiInfo.themes, $tw.config.themesPath, $tw.config.themesEnvVar), $tw.loadPlugins(wikiInfo.languages, $tw.config.languagesPath, $tw.config.languagesEnvVar), 
        // Load the wiki folder
        loadWikiPlugins).reduce(n => n, wikiInfo);
    });
}
;
function loadTiddlersNode() {
    // Load the boot tiddlers
    $tw.loadTiddlersFromPath($tw.boot.bootPath)
        .subscribe(tiddlerFile => $tw.wiki.addTiddlers(tiddlerFile.tiddlers));
    // Load the core tiddlers
    $tw.loadPluginFolder($tw.boot.corePath)
        .subscribe(pluginFolder => $tw.wiki.addTiddler(pluginFolder));
    // Load the tiddlers from the wiki directory
    if ($tw.boot.wikiPath) {
        $tw.loadWikiTiddlers($tw.boot.wikiPath)
            .subscribe(wikiInfo => $tw.boot.wikiInfo = wikiInfo);
    }
}
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdC1ub2RlLWFzeW5jLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdC1ub2RlLWFzeW5jLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLHlCQUF5QjtBQUV6Qiw2QkFBa0M7QUFHckIsUUFBQSxRQUFRLEdBQUcsQ0FBZ0IsTUFBUyxTQUFnQixFQUFFLEVBQUUsQ0FDcEUsQ0FBQyxRQUFnQixFQUFFLEVBQUUsQ0FBQyxJQUFJLGVBQVUsQ0FBcUIsSUFBSSxDQUFDLEVBQUU7SUFDL0QsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUU7UUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFBO0FBQ0gsQ0FBQyxDQUFDLENBQUE7QUFHVSxRQUFBLFVBQVUsR0FBRyxDQUFnQixNQUFTLFNBQWdCLEVBQUUsRUFBRSxDQUN0RSxDQUFDLFFBQWdCLEVBQUUsRUFBRSxDQUFDLElBQUksZUFBVSxDQUF1QixJQUFJLENBQUMsRUFBRTtJQUNqRSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFBO0FBQ0gsQ0FBQyxDQUFDLENBQUE7QUFHVSxRQUFBLFdBQVcsR0FBRyxDQUFJLE1BQVMsU0FBZ0IsRUFBRSxFQUFFLENBQzNELENBQUMsUUFBZ0IsRUFBRSxFQUFFLENBQUMsSUFBSSxlQUFVLENBQXdC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