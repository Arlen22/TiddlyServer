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
function is(test, b) {
    return test(b);
}
function normalizeTree(settingsDir, item, key, keypath) {
    if (typeof item === "string" || item.$element === "folder") {
        if (typeof item === "string")
            item = { $element: "folder", path: item };
        if (!item.path)
            throw new Error(format("path must be specified for folder item under '%s'", keypath.join(', ')));
        item.path = pathResolveWithUser(settingsDir, item.path);
        key = key || path.basename(item.path);
        return Object.assign({}, item, { key });
    }
    else if (item.$element === "group") {
        if (!key)
            key = item.key;
        if (!key)
            throw "key not provided for group element at " + keypath.join(',');
        let tc = item.$children;
        let $options = [];
        let $children = [];
        if (Array.isArray(item.$children)) {
            $children = item.$children.filter((e) => {
                if (Config.isOption(e)) {
                    $options.push(e);
                    return false;
                }
                else {
                    return true;
                }
            }).map(e => normalizeTree(settingsDir, e, undefined, keypath));
        }
        else {
            // let tc: Record<string, Schema.GroupElement | Schema.PathElement> = item.$children;
            $children = Object.keys(tc).map(k => k === "$options" ? undefined : normalizeTree(settingsDir, tc[k], k, [...keypath, k]))
                .filter((e) => !!e);
            if (!Array.isArray(item.$children.$options))
                throw "$options is not an array at " + keypath.join('.');
            $options = item.$children.$options;
        }
        key = is(a => !!a.key, item) ? item.key : key;
        return ({ $element: "group", key, $children, $options });
    }
    else {
        return item;
    }
}
exports.normalizeTree = normalizeTree;
function normalizeTreeHost(settingsDir, host) {
    if (host.$element !== "host")
        throw "Tree array must not mix host elements with other elements";
    return Object.assign({}, host, { $mount: normalizeTree(settingsDir, host.$mount, undefined, []) });
}
exports.normalizeTreeHost = normalizeTreeHost;
function normalizeSettingsTree(settingsDir, tree) {
    let defaultHost = (tree2) => ({
        $element: "host",
        patterns: {
            "ipv4": ["0.0.0.0/0"],
            "domain": ["*"]
        },
        includeSubdomains: true,
        $mount: normalizeTree(settingsDir, tree2, undefined, [])
    });
    if (typeof tree === "string" && tree.endsWith(".xml")) {
        //read the xml file and parse it as the tree structure
    }
    else if (typeof tree === "string" && (tree.endsWith(".js") || tree.endsWith(".json"))) {
        //require the json or js file and use it directly
        let filepath = pathResolveWithUser(settingsDir, tree);
        tree = require(filepath).tree;
    }
    //otherwise just assume we're using the value itself
    if (Array.isArray(tree) && typeof tree[0] === "object" && tree[0].$element === "host") {
        let hosts = tree;
        hosts.map(host => normalizeTreeHost(settingsDir, host));
        return hosts;
    }
    else {
        return [defaultHost(tree)];
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
var Config;
(function (Config) {
    function isOption(a) {
        return !!a.$element && ["auth", "backups", "index"].indexOf(a.$element) !== -1;
    }
    Config.isOption = isOption;
    function isElement(a) {
        return (typeof a === "object" && typeof a["$element"] === "string");
    }
    Config.isElement = isElement;
    function isGroup(a) {
        return isElement(a) && a.$element === "group";
    }
    Config.isGroup = isGroup;
    function isPath(a) {
        return isElement(a) && a.$element === "folder";
    }
    Config.isPath = isPath;
})(Config = exports.Config || (exports.Config = {}));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcnZlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwrQkFBK0I7QUFDL0IsTUFBTSxJQUFJLEdBQTBCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtBQUVuRCxTQUFTLE1BQU0sQ0FBQyxHQUFXLEVBQUUsR0FBRyxJQUFXO0lBQzFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QyxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDdkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNsQixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUNELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN4QyxTQUFTLG1CQUFtQixDQUFDLFdBQW1CLEVBQUUsR0FBVztJQUM1RCxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O1FBQzVELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUNELFNBQVMsRUFBRSxDQUFJLElBQThCLEVBQUUsQ0FBTTtJQUNwRCxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixDQUFDO0FBb0JELFNBQWdCLGFBQWEsQ0FBQyxXQUFXLEVBQUUsSUFBNEIsRUFBRSxHQUFHLEVBQUUsT0FBTztJQUVwRixJQUFJ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