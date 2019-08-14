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
function as(obj) {
    return obj;
}
function normalizeTree(settingsDir, item, key, keypath) {
    // type k<T> = T extends "options" ? never : T;
    if (typeof item === "object" && !item.$element) {
        //@ts-ignore
        if (Object.keys(item).findIndex(e => e.startsWith("$")) !== -1)
            console.log("Is this a mistake? Found keys starting with the dollar sign under /" + keypath.join('/'));
        item = as({
            $element: "group",
            $children: item
        });
    }
    if (typeof item === "string" || item.$element === "folder") {
        if (typeof item === "string")
            item = { $element: "folder", path: item };
        if (!item.path)
            throw new Error(format("path must be specified for folder item under '%s'", keypath.join(', ')));
        item.path = pathResolveWithUser(settingsDir, item.path);
        key = key || path.basename(item.path);
        return as({
            $element: item.$element,
            $options: item.$options || [],
            path: item.path,
            key,
            noTrailingSlash: !!item.noTrailingSlash
        });
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
            item.$options && $options.push(...item.$options);
        }
        else {
            // let tc: Record<string, Schema.GroupElement | Schema.PathElement> = item.$children;
            $children = Object.keys(tc).map(k => k === "$options" ? undefined : normalizeTree(settingsDir, tc[k], k, [...keypath, k]))
                .filter((e) => !!e);
            $options = (e => {
                if (typeof e !== "undefined" && !Array.isArray(e))
                    throw "$options is not an array at " + keypath.join('.');
                return e || [];
            })(item.$options);
        }
        key = is(a => !!a.key, item) ? item.key : key;
        return as({
            $element: "group", key, $children, $options,
            indexPath: item.indexPath ? pathResolveWithUser(settingsDir, item.indexPath) : false
        });
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
    let lap = {
        "localhost": Object.assign({
            writeErrors: true,
            mkdir: true,
            upload: true,
            websockets: true,
            registerNotice: true
        }, set.bindInfo.localAddressPermissions["localhost"]({})),
        "*": Object.assign({
            writeErrors: true,
            mkdir: false,
            upload: false,
            websockets: true,
            registerNotice: false
        }, set.bindInfo.localAddressPermissions["*"]({}))
    };
    Object.keys(set.bindInfo.localAddressPermissions({})).forEach(k => {
        if (k === "localhost" || k === "*")
            return;
        lap[k] = set.bindInfo.localAddressPermissions[k](lap["*"]);
        Object.keys(lap["*"]).forEach(k2 => {
            if (lap[k][k2] === undefined)
                lap[k][k2] = lap["*"][k2];
        });
    });
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
            localAddressPermissions: lap,
            _bindLocalhost: set.bindInfo._bindLocalhost(false),
            https: !!set.bindInfo.https("")
            // },
            // ...spread(set.bindInfo),
            // ...{
            // 	https: !!(set.bindInfo && set.bindInfo.https)
            // }
        },
        logging: {
            // ...{
            debugLevel: set.logging.debugLevel(0),
            logAccess: set.logging.logAccess(""),
            logError: set.logging.logError(""),
            logColorsToFile: set.logging.logColorsToFile(false),
            logToConsoleAlso: set.logging.logToConsoleAlso(true),
        },
        authAccounts: set.authAccounts({}),
        putsaver: {
            // ...{
            etagWindow: set.putsaver.etagWindow(3),
            backupDirectory: set.putsaver.backupDirectory(""),
            etag: set.putsaver.etag("")
            // },
            // ...spread(set.putsaver),
            // ...{
            // 	etag: set.putsaver && set.putsaver.etag || ""
            // }
        },
        directoryIndex: {
            // ...{
            defaultType: set.directoryIndex.defaultType("html"),
            icons: Object.assign({}, set.directoryIndex.icons({}), { "htmlfile": set.directoryIndex.icons["htmlfile"](["htm", "html"]) }),
            types: {},
            mixFolders: set.directoryIndex.mixFolders(true),
            mimetypes: {}
            // },
            // ...spread(set.directoryIndex)
        },
        EXPERIMENTAL_clientside_datafolders: {
            // ...{
            enabled: set.EXPERIMENTAL_clientside_datafolders.enabled(false),
            alwaysRefreshCache: set.EXPERIMENTAL_clientside_datafolders.alwaysRefreshCache(true),
            maxAge_tw_plugins: set.EXPERIMENTAL_clientside_datafolders.maxAge_tw_plugins(0)
            // },
            // ...spread(set.EXPERIMENTAL_clientside_datafolders)
        },
        authCookieAge: set.authCookieAge(2592000),
        $schema: "./settings.schema.json"
    };
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
        // __assetsDir: set.__assetsDir,
        // __dirname: set.__dirname,
        // __filename: set.__filename,
        _devmode: set._devmode,
        _datafoldertarget: undefined,
        tree: set.tree,
        bindInfo: {
            bindAddress: (set.host === "0.0.0.0" || set.host === "::") ? undefined : [set.host],
            filterBindAddress: undefined,
            enableIPv6: set.host === "::",
            port: set.port,
            bindWildcard: set.host === "0.0.0.0" || set.host === "::",
            localAddressPermissions: {
                "localhost": set.allowLocalhost,
                "*": set.allowNetwork
            },
            https: undefined,
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
        },
        EXPERIMENTAL_clientside_datafolders: (typeof set.tsa === "object" || typeof set.maxAge === "object") ? {
            enabled: false,
            alwaysRefreshCache: typeof set.tsa === "object" ? set.tsa.alwaysRefreshCache : true,
            maxAge_tw_plugins: typeof set.maxAge === "object" ? set.maxAge.tw_plugins : 0
        } : undefined,
        authCookieAge: 2592000,
        $schema: "./settings-2-1.schema.json"
    };
}
exports.ConvertSettings = ConvertSettings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcnZlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwrQkFBK0I7QUFDL0IsTUFBTSxJQUFJLEdBQTBCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtBQUVuRCwyREFBeUM7QUFDekMsNEJBQTRCO0FBQzVCLDBEQUEwRDtBQUMxRCxLQUFLO0FBQ0wscUVBQXFFO0FBRXJFLHlDQUF5QztBQUN6QyxNQUFNO0FBQ04sNkJBQTZCO0FBQzdCLCtEQUErRDtBQUMvRCwyREFBMkQ7QUFDM0QsdUJBQXVCO0FBQ3ZCLFFBQVE7QUFDUixPQUFPO0FBQ1AsTUFBTTtBQUNOLG9DQUFvQztBQUNwQyxTQUFTO0FBQ1QsZ0NBQWdDO0FBQ2hDLGtFQUFrRTtBQUNsRSw4REFBOEQ7QUFDOUQsMEJBQTBCO0FBQzFCLFdBQVc7QUFDWCxVQUFVO0FBQ1YsU0FBUztBQUNULElBQUk7QUFDSixrQ0FBa0M7QUFFbEMsU0FBUyxNQUFNLENBQUMsR0FBVyxFQUFFLEdBQUcsSUFBVztJQUMxQyxPQUFPLElBQUksQ0FBQyxNQUFNLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0MsR0FBRyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbEIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLENBQUM7QUFDRCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDeEMsU0FBUyxtQkFBbUIsQ0FBQyxXQUFtQixFQUFFLEdBQVc7SUFDNUQsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztRQUFF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