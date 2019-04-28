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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdC1ub2RlLWFzeW5jLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdC1ub2RlLWFzeW5jLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkJBQTZCO0FBQzdCLHlCQUF5QjtBQUV6Qiw2QkFBa0M7QUFHckIsUUFBQSxRQUFRLEdBQUcsQ0FBZ0IsTUFBUyxTQUFnQixFQUFFLEVBQUUsQ0FDcEUsQ0FBQyxRQUFnQixFQUFFLEVBQUUsQ0FBQyxJQUFJLGVBQVUsQ0FBcUIsSUFBSSxDQUFDLEVBQUU7SUFDL0QsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUU7UUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFBO0FBQ0gsQ0FBQyxDQUFDLENBQUE7QUFHVSxRQUFBLFVBQVUsR0FBRyxDQUFnQixNQUFTLFNBQWdCLEVBQUUsRUFBRSxDQUN0RSxDQUFDLFFBQWdCLEVBQUUsRUFBRSxDQUFDLElBQUksZUFBVSxDQUF1QixJQUFJLENBQUMsRUFBRTtJQUNqRSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFBO0FBQ0gsQ0FBQyxDQUFDLENBQUE7QUFHVSxRQUFBLFdBQVcsR0FBRyxDQUFJLE1BQVMsU0FBZ0IsRUFBRSxFQUFFLENBQzNELENBQUMsUUFBZ0IsRUFBRSxFQUFFLENBQUMsSUFBSSxlQUFVLENBQXdCLElBQUksQ0FBQyxFQUFFO0lBQ2xFLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFO1FBQ2xDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNqQixDQUFDLENBQUMsQ0FBQTtBQUNILENBQUMsQ0FBQyxDQUFBO0FBR1UsUUFBQSxZQUFZLEdBQUcsQ0FBSSxNQUFTLFNBQWdCLEVBQTBCLEVBQUUsQ0FDcEYsQ0FBQyxRQUFnQixFQUFFLFFBQWlCLEVBQUUsRUFBRSxDQUN2QyxJQUFJLGVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUNyQixNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDakIsQ0FBQyxDQUFBO0lBQ0QsSUFBSSxRQUFRO1FBQ1gsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDOztRQUVwQyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQTtBQUMzQixDQUFDLENBQVEsQ0FBQztBQW1CWixTQUFTLFdBQVcsQ0FBQyxHQUFRO0lBQzVCLE9BQU8sSUFBSSxlQUFVLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDNUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFBO0FBQ0gsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLE1BQU07SUFDN0MsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFDL0IsYUFBYSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLEVBQ25ELElBQUksR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksRUFDaEQsUUFBUSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUMzRCxPQUFPLG9CQUFZLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDdkYsSUFBSSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQy9ELElBQUksR0FBRyxLQUFLLE9BQU8sSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUM3QyxPQUFPLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQ3ZELFFBQVEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDekQsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUNsRixDQUFDLENBQUMsQ0FBQztTQUNIO2FBQU07WUFDTixPQUFPLGVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQTtTQUNoRztJQUNGLENBQUMsQ0FBQyxDQUFBO0FBQ0gsQ0FBQztBQUFBLENBQUM7QUFFRixTQUFTLG1CQUFtQixDQUFDLFFBQVE7SUFDcEMsSUFBSSxZQUFZLEdBQUcsUUFBUSxHQUFHLE9BQU8sQ0FBQztJQUN0QyxPQUFPLGtCQUFVLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUU7UUFDeEQsSUFBSSxNQUFNO1lBQUUsT0FBTyxvQkFBWSxFQUFFLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDOztZQUNuRCxPQUFPLGVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ25DLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7UUFDdEIsSUFBSSxHQUFHO1lBQUUsT0FBTyxFQUFFLENBQUM7O1lBQ2QsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQU8sQ0FBQztJQUMvQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFBQSxDQUFDO0FBRUYsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLEdBQUcsNkhBQTZILENBQUM7QUFFdkosU0FBUyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsYUFBYztJQUNyRCxhQUFhLEdBQUcsYUFBYSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQ3hELE9BQU8sZ0JBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7UUFDckQsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDdkIsT0FBTyxtQkFBVyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtnQkFDekQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUMzQyxPQUFPLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLENBQUM7O29CQUM5RCxPQUFPLGVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO3dCQUNsRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLEtBQUssYUFBYSxFQUFFOzRCQUN4RCxPQUFPLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7eUJBQzNFOzZCQUFNOzRCQUNOLE9BQU8sZUFBVSxDQUFDLEtBQUssRUFBUyxDQUFDO3lCQUNqQztvQkFDRixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFBO1NBQ0Y7YUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUN6QixPQUFPLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztTQUMvRDthQUFNO1lBQ04sT0FBTyxlQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7U0FDMUI7SUFDRixDQUFDLENBQUMsQ0FBQTtBQUNILENBQUM7QUFBQSxDQUFDO0FBRUYsU0FBUyw2QkFBNkIsQ0FBQyxRQUFRLEVBQUUsYUFBYTtJQUM3RCxJQUFJLFFBQVEsR0FBRyxFQUFFLENBQUM7SUFDbEIseUJBQXlCO0lBQ3pCLE9BQU8sb0JBQVksRUFBRSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxHQUFHLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7UUFDM0YsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVqQyxPQUFPLGVBQVUsQ0FBQyxLQUFLO1FBQ3RCLDhCQUE4QjtRQUM5QixXQUFXLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFRLEVBQUUsRUFBRTtZQUM3RCxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtnQkFDckMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQ3pFO2lCQUFNLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtnQkFDMUIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQ2pEO2lCQUFNLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtnQkFDMUIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQ2pEO1lBQ0QsT0FBTyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUV6RSxDQUFDLENBQUM7UUFDRixpQ0FBaUM7UUFDakMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBUSxFQUFFLEVBQUU7WUFDaEUsb0NBQW9DO1lBQ3BDLElBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxFQUFFO2dCQUNoQyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDL0MsT0FBTyxnQkFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtvQkFDcEQsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO3dCQUM3QixPQUFPLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLENBQUE7O3dCQUV4RCxPQUFPLGVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDNUIsQ0FBQyxDQUFDLENBQUE7YUFDRjtpQkFBTTtnQkFDTiw4QkFBOEI7Z0JBQzlCLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbkQsT0FBTyxtQkFBVyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtvQkFDbEQsSUFBSSxVQUFVLEdBQUcsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsRUFDekQsVUFBVSxHQUFHLFlBQVksQ0FBQztvQkFDM0IsT0FBTyxlQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRTt3QkFDakQsSUFBSSxRQUFRLEtBQUssa0JBQWtCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7NEJBQy9GLE9BQU8sV0FBVyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxHQUFHLFFBQVEsRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzt5QkFDekY7NkJBQU07NEJBQ04sT0FBTyxlQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7eUJBQzFCO29CQUNGLENBQUMsQ0FBQyxDQUFBO2dCQUNILENBQUMsQ0FBQyxDQUFBO2FBQ0Y7UUFDRixDQUFDLENBQUMsQ0FDRixDQUFBO0lBQ0YsQ0FBQyxDQUFDLENBQUE7SUFDRiwyQkFBMkI7SUFDM0IsU0FBUyxXQUFXLENBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNO1FBQ25ELElBQUksT0FBTyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUNqRSxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJLElBQUksWUFBWSxFQUMxRCxRQUFRLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUNqRCxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDN0MsT0FBTyxlQUFVLENBQUMsR0FBRyxDQUNwQixvQkFBWSxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDLEVBQ3JELEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FDakMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFO1lBQy9CLElBQUksWUFBWSxDQUFDO1lBQ2pCLElBQUksYUFBYSxFQUFFO2dCQUNsQixZQUFZLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDMUY7aUJBQU07Z0JBQ04sWUFBWSxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQzthQUM1RDtZQUNELElBQUksY0FBYyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDNUQsT0FBTyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNuRCxPQUFPLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQU0sRUFBRSxFQUFFO29CQUN0RSxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRTt3QkFDbEUsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQzt3QkFDMUIsdUNBQXVDO3dCQUN2QyxPQUFPLGVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztxQkFDMUI7eUJBQU07d0JBQ04sSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUMxQix3REFBd0Q7d0JBQ3hELElBQUksUUFBUSxHQUFRLENBQUMsR0FBRyxFQUFFOzRCQUN6QixRQUFRLFNBQVMsQ0FBQyxNQUFNLEVBQUU7Z0NBQ3pCLEtBQUssVUFBVTtvQ0FDZCxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dDQUNsQyxLQUFLLHNCQUFzQjtvQ0FDMUIsT0FBTyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dDQUN0RCxLQUFLLFVBQVU7b0NBQ2QsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dDQUMxRCxLQUFLLHNCQUFzQjtvQ0FDMUIsT0FBTyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0NBQzlFLEtBQUssU0FBUztvQ0FDYixPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dDQUNqQyxLQUFLLFNBQVM7b0NBQ2IsT0FBTyxnQkFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dDQUM1RSxLQUFLLFVBQVU7b0NBQ2QsT0FBTyxnQkFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOzZCQUN4RTt3QkFDRixDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUNMLDBEQUEwRDt3QkFDMUQsT0FBTyxlQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRTs0QkFDM0MsSUFBSSxTQUFTLENBQUMsTUFBTSxFQUFFO2dDQUNyQixLQUFLLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7NkJBQ2pDOzRCQUNELElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRTtnQ0FDckIsS0FBSyxHQUFHLEtBQUssR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDOzZCQUNqQzs0QkFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDO3dCQUN2QixDQUFDLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztxQkFDcEI7Z0JBRUYsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxzREFBc0Q7WUFDckYsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUEyQixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDNUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25CLE9BQU8sQ0FBQyxDQUFDO1lBQ1YsQ0FBQyxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFDckIsQ0FBQyxDQUFDLENBQUE7SUFDSCxDQUFDO0lBQUEsQ0FBQztBQUdILENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxhQUFjO0lBQ2pELGFBQWEsR0FBRyxhQUFhLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDeEQsSUFBSSxRQUFRLEdBQUcsUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDO0lBQ25ELE9BQU8sZ0JBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7UUFDcEQsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQUUsT0FBTyxlQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFMUQsT0FBTyxvQkFBWSxFQUFFLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7WUFDaEUsSUFBSSxHQUFHLEVBQUU7Z0JBQ1IsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1Q0FBdUMsR0FBRyxRQUFRLENBQUMsQ0FBQztnQkFDaEUsT0FBTyxlQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7YUFDMUI7WUFDRCxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLE9BQU8sR0FBRyxDQUFDLG9CQUFvQixDQUFDLFFBQVEsRUFBRSxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzFFLGdEQUFnRDtnQkFDaEQsVUFBVSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2pFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUM1QyxJQUFJLFFBQVEsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO29CQUN2QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTt3QkFDekMsSUFBSSxPQUFPLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUMxQixJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUU7NEJBQ2xCLFVBQVUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQzt5QkFDN0M7cUJBQ0Q7aUJBQ0Q7Z0JBQ0QsNkVBQTZFO2dCQUM3RSxJQUFJLENBQUMsQ0FBQyxTQUFTLElBQUksVUFBVSxDQUFDLEVBQUU7b0JBQy9CLFVBQVUsQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7aUJBQzdDO2dCQUNELHVEQUF1RDtnQkFDdkQsSUFBSSxDQUFDLENBQUMsYUFBYSxJQUFJLFVBQVUsQ0FBQyxFQUFFO29CQUNuQyxVQUFVLENBQUMsYUFBYSxDQUFDLEdBQUcsUUFBUSxDQUFDO2lCQUNyQztnQkFDRCxVQUFVLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDO2dCQUNwRCxVQUFVLENBQUMsSUFBSSxHQUFHLGtCQUFrQixDQUFDO2dCQUNyQyxrQkFBa0I7Z0JBQ2xCLFVBQVUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM3RSxPQUFPLFVBQVUsQ0FBQyxRQUFRLENBQUM7Z0JBQzNCLHlFQUF5RTtnQkFDekUsS0FBSyxJQUFJLEtBQUssSUFBSSxVQUFVLEVBQUU7b0JBQzdCLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7d0JBQ3pDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztxQkFDL0Q7aUJBQ0Q7Z0JBQ0QsT0FBTyxVQUFVLENBQUM7WUFDbkIsQ0FBQyxDQUFDLENBQUE7UUFDSCxDQUFDLENBQUMsQ0FBQTtJQUNILENBQUMsQ0FBQyxDQUFBO0FBQ0gsQ0FBQztBQUFBLENBQUM7QUFFRixTQUFTLGVBQWUsQ0FBQyxJQUFZLEVBQUUsS0FBZTtJQUNyRCxPQUFPLGVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO1NBQzNCLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQztTQUN0QyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxnQkFBUSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDL0MsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztTQUNsRCxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLFVBQVUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNyRCxDQUFDO0FBQUEsQ0FBQztBQUVGLFNBQVMsVUFBVSxDQUFDLElBQUksRUFBRSxLQUFLO0lBQzlCLE9BQU8sR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDO1NBQ3JDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUN4RCxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNqRCxjQUFjLEVBQUUsQ0FBQztBQUNwQixDQUFDO0FBQUEsQ0FBQztBQUVGLFNBQVMseUJBQXlCLENBQUMsV0FBVyxFQUFFLE1BQU07SUFDckQsSUFBSSxXQUFXLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLEVBQy9ELEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNCLElBQUksR0FBRyxFQUFFO1FBQ1IsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSTtZQUMzQyxJQUFJLElBQUksRUFBRTtnQkFDVCxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO2FBQ3RCO1FBQ0YsQ0FBQyxDQUFDLENBQUM7S0FDSDtJQUNELE9BQU8sV0FBVyxDQUFDO0FBQ3BCLENBQUM7QUFBQSxDQUFDO0FBQ0YsU0FBUyxXQUFXLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNO0lBQ2hELElBQUksV0FBVyxHQUFHLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDckUsSUFBSSxPQUFPO1FBQ1YsT0FBTyxlQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7O1FBRXhGLE9BQU8sZUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQzVCLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxPQUFRO0lBQzNDLE9BQU8sR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO0lBQ3hCLElBQUksV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLElBQUksRUFBRSxFQUMxQyxZQUFZLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFDMUQsUUFBUSxFQUNSLFlBQVksQ0FBQztJQUVkLE9BQU8sb0JBQVksRUFBRSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxZQUFZLENBQUMsRUFBRSxFQUFFO1FBQzVFLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFeEMsb0RBQW9EO1FBQ3BELElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzdFLHdEQUF3RDtRQUN4RCxJQUFJLE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQztRQUNuQyxJQUFJLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQyxFQUFFO1lBQzNDLElBQUksTUFBTSxHQUFHLEVBQUUsRUFBRSxZQUFZLENBQUM7WUFDOUIsS0FBSyxJQUFJLEtBQUssSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRTtnQkFDakMsWUFBWSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQy9FLE1BQU0sQ0FBQyxLQUFLLENBQUM7b0JBQ1osSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUM1QixZQUFZLENBQUMsQ0FBQzt3QkFDZCxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNwRDtZQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsS0FBSyxFQUFFLGdDQUFnQyxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDekg7UUFDRCxpRUFBaUU7UUFDakUsR0FBRyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUVqSSxXQUFXLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNCLElBQUksZUFBZSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRTtZQUM3RSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDN0IsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDO2FBQ3RCO1lBQ0QsSUFBSSx3QkFBd0IsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakUsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQ3pELE9BQU8sR0FBRyxDQUFDLGdCQUFnQixDQUFDLHdCQUF3QixFQUFFO29CQUNyRCxXQUFXLEVBQUUsV0FBVztvQkFDeEIsUUFBUSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUM7aUJBQzNCLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7b0JBQ3BCLDBCQUEwQjtvQkFDMUIsUUFBUSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzFFLENBQUMsQ0FBQyxDQUFBO2FBQ0Y7aUJBQU07Z0JBQ04sR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEdBQUcsd0JBQXdCLENBQUMsQ0FBQzthQUMvRTtRQUNGLENBQUMsQ0FBQyxDQUFBO1FBSUYsSUFBSSxRQUFRLEdBQUcsR0FBRyxDQUFDLG9CQUFvQixDQUFDLGdCQUFnQixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDNUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksV0FBVyxDQUFDLFFBQVEsRUFBRTtnQkFDOUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxVQUFVLE9BQU87b0JBQ3JELEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRzt3QkFDL0IsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRO3dCQUM5QixJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUk7d0JBQ3RCLFdBQVcsRUFBRSxXQUFXLENBQUMsV0FBVztxQkFDcEMsQ0FBQztnQkFDSCxDQUFDLENBQUMsQ0FBQzthQUNIO1lBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3BCLDBDQUEwQztRQUMxQyxJQUFJLGVBQWUsR0FBRyxlQUFVLENBQUMsRUFBRSxDQUNsQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLEVBQ3BELElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFDbkQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxDQUN0RCxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUNoQixtQkFBVyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQ2xCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsYUFBYSxFQUFFLEdBQUcsRUFBRSxlQUFlLENBQUMsRUFBRSxFQUFFO1lBQ3pELElBQUksR0FBRztnQkFBRSxPQUFPLGVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNuQyxPQUFPLGVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN2RCxPQUFPLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQTtZQUMxRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQ3BCLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ25DLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3JCLENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxlQUFVLENBQUMsS0FBSztRQUN0QixvQkFBb0I7UUFDcEIsZUFBZTtRQUNmLHNFQUFzRTtRQUN0RSxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFDbkYsR0FBRyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQ2hGLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQztRQUN6Rix1QkFBdUI7UUFDdkIsZUFBZSxDQUNmLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzVCLENBQUMsQ0FBQyxDQUFBO0FBQ0gsQ0FBQztBQUFBLENBQUM7QUFFRixTQUFTLGdCQUFnQjtJQUV4Qix5QkFBeUI7SUFDekIsR0FBRyxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1NBQ3pDLFNBQVMsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLHlCQUF5QjtJQUN6QixHQUFHLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7U0FDckMsU0FBUyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUMvRCw0Q0FBNEM7SUFDNUMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUN0QixHQUFHLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7YUFDckMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUM7S0FDdEQ7QUFDRixDQUFDO0FBQUEsQ0FBQyJ9