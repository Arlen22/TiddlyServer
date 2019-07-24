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
    // type k<T> = T extends "options" ? never : T;
    if (typeof item === "object" && !item.$element) {
        //@ts-ignore
        if (Object.keys(item).findIndex(e => e.startsWith("$")) !== -1)
            console.log("Is this a mistake? Found keys starting with the dollar sign under /" + keypath.join('/'));
        item = {
            $element: "group",
            $children: item
        };
    }
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
            throw "key not provided for group element at /" + keypath.join('/');
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
            if (typeof item.$children.$options !== "undefined" && !Array.isArray(item.$children.$options))
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
    return Object.assign({}, host, { $mount: normalizeTree(settingsDir, host.$mount, "$mount", []) });
}
exports.normalizeTreeHost = normalizeTreeHost;
function normalizeSettingsTree(settingsDir, tree) {
    let defaultHost = (tree2) => ({
        $element: "host",
        // patterns: {
        // 	"ipv4": ["0.0.0.0/0"],
        // 	"domain": ["*"]
        // },
        // includeSubdomains: true,
        $mount: normalizeTree(settingsDir, tree2, "$mount", [])
    });
    if (typeof tree === "string" && tree.endsWith(".xml")) {
        //read the xml file and parse it as the tree structure
    }
    else if (typeof tree === "string" && (tree.endsWith(".js") || tree.endsWith(".json"))) {
        //require the json or js file and use it directly
        let filepath = pathResolveWithUser(settingsDir, tree);
        tree = require(filepath).tree;
    }
    //otherwise just assume we're using the value itself.
    //we are not implementing host-based routing yet. If TiddlyServer is 
    //loaded as a module, the tree may be added to after the settings file
    //has been normalized and the preflighter may specify any index in the 
    //host array.
    return [defaultHost(tree)];
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
    let localAddressPermissions = Object.assign({
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
    }, spread(set.bindInfo && set.bindInfo.localAddressPermissions));
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
            localAddressPermissions,
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
            types: {},
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
    newset.directoryIndex.types = {};
    Object.keys(newset.directoryIndex.icons).forEach(type => {
        newset.directoryIndex.icons[type].forEach(ext => {
            if (!newset.directoryIndex.types[ext]) {
                newset.directoryIndex.types[ext] = type;
            }
            else {
                throw format('Multiple types for extension %s: %s', ext, newset.directoryIndex.types[ext], type);
            }
        });
    });
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
var Schema;
(function (Schema) {
    function define(name, val) {
    }
    function defstring(enumArr) {
        return {
            "type": "string",
            "enum": ["group"]
        };
    }
})(Schema = exports.Schema || (exports.Schema = {}));
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
            localAddressPermissions: {
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
            mixFolders: set.mixFolders,
            types: {}
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcnZlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwrQkFBK0I7QUFDL0IsTUFBTSxJQUFJLEdBQTBCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtBQUVuRCxTQUFTLE1BQU0sQ0FBQyxHQUFXLEVBQUUsR0FBRyxJQUFXO0lBQzFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QyxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDdkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNsQixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUNELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN4QyxTQUFTLG1CQUFtQixDQUFDLFdBQW1CLEVBQUUsR0FBVztJQUM1RCxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O1FBQzVELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUNELFNBQVMsRUFBRSxDQUFJLElBQThCLEVBQUUsQ0FBTTtJQUNwRCxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixDQUFDO0FBb0JELFNBQWdCLGFBQWEsQ0FBQyxXQUFXLEVBQUUsSUFBNEIsRUFBRSxHQUFHLEVBQUUsT0FBTztJQUNwRiwrQ0FB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