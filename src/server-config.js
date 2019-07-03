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
function pathResolveWithUser(settingsDir, str) {
    if (str.startsWith("~"))
        return path.join(homedir, str.slice(1));
    else
        return path.resolve(settingsDir, str);
}
function normalizeTree(settingsDir, item, key, keypath) {
    // let t = item as NewTreeObjectSchemaItem;
    if (typeof item === "string" || item.$element === "folder") {
        if (typeof item === "string")
            item = { $element: "folder", path: item };
        if (!item.path)
            throw new Error(format("path must be specified for folder item under '%s'", keypath.join(', ')));
        item.path = pathResolveWithUser(settingsDir, item.path);
        // if (item.path.startsWith("~")) item.path = path.join(homedir, item.path.slice(1));
        // else item.path = path.resolve(settingsDir, item.path);
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
            indexPath: t.indexPath ? pathResolveWithUser(settingsDir, t.indexPath) : undefined,
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
        let filepath = pathResolveWithUser(settingsDir, tree);
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
        newset.putsaver.backupDirectory = pathResolveWithUser(settingsDir, newset.putsaver.backupDirectory);
    if (newset.logging.logAccess)
        newset.logging.logAccess = pathResolveWithUser(settingsDir, newset.logging.logAccess);
    if (newset.logging.logError)
        newset.logging.logError = pathResolveWithUser(settingsDir, newset.logging.logError);
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
        $schema: "./settings-2-1.schema.json"
    };
}
exports.ConvertSettings = ConvertSettings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcnZlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwrQkFBK0I7QUFDL0IsTUFBTSxJQUFJLEdBQTBCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtBQUVuRCxTQUFTLE1BQU0sQ0FBQyxHQUFXLEVBQUUsR0FBRyxJQUFXO0lBQzFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QyxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDdkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNsQixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUNELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN4QyxTQUFTLG1CQUFtQixDQUFDLFdBQW1CLEVBQUUsR0FBVztJQUM1RCxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O1FBQzVELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUNELFNBQWdCLGFBQWEsQ0FBQyxXQUFtQixFQUFFLElBQTRELEVBQUUsR0FBdUIsRUFBRSxPQUFPO0lBQ2hKLDJDQUEyQztJQUMzQyxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRTtRQUMzRCxJQUFJLE9B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