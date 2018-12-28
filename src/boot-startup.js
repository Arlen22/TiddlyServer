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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdC1zdGFydHVwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdC1zdGFydHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QixpREFBaUg7QUFDakgsa0NBQXVDO0FBMkJ2QyxzQkFBNkIsUUFBUTtJQUNwQyxPQUFPLDJCQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRTtRQUN6RyxJQUFJLEdBQUc7WUFBRSxNQUFNLEdBQUcsQ0FBQztRQUNuQixJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7UUFDcEIsSUFBSSxRQUFRLEdBQWEsMkJBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUNyRCxLQUFLLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztZQUMxQixNQUFNLEtBQUssQ0FBQztRQUNiLENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQyxDQUFDLENBQUE7QUFDSCxDQUFDO0FBVkQsb0NBVUM7QUFDRCx3QkFBK0IsUUFBUSxFQUFFLFFBQVE7SUFDaEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxZQUFZLEVBQUU7UUFDckQsT0FBTyxlQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUNwRDtTQUFNLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxjQUFjLEVBQUU7UUFDNUMsT0FBTyxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDeEQ7U0FBTTtRQUNOLE1B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