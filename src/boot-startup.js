"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require('path');
const fs = require('fs');
function loadWiki(wikiPath, options) {
    const $tw = loadCore();
    $tw.boot.wikiPath = wikiPath;
    const wikiInfo = loadWikiTiddlers($tw, wikiPath);
    return { $tw, wikiInfo };
}
exports.loadWiki = loadWiki;
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
exports.loadCore = loadCore;
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
;
