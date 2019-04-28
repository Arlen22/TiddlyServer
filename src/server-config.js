"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** @type { import("path") } */
const path = require("path");
function format(str, ...args) {
    while (args.length && str.indexOf("%s") !== -1)
        str = str.replace("%s", args.shift());
    args.unshift(str);
    return args.join(',');
}
const homedir = require("os").homedir();
function normalizeTree(settingsDir, item, key, keypath) {
    // let t = item as NewTreeObjectSchemaItem;
    if (typeof item === "string" || item.$element === "folder") {
        if (typeof item === "string")
            item = { $element: "folder", path: item };
        if (!item.path)
            throw new Error(format("path must be specified for folder item under '%s'", keypath.join(', ')));
        if (item.path.startsWith("~"))
            item.path = path.join(homedir, item.path.slice(1));
        else
            item.path = path.resolve(settingsDir, item.path);
        key = key || path.basename(item.path);
        //the hashmap key overrides the key attribute if available
        return Object.assign({}, item, { key });
    }
    else if (item.$element === "group") {
        if (((a) => !a.key)(item)) {
            if (!key)
                throw new Error("No key specified for group element under " + keypath.join(', '));
        }
        else {
            key = item.key;
        }
        //at this point we only need the TreeHashmapGroup type since we already extracted the key
        let t = item;
        let tc = t.$children;
        if (typeof tc !== "object")
            throw new Error("Invalid $children under " + keypath.join(', '));
        return ({
            $element: "group", key,
            $children: Array.isArray(tc)
                ? tc.map(e => normalizeTree(settingsDir, e, undefined, keypath))
                : Object.keys(tc).filter(k => k !== "$children")
                    .map(k => normalizeTree(settingsDir, tc[k], k, [...keypath, k]))
                    .concat(tc.$children || [])
        });
    }
    else {
        return item;
    }
}
exports.normalizeTree = normalizeTree;
function normalizeSettingsTree(settingsDir, tree) {
    if (typeof tree === "string" && tree.endsWith(".xml")) {
        //read the xml file and parse it as the tree structure
    }
    else if (typeof tree === "string" && (tree.endsWith(".js") || tree.endsWith(".json"))) {
        //require the json or js file and use it directly
        let filepath = path.resolve(settingsDir, tree);
        return normalizeTree(path.dirname(filepath), require(filepath), "tree", []);
    }
    else {
        //otherwise just assume we're using the value itself
        return normalizeTree(settingsDir, tree, "tree", []);
    }
}
exports.normalizeSettingsTree = normalizeSettingsTree;
function normalizeSettingsAuthAccounts(auth) {
    if (!auth)
        return {};
    let newAuth = {};
    return newAuth;
}
exports.normalizeSettingsAuthAccounts = normalizeSettingsAuthAccounts;
function isObject(a) {
    return typeof a === "object";
}
function spread(a) {
    return typeof a === "object" ? a : {};
}
function normalizeSettings(set, settingsFile) {
    const settingsDir = path.dirname(settingsFile);
    if (!set.tree)
        throw "tree is required in ServerConfig";
    let hostLevelPermissions = Object.assign({
        "localhost": {
            writeErrors: true,
            mkdir: true,
            upload: true,
            settings: true,
            WARNING_all_settings_WARNING: false,
            websockets: true,
            registerNotice: true
        },
        "*": {
            writeErrors: true,
            mkdir: false,
            upload: false,
            settings: false,
            WARNING_all_settings_WARNING: false,
            websockets: true,
            registerNotice: false
        }
    }, spread(set.bindInfo && set.bindInfo.hostLevelPermissions));
    let newset = {
        __dirname: "",
        __filename: "",
        __assetsDir: "",
        _devmode: !!set._devmode,
        _datafoldertarget: set._datafoldertarget || "",
        tree: normalizeSettingsTree(settingsDir, set.tree),
        bindInfo: Object.assign({
            bindAddress: [],
            bindWildcard: false,
            enableIPv6: false,
            filterBindAddress: false,
            port: 8080,
            hostLevelPermissions,
            _bindLocalhost: false,
            https: false
        }, spread(set.bindInfo), {
            https: !!(set.bindInfo && set.bindInfo.https)
        }),
        logging: Object.assign({
            debugLevel: 0,
            logAccess: "",
            logError: "",
            logColorsToFile: false,
            logToConsoleAlso: true,
        }),
        authAccounts: spread(set.authAccounts),
        putsaver: Object.assign({
            etagWindow: 3,
            backupDirectory: "",
        }, spread(set.putsaver), {
            etag: set.putsaver && set.putsaver.etag || ""
        }),
        directoryIndex: Object.assign({
            defaultType: "html",
            icons: { "htmlfile": ["htm", "html"] },
            mixFolders: true
        }, spread(set.directoryIndex)),
        EXPERIMENTAL_clientside_datafolders: Object.assign({
            enabled: false,
            alwaysRefreshCache: true,
            maxAge_tw_plugins: 0
        }, spread(set.EXPERIMENTAL_clientside_datafolders)),
        authCookieAge: set.authCookieAge || 2592000,
        $schema: "./settings.schema.json"
    };
    // set second level object defaults
    if (newset.putsaver.backupDirectory)
        newset.putsaver.backupDirectory = path.resolve(settingsDir, newset.putsaver.backupDirectory);
    if (newset.logging.logAccess)
        newset.logging.logAccess = path.resolve(settingsDir, newset.logging.logAccess);
    if (newset.logging.logError)
        newset.logging.logError = path.resolve(settingsDir, newset.logging.logError);
    newset.__dirname = settingsDir;
    newset.__filename = settingsFile;
    if (newset.putsaver.etag === "disabled" && !newset.putsaver.backupDirectory) {
        console.log("Etag checking is disabled, but a backup folder is not set. "
            + "Changes made in multiple tabs/windows/browsers/computers can overwrite each "
            + "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED "
            + "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can "
            + "also set the etagWindow setting to allow files to be modified if not newer than "
            + "so many seconds from the copy being saved.");
    }
    return newset;
}
exports.normalizeSettings = normalizeSettings;
function OldDefaultSettings(set) {
    if (!set.port)
        set.port = 8080;
    if (!set.host)
        set.host = "127.0.0.1";
    if (!set.types)
        set.types = {
            "htmlfile": ["htm", "html"]
        };
    if (!set.etag)
        set.etag = "";
    if (!set.etagWindow)
        set.etagWindow = 0;
    if (!set.useTW5path)
        set.useTW5path = false;
    if (typeof set.debugLevel !== "number")
        set.debugLevel = -1;
    ["allowNetwork", "allowLocalhost"].forEach((key) => {
        if (!set[key])
            set[key] = {};
        if (!set[key].mkdir)
            set[key].mkdir = false;
        if (!set[key].upload)
            set[key].upload = false;
        if (!set[key].settings)
            set[key].settings = false;
        if (!set[key].WARNING_all_settings_WARNING)
            set[key].WARNING_all_settings_WARNING = false;
    });
    if (!set.logColorsToFile)
        set.logColorsToFile = false;
    if (!set.logToConsoleAlso)
        set.logToConsoleAlso = false;
    if (!set.maxAge)
        set.maxAge = {};
    if (typeof set.maxAge.tw_plugins !== "number")
        set.maxAge.tw_plugins = 60 * 60 * 24 * 365 * 1000; //1 year of milliseconds
}
exports.OldDefaultSettings = OldDefaultSettings;
function ConvertSettings(set) {
    return {
        __assetsDir: set.__assetsDir,
        __dirname: set.__dirname,
        __filename: set.__filename,
        _devmode: set._devmode,
        _datafoldertarget: "",
        tree: set.tree,
        bindInfo: {
            bindAddress: (set.host === "0.0.0.0" || set.host === "::") ? [] : [set.host],
            filterBindAddress: false,
            enableIPv6: set.host === "::",
            port: set.port,
            bindWildcard: set.host === "0.0.0.0" || set.host === "::",
            hostLevelPermissions: {
                "localhost": set.allowLocalhost,
                "*": set.allowNetwork
            },
            https: false,
            _bindLocalhost: set._disableLocalHost === false,
        },
        logging: {
            logAccess: set.logAccess,
            logError: set.logError,
            logColorsToFile: set.logColorsToFile,
            logToConsoleAlso: set.logToConsoleAlso,
            debugLevel: set.debugLevel,
        },
        putsaver: {
            etag: set.etag,
            etagWindow: set.etagWindow,
            backupDirectory: ""
        },
        authAccounts: {},
        directoryIndex: {
            defaultType: "html",
            icons: set.types,
            mixFolders: set.mixFolders
        },
        EXPERIMENTAL_clientside_datafolders: {
            enabled: false,
            alwaysRefreshCache: typeof set.tsa === "object" ? set.tsa.alwaysRefreshCache : true,
            maxAge_tw_plugins: typeof set.maxAge === "object" ? set.maxAge.tw_plugins : 0
        },
        authCookieAge: 2592000,
        $schema: "./settings.schema.json"
    };
}
exports.ConvertSettings = ConvertSettings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcnZlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwrQkFBK0I7QUFDL0IsTUFBTSxJQUFJLEdBQTBCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtBQUVuRCxTQUFTLE1BQU0sQ0FBQyxHQUFXLEVBQUUsR0FBRyxJQUFXO0lBQzFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QyxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDdkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNsQixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUNELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN4QyxTQUFnQixhQUFhLENBQUMsV0FBbUIsRUFBRSxJQUE0RCxFQUFFLEdBQXVCLEVBQUUsT0FBTztJQUNoSiwyQ0FBMkM7SUFDM0MsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxRQUFRLEVBQUU7UUFDM0QsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRO1lBQUUsSUFBSSxHQUFHLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFpQixDQUFDO1FBQ3ZGLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLG1EQUFtRCxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pILElBQUcsSUFBSSxDQUFD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