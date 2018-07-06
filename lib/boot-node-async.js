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
