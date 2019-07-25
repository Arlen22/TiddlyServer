"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** @type { import("path") } */
const path = require("path");
const optional_chaining_1 = require("./optional-chaining");
// type AlwaysDefined<T> = {
// 	[P in keyof T]-?: T[P] extends {} ? T[P] : () => T[P];
// };
// function oc<T extends {}>(data: T): AlwaysDefined<T> & (() => T) {
// 	return new Proxy((() => data) as any,
// 		{
// 			get: (target, key) => {
// 				return typeof target[key] === "undefined" ? oc(oc.empty)
// 					: typeof target[key] === "object" ? oc(target[key])
// 						: target[key];
// 			},
// 		},
// 	);
// 	// return new Proxy(data as any,
// 	// 	{
// 	// 		get: (target, key) => {
// 	// 			return typeof target[key] === "undefined" ? oc(oc.empty)
// 	// 				: typeof target[key] === "object" ? oc(target[key])
// 	// 					: target[key];
// 	// 		},
// 	// 	},
// 	// );
// }
// oc.empty = Object.create(null);
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
function normalizeSettings(_set, settingsFile) {
    const settingsDir = path.dirname(settingsFile);
    let set = optional_chaining_1.oc(_set);
    // proxset.bindInfo
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
        _devmode: !!set._devmode(),
        _datafoldertarget: set._datafoldertarget() || "",
        tree: normalizeSettingsTree(settingsDir, set.tree()),
        bindInfo: {
            // ...{
            bindAddress: set.bindInfo.bindAddress([]),
            bindWildcard: set.bindInfo.bindWildcard(false),
            enableIPv6: set.bindInfo.enableIPv6(false),
            filterBindAddress: set.bindInfo.filterBindAddress(false),
            port: set.bindInfo.port(8080),
            localAddressPermissions: {
                "localhost": set.bindInfo.localAddressPermissions["localhost"]({
                    writeErrors: true,
                    mkdir: true,
                    upload: true,
                    // settings: true,
                    // WARNING_all_settings_WARNING: false,
                    websockets: true,
                    registerNotice: true
                }),
                "*": set.bindInfo.localAddressPermissions["*"]({
                    writeErrors: true,
                    mkdir: false,
                    upload: false,
                    // settings: false,
                    // WARNING_all_settings_WARNING: false,
                    websockets: true,
                    registerNotice: false
                })
            },
            _bindLocalhost: set.bindInfo._bindLocalhost(false),
            https: false
            // },
            // ...spread(set.bindInfo),
            // ...{
            // 	https: !!(set.bindInfo && set.bindInfo.https)
            // }
        },
        logging: {
            // ...{
            debugLevel: 0,
            logAccess: "",
            logError: "",
            logColorsToFile: false,
            logToConsoleAlso: true,
        },
        authAccounts: spread(set.authAccounts),
        putsaver: {
            // ...{
            etagWindow: 3,
            backupDirectory: "",
            etag: ""
            // },
            // ...spread(set.putsaver),
            // ...{
            // 	etag: set.putsaver && set.putsaver.etag || ""
            // }
        },
        directoryIndex: {
            // ...{
            defaultType: "html",
            icons: { "htmlfile": ["htm", "html"] },
            types: {},
            mixFolders: true
            // },
            // ...spread(set.directoryIndex)
        },
        EXPERIMENTAL_clientside_datafolders: {
            // ...{
            enabled: false,
            alwaysRefreshCache: true,
            maxAge_tw_plugins: 0
            // },
            // ...spread(set.EXPERIMENTAL_clientside_datafolders)
        },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcnZlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwrQkFBK0I7QUFDL0IsTUFBTSxJQUFJLEdBQTBCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtBQUVuRCwyREFBeUM7QUFDekMsNEJBQTRCO0FBQzVCLDBEQUEwRDtBQUMxRCxLQUFLO0FBQ0wscUVBQXFFO0FBRXJFLHlDQUF5QztBQUN6QyxNQUFNO0FBQ04sNkJBQTZCO0FBQzdCLCtEQUErRDtBQUMvRCwyREFBMkQ7QUFDM0QsdUJBQXVCO0FBQ3ZCLFFBQVE7QUFDUixPQUFPO0FBQ1AsTUFBTTtBQUNOLG9DQUFvQztBQUNwQyxTQUFTO0FBQ1QsZ0NBQWdDO0FBQ2hDLGtFQUFrRTtBQUNsRSw4REFBOEQ7QUFDOUQsMEJBQTBCO0FBQzFCLFdBQVc7QUFDWCxVQUFVO0FBQ1YsU0FBUztBQUNULElBQUk7QUFDSixrQ0FBa0M7QUFFbEMsU0FBUyxNQUFNLENBQUMsR0FBVyxFQUFFLEdBQUcsSUFBVztJQUMxQyxPQUFPLElBQUksQ0FBQyxNQUFNLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0MsR0FBRyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbEIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLENBQUM7QUFDRCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDeEMsU0FBUyxtQkFBbUIsQ0FBQyxXQUFtQixFQUFFLEdBQVc7SUFDNUQsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztRQUFF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