"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const server_types_1 = require("./server-types");
const rx_1 = require("../lib/rx");
function loadWikiInfo(wikipath) {
    return server_types_1.obs_readFile()(path.join(wikipath, 'tiddlywiki.info'), 'utf8').map(([err, data, _tag, filePath]) => {
        if (err)
            throw err;
        let isError = false;
        let wikiInfo = server_types_1.tryParseJSON(data, (error) => {
            error.filePath = filePath;
            throw error;
        });
        return wikiInfo;
    });
}
exports.loadWikiInfo = loadWikiInfo;
function loadWikiFolder(wikipath, wikiInfo) {
    if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
        return rx_1.Observable.of(TiddlyWiki.loadWiki(wikipath));
    }
    else if (wikiInfo.type === "tiddlyserver") {
        return TiddlyServer.loadWiki(wikipath, wikiInfo, false);
    }
    else {
        throw new Error("Invalid wikiInfo type " + wikiInfo.type);
    }
}
exports.loadWikiFolder = loadWikiFolder;
/**
 *
 * @param filepath Tiddler file to load
 * @param options hasMetaFile (skips reading meta file if false)
 */
function loadTiddlersFromFile(filepath, options = {}) {
    var ext = path.extname(filepath), extensionInfo = exports.global_tw.utils.getFileExtensionInfo(ext), type = extensionInfo ? extensionInfo.type : null, typeInfo = type ? exports.global_tw.config.contentTypeInfo[type] : null, encoding = typeInfo ? typeInfo.encoding : "utf8", getMetaFile = (ext !== ".json" && options.hasMetaFile !== false);
    return rx_1.Observable.zip(server_types_1.obs_readFile()(filepath, encoding), getMetaFile ? server_types_1.obs_readFile()(filepath + ".meta", "utf8") : rx_1.Observable.of([])).map(([[err1, data1], [err2, data2]]) => {
        let tiddlers = !err1 ? exports.global_tw.wiki.deserializeTiddlers(ext, data1, {}) : [];
        let metadata = data2 ? exports.global_tw.utils.parseFields(data2) : false;
        if (metadata && tiddlers.length === 1)
            tiddlers = [exports.global_tw.utils.extend({}, tiddlers[0], metadata)];
        return { tiddlers, filepath, encoding, error: err1, type };
    });
}
exports.loadTiddlersFromFile = loadTiddlersFromFile;
// export function getFileName(dirPath: string, title: string, multiLevel: boolean = false) {
// 	return obs_readdir()(dirPath).map(([err, files]) => {
// 		let filename = title;
// 		if (!multiLevel) {
// 			filename = filename.replace(/\//g, "_");
// 		} else if (filename.startsWith('$:/')) {
// 			filename = "$system" + filename.slice(3).replace(/\//g, "_");
// 		}
// 		filename = filename.replace(/<|>|\:|\"|\||\?|\*|\^/g, "_").replace(/\//g, "_");
// 		if (files.indexOf(filename))
// 			return filename;
// 	})
// }
var TiddlyWiki;
(function (TiddlyWiki) {
    function loadWiki(wikiPath) {
        const $tw = loadCore();
        $tw.boot.wikiPath = wikiPath;
        const wikiInfo = loadWikiTiddlers($tw, wikiPath);
        return { $tw, wikiInfo };
    }
    TiddlyWiki.loadWiki = loadWiki;
    function loadCore(options) {
        const $tw = require("../tiddlywiki/boot/boot.js").TiddlyWiki(require("../tiddlywiki/boot/bootprefix.js").bootprefix({
            packageInfo: JSON.parse(fs.readFileSync(path.join(__dirname, '../tiddlywiki/package.json'), 'utf8'))
        }));
        // createWiki($tw);
        options = options || {};
        $tw.locationHash = "#";
        if ($tw.browser && !$tw.node) {
            if (location.hash === "#:safe") {
                $tw.safeMode = true;
            }
            else {
                $tw.locationHash = $tw.utils.getLocationHash();
            }
        }
        // Initialise some more $tw properties
        $tw.utils.deepDefaults($tw, {
            modules: {
                titles: Object.create(null),
                types: {} // hashmap by module type of hashmap of exports
            },
            config: {
                pluginsPath: "../plugins/",
                themesPath: "../themes/",
                languagesPath: "../languages/",
                editionsPath: "../editions/",
                wikiInfo: "./tiddlywiki.info",
                wikiPluginsSubDir: "./plugins",
                wikiThemesSubDir: "./themes",
                wikiLanguagesSubDir: "./languages",
                wikiTiddlersSubDir: "./tiddlers",
                wikiOutputSubDir: "./output",
                jsModuleHeaderRegExpString: "^\\/\\*\\\\(?:\\r?\\n)((?:^[^\\r\\n]*(?:\\r?\\n))+?)(^\\\\\\*\\/$(?:\\r?\\n)?)",
                fileExtensionInfo: Object.create(null),
                contentTypeInfo: Object.create(null),
                pluginsEnvVar: "TIDDLYWIKI_PLUGIN_PATH",
                themesEnvVar: "TIDDLYWIKI_THEME_PATH",
                languagesEnvVar: "TIDDLYWIKI_LANGUAGE_PATH",
                editionsEnvVar: "TIDDLYWIKI_EDITION_PATH"
            },
            log: {},
            unloadTasks: []
        });
        if (!$tw.boot.tasks.readBrowserTiddlers) {
            // For writable tiddler files, a hashmap of title to {filepath:,type:,hasMetaFile:}
            $tw.boot.files = Object.create(null);
            // System paths and filenames
            $tw.boot.bootPath = path.resolve(__dirname, '../tiddlywiki/boot/');
            $tw.boot.corePath = path.resolve($tw.boot.bootPath, "../core");
            // Read package info
            $tw.packageInfo = $tw.packageInfo || require("../package.json");
        }
        // Add file extension information
        $tw.utils.registerFileType("text/vnd.tiddlywiki", "utf8", ".tid");
        $tw.utils.registerFileType("application/x-tiddler", "utf8", ".tid");
        $tw.utils.registerFileType("application/x-tiddlers", "utf8", ".multids");
        $tw.utils.registerFileType("application/x-tiddler-html-div", "utf8", ".tiddler");
        $tw.utils.registerFileType("text/vnd.tiddlywiki2-recipe", "utf8", ".recipe");
        $tw.utils.registerFileType("text/plain", "utf8", ".txt");
        $tw.utils.registerFileType("text/css", "utf8", ".css");
        $tw.utils.registerFileType("text/html", "utf8", [".html", ".htm"]);
        $tw.utils.registerFileType("application/hta", "utf16le", ".hta", { deserializerType: "text/html" });
        $tw.utils.registerFileType("application/javascript", "utf8", ".js");
        $tw.utils.registerFileType("application/json", "utf8", ".json");
        $tw.utils.registerFileType("application/pdf", "base64", ".pdf", { flags: ["image"] });
        $tw.utils.registerFileType("application/zip", "base64", ".zip");
        $tw.utils.registerFileType("image/jpeg", "base64", [".jpg", ".jpeg"], { flags: ["image"] });
        $tw.utils.registerFileType("image/png", "base64", ".png", { flags: ["image"] });
        $tw.utils.registerFileType("image/gif", "base64", ".gif", { flags: ["image"] });
        $tw.utils.registerFileType("image/svg+xml", "utf8", ".svg", { flags: ["image"] });
        $tw.utils.registerFileType("image/x-icon", "base64", ".ico", { flags: ["image"] });
        $tw.utils.registerFileType("application/font-woff", "base64", ".woff");
        $tw.utils.registerFileType("audio/ogg", "base64", ".ogg");
        $tw.utils.registerFileType("video/mp4", "base64", ".mp4");
        $tw.utils.registerFileType("audio/mp3", "base64", ".mp3");
        $tw.utils.registerFileType("audio/mp4", "base64", [".mp4", ".m4a"]);
        $tw.utils.registerFileType("text/markdown", "utf8", [".md", ".markdown"], { deserializerType: "text/x-markdown" });
        $tw.utils.registerFileType("text/x-markdown", "utf8", [".md", ".markdown"]);
        $tw.utils.registerFileType("application/enex+xml", "utf8", ".enex");
        $tw.utils.registerFileType("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "base64", ".docx");
        $tw.utils.registerFileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "base64", ".xlsx");
        $tw.utils.registerFileType("application/vnd.openxmlformats-officedocument.presentationml.presentation", "base64", ".pptx");
        $tw.utils.registerFileType("application/x-bibtex", "utf8", ".bib");
        $tw.utils.registerFileType("application/epub+zip", "base64", ".epub");
        // Create the wiki store for the app
        $tw.wiki = new $tw.Wiki();
        // Install built in tiddler fields modules
        $tw.Tiddler.fieldModules = $tw.modules.getModulesByTypeAsHashmap("tiddlerfield");
        // Install the tiddler deserializer modules
        $tw.Wiki.tiddlerDeserializerModules = Object.create(null);
        $tw.modules.applyMethods("tiddlerdeserializer", $tw.Wiki.tiddlerDeserializerModules);
        return $tw;
    }
    TiddlyWiki.loadCore = loadCore;
    //copied from 5.1.15
    function loadWikiTiddlers($tw, wikiPath, options) {
        options = options || {};
        var parentPaths = options.parentPaths || [], wikiInfoPath = path.resolve(wikiPath, $tw.config.wikiInfo), wikiInfo, pluginFields;
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
                    var subWikiInfo = $tw.loadWikiTiddlers(resolvedIncludedWikiPath, {
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
        // $tw.loadPlugins(wikiInfo.plugins, $tw.config.pluginsPath, $tw.config.pluginsEnvVar);
        // $tw.loadPlugins(wikiInfo.themes, $tw.config.themesPath, $tw.config.themesEnvVar);
        // $tw.loadPlugins(wikiInfo.languages, $tw.config.languagesPath, $tw.config.languagesEnvVar);
        // Load the wiki files, registering them as writable
        var resolvedWikiPath = path.resolve(wikiPath, $tw.config.wikiTiddlersSubDir);
        $tw.utils.each($tw.loadTiddlersFromPath(resolvedWikiPath), function (tiddlerFile) {
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
        });
        // Save the original tiddler file locations if requested
        var config = wikiInfo.config || {};
        if (config["retain-original-tiddler-path"]) {
            var output = {};
            for (var title in $tw.boot.files) {
                output[title] = path.relative(resolvedWikiPath, $tw.boot.files[title].filepath);
            }
            $tw.wiki.addTiddler({ title: "$:/config/OriginalTiddlerPaths", type: "application/json", text: JSON.stringify(output) });
        }
        // Save the path to the tiddlers folder for the filesystemadaptor
        $tw.boot.wikiTiddlersPath = path.resolve($tw.boot.wikiPath, config["default-tiddler-location"] || $tw.config.wikiTiddlersSubDir);
        // Load any plugins within the wiki folder
        var wikiPluginsPath = path.resolve(wikiPath, $tw.config.wikiPluginsSubDir);
        if (fs.existsSync(wikiPluginsPath)) {
            var pluginFolders = fs.readdirSync(wikiPluginsPath);
            for (var t = 0; t < pluginFolders.length; t++) {
                pluginFields = $tw.loadPluginFolder(path.resolve(wikiPluginsPath, "./" + pluginFolders[t]));
                if (pluginFields) {
                    $tw.wiki.addTiddler(pluginFields);
                }
            }
        }
        // Load any themes within the wiki folder
        var wikiThemesPath = path.resolve(wikiPath, $tw.config.wikiThemesSubDir);
        if (fs.existsSync(wikiThemesPath)) {
            var themeFolders = fs.readdirSync(wikiThemesPath);
            for (var t = 0; t < themeFolders.length; t++) {
                pluginFields = $tw.loadPluginFolder(path.resolve(wikiThemesPath, "./" + themeFolders[t]));
                if (pluginFields) {
                    $tw.wiki.addTiddler(pluginFields);
                }
            }
        }
        // Load any languages within the wiki folder
        var wikiLanguagesPath = path.resolve(wikiPath, $tw.config.wikiLanguagesSubDir);
        if (fs.existsSync(wikiLanguagesPath)) {
            var languageFolders = fs.readdirSync(wikiLanguagesPath);
            for (var t = 0; t < languageFolders.length; t++) {
                pluginFields = $tw.loadPluginFolder(path.resolve(wikiLanguagesPath, "./" + languageFolders[t]));
                if (pluginFields) {
                    $tw.wiki.addTiddler(pluginFields);
                }
            }
        }
        return wikiInfo;
    }
    TiddlyWiki.loadWikiTiddlers = loadWikiTiddlers;
})(TiddlyWiki = exports.TiddlyWiki || (exports.TiddlyWiki = {}));
var TiddlyServer;
(function (TiddlyServer) {
    class Wiki {
        constructor() {
            this.files = [];
            this.tiddlers = {};
        }
    }
    TiddlyServer.Wiki = Wiki;
    function loadWiki(wikiPath, wikiInfo, fallback) {
        if (wikiInfo.type !== "tiddlyserver") {
            if (fallback) {
                loadWikiFolder(wikiPath, wikiInfo);
                return rx_1.Observable.empty();
            }
            else
                throw new Error("Invalid wiki type " + wikiInfo.type);
        }
        const includes = wikiInfo.includeWikis.map(e => {
            var item = typeof e === "string" ? { path: e, "read-only": false } : e;
            var subWikiPath = path.resolve(wikiPath, item.path);
            return rx_1.Observable.of(subWikiPath).mergeMap(loadWikiInfo).mergeMap(wikiInfo => {
                return loadWiki(wikiPath, wikiInfo, true);
            });
        });
        return rx_1.Observable.from(includes).concatMap(e => e).reduce((wiki, item) => {
            const { $ts, $tw, wikiInfo } = item;
            if (!wikiInfo.type || wikiInfo.type === "tiddlywiki") {
                if (!$tw)
                    return wiki;
                const tiddlers = [];
                const skipFields = [];
                $tw.wiki.each((tiddler, title) => {
                    let fields = {};
                    let keys = Object.keys(tiddler.fields).forEach(key => {
                        if (skipFields.indexOf(key) === -1)
                            fields[key] = tiddler.fields[key];
                    });
                    wiki.tiddlers[title] = fields;
                });
            }
            else if (wikiInfo.type === "tiddlyserver") {
                if (!$ts)
                    return wiki;
                Object.keys($ts.tiddlers).forEach((tiddler, title) => {
                    wiki.tiddlers[title] = tiddler;
                });
            }
            return wiki;
        }, new Wiki()).concatMap(wiki => {
            return loadWikiTiddlers(wikiPath, wikiInfo).map(wikiFiles => {
                wikiFiles.forEach(file => {
                    file.tiddlers.forEach(fields => {
                        wiki.tiddlers[fields.title] = fields;
                    });
                    delete file.tiddlers;
                    wiki.files[file.filepath] = file;
                });
                return { $ts: wiki, wikiInfo };
            });
        });
    }
    TiddlyServer.loadWiki = loadWiki;
    function loadWikiTiddlers(wikipath, wikiInfo) {
        let tiddlerFolder = path.join(wikipath, exports.global_tw.config.wikiTiddlersSubDir);
        return server_types_1.obs_readdir()(tiddlerFolder).concatMap(([err, files]) => {
            if (err)
                return rx_1.Observable.empty();
            var metas = files.filter(e => path.extname(e) === ".meta");
            var datas = files.filter(e => path.extname(e) !== ".meta");
            return rx_1.Observable.from(datas.map(e => {
                return {
                    filepath: path.join(tiddlerFolder, e),
                    hasMetaFile: metas.indexOf(e + ".meta") > -1
                };
            })).mergeMap(item => {
                return loadTiddlersFromFile(item.filepath, { hasMetaFile: item.hasMetaFile });
            }).reduce((n, e) => {
                n.push(e);
                return n;
            }, []);
        });
    }
    TiddlyServer.loadWikiTiddlers = loadWikiTiddlers;
    function getFileType(tiddlerType) {
        if (!tiddlerType)
            tiddlerType = "text/vnd.tiddlywiki";
        var contentTypeInfo = exports.global_tw.config.contentTypeInfo[tiddlerType] || {};
        var extension = contentTypeInfo.extension || ".tid";
        var type = (exports.global_tw.config.fileExtensionInfo[extension] || { type: "application/x-tiddler" }).type;
        return { type, extension };
    }
    TiddlyServer.getFileType = getFileType;
    function getTiddlerFileInfo(fields, options = {}) {
        let { type, extension } = getFileType(fields.type);
        var hasMetaFile = (type !== "application/x-tiddler") && (type !== "application/json");
        if (!hasMetaFile) {
            extension = ".tid";
        }
        var filename = fields.title;
        filename = filename.replace(/<|>|\:|\"|\||\?|\*|\^|\_|\/|\\/g, (str) => {
            return "_" + str.charCodeAt(0).toString(16);
        });
        if (filename.substr(-extension.length).toLocaleLowerCase() !== extension.toLocaleLowerCase()) {
            filename = filename + extension;
        }
        return { filename, extension, hasMetaFile, type };
    }
    TiddlyServer.getTiddlerFileInfo = getTiddlerFileInfo;
})(TiddlyServer = exports.TiddlyServer || (exports.TiddlyServer = {}));
exports.global_tw = TiddlyWiki.loadCore();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdC1zdGFydHVwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdC1zdGFydHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QixpREFBaUg7QUFDakgsa0NBQXVDO0FBMkJ2QyxTQUFnQixZQUFZLENBQUMsUUFBUTtJQUNwQyxPQUFPLDJCQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRTtRQUN6RyxJQUFJLEdBQUc7WUFBRSxNQUFNLEdBQUcsQ0FBQztRQUNuQixJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7UUFDcEIsSUFBSSxRQUFRLEdBQWEsMkJBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUNyRCxLQUFLLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztZQUMxQixNQUFNLEtBQUssQ0FBQztRQUNiLENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQyxDQUFDLENBQUE7QUFDSCxDQUFDO0FBVkQsb0NBVUM7QUFDRCxTQUFnQixjQUFjLENBQUMsUUFBUSxFQUFFLFFBQVE7SUFDaEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxZQUFZLEVBQUU7UUFDckQsT0FBTyxlQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUNwRDtTQUFNLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxjQUFjLEVBQUU7UUFDNUMsT0FBTyxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7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