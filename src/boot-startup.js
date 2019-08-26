"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const server_types_1 = require("./server-types");
const util_1 = require("util");
function loadWikiInfo(wikipath) {
    let filePath = path.join(wikipath, 'tiddlywiki.info');
    return util_1.promisify(fs.readFile)(filePath, 'utf8').then((data) => {
        // if (err) throw err;
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
        return TiddlyWiki.loadWiki(wikipath);
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
async function loadTiddlersFromFile(filepath, options = {}) {
    var ext = path.extname(filepath), extensionInfo = exports.global_tw.utils.getFileExtensionInfo(ext), type = extensionInfo ? extensionInfo.type : null, typeInfo = type ? exports.global_tw.config.contentTypeInfo[type] : null, encoding = typeInfo ? typeInfo.encoding : "utf8", getMetaFile = (ext !== ".json" && options.hasMetaFile !== false);
    let [data1, data2] = await Promise.all([
        util_1.promisify(fs.readFile)(filepath, encoding).catch((x) => x),
        getMetaFile ? util_1.promisify(fs.readFile)(filepath + ".meta", "utf8") : Promise.resolve(undefined)
    ]);
    //.then(([data1, data2]) => {
    let tiddlers = (typeof data1 === "string") ? exports.global_tw.wiki.deserializeTiddlers(ext, data1, {}) : [];
    let metadata = data2 ? exports.global_tw.utils.parseFields(data2) : false;
    if (metadata && tiddlers.length === 1)
        tiddlers = [exports.global_tw.utils.extend({}, tiddlers[0], metadata)];
    return { tiddlers, filepath, encoding, error: typeof data1 === "string" ? undefined : data1, type };
    // });
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
            throw "browser-only not implemented";
            // if (location.hash === "#:safe") {
            // 	$tw.safeMode = true;
            // }
            // else {
            // 	$tw.locationHash = $tw.utils.getLocationHash();
            // }
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
    async function loadWiki(wikiPath, wikiInfo, fallback) {
        if (wikiInfo.type !== "tiddlyserver") {
            if (fallback) {
                loadWikiFolder(wikiPath, wikiInfo);
                return undefined;
            }
            else
                throw new Error("Invalid wiki type " + wikiInfo.type);
        }
        const includes = wikiInfo.includeWikis.map(e => {
            var item = typeof e === "string" ? { path: e, "read-only": false } : e;
            var subWikiPath = path.resolve(wikiPath, item.path);
            return loadWikiInfo(wikiPath).then(wikiInfo => {
                return loadWiki(wikiPath, wikiInfo, true);
            });
        });
        let wiki = (await Promise.all(includes)).reduce((wiki, item) => {
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
        }, new Wiki());
        return loadWikiTiddlers(wikiPath, wikiInfo).then(wikiFiles => {
            wikiFiles.forEach(file => {
                file.tiddlers.forEach(fields => {
                    wiki.tiddlers[fields.title] = fields;
                });
                delete file.tiddlers;
                wiki.files[file.filepath] = file;
            });
            return { $ts: wiki, wikiInfo };
        });
    }
    TiddlyServer.loadWiki = loadWiki;
})(TiddlyServer = exports.TiddlyServer || (exports.TiddlyServer = {}));
function loadWikiTiddlers(wikipath, wikiInfo) {
    let tiddlerFolder = path.join(wikipath, exports.global_tw.config.wikiTiddlersSubDir);
    return util_1.promisify(fs.readdir)(tiddlerFolder).catch(x => undefined).then((files) => {
        if (!files)
            return [];
        var metas = files.filter(e => path.extname(e) === ".meta");
        var datas = files.filter(e => path.extname(e) !== ".meta");
        return Promise.all(datas.map(e => {
            return {
                filepath: path.join(tiddlerFolder, e),
                hasMetaFile: metas.indexOf(e + ".meta") > -1
            };
        }).map(item => {
            return loadTiddlersFromFile(item.filepath, { hasMetaFile: item.hasMetaFile });
        }));
    });
}
exports.loadWikiTiddlers = loadWikiTiddlers;
function getFileType(tiddlerType) {
    if (!tiddlerType)
        tiddlerType = "text/vnd.tiddlywiki";
    var contentTypeInfo = exports.global_tw.config.contentTypeInfo[tiddlerType] || {};
    var extension = contentTypeInfo.extension || ".tid";
    var type = (exports.global_tw.config.fileExtensionInfo[extension] || { type: "application/x-tiddler" }).type;
    return { type, extension };
}
exports.getFileType = getFileType;
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
exports.getTiddlerFileInfo = getTiddlerFileInfo;
exports.global_tw = TiddlyWiki.loadCore();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdC1zdGFydHVwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdC1zdGFydHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QixpREFBc0Y7QUFDdEYsK0JBQWlDO0FBV2pDLFNBQWdCLFlBQVksQ0FBQyxRQUFRO0lBQ3BDLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDdEQsT0FBTyxnQkFBUyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDN0Qsc0JBQXNCO1FBQ3RCLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztRQUNwQixJQUFJLFFBQVEsR0FBYSwyQkFBWSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQ3JELEtBQUssQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1lBQzFCLE1BQU0sS0FBSyxDQUFDO1FBQ2IsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLFFBQVEsQ0FBQztJQUNqQixDQUFDLENBQUMsQ0FBQTtBQUNILENBQUM7QUFYRCxvQ0FXQztBQUNELFNBQWdCLGNBQWMsQ0FBQyxRQUFRLEVBQUUsUUFBUTtJQUNoRCxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRTtRQUNyRCxPQUFPLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDckM7U0FBTSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssY0FBYyxFQUFFO1FBQzVDLE9BQU8sWUFBWSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3hEO1NBQU07UUFDTixNQUFNLElBQUksS0FBSyxDQUFDLHdC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