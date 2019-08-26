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
function normalizeOptions(keypath, a) {
    if (typeof a.$element !== "string")
        throw new Error("Missing $element property " + keypath.join('.'));
    if (a.$element === "auth") {
    }
    else if (a.$element === "putsaver") {
    }
    else if (a.$element === "index") {
    }
    else {
        let { $element } = a;
        throw new Error("Invalid element " + $element + " found at " + keypath.join('.'));
    }
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
        let $options = item.$options || [];
        $options.forEach(e => normalizeOptions(keypath, e));
        return as({
            $element: item.$element,
            $options,
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
                    throw "specifying options in $children is unsupported at " + keypath.join('.');
                }
                else {
                    return true;
                }
            }).map(e => normalizeTree(settingsDir, e, undefined, [...keypath, key]));
            item.$options && $options.push(...item.$options);
        }
        else {
            // let tc: Record<string, Schema.GroupElement | Schema.PathElement> = item.$children;
            if (item.$children.$options)
                throw "specifying options in $children is unsupported at " + keypath.join('.');
            $children = Object.keys(tc).map(k => k === "$options" ? undefined : normalizeTree(settingsDir, tc[k], k, [...keypath, k]))
                .filter((e) => !!e);
            $options = (e => {
                if (typeof e !== "undefined" && !Array.isArray(e))
                    throw "$options is not an array at " + keypath.join('.');
                return e || [];
            })(item.$options);
        }
        key = is(a => !!a.key, item) ? item.key : key;
        $options.forEach(e => normalizeOptions(keypath, e));
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
        let nodeRequire = __non_webpack_require__ ? __non_webpack_require__ : require;
        tree = nodeRequire(filepath).tree;
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
            etagAge: set.putsaver.etagAge(3),
            backupFolder: set.putsaver.backupFolder(""),
            etag: set.putsaver.etag("optional")
            // },
            // ...spread(set.putsaver),
            // ...{
            // 	etag: set.putsaver && set.putsaver.etag || ""
            // }
        },
        datafolder: set.datafolder({}),
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
    if (newset.putsaver && newset.putsaver.backupFolder)
        newset.putsaver.backupFolder = pathResolveWithUser(settingsDir, newset.putsaver.backupFolder);
    if (newset.logging.logAccess)
        newset.logging.logAccess = pathResolveWithUser(settingsDir, newset.logging.logAccess);
    if (newset.logging.logError)
        newset.logging.logError = pathResolveWithUser(settingsDir, newset.logging.logError);
    newset.__dirname = settingsDir;
    newset.__filename = settingsFile;
    if (newset.putsaver && newset.putsaver.etag === "disabled" && !newset.putsaver.backupFolder) {
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
            etag: set.etag || "optional",
            etagAge: set.etagWindow,
            backupFolder: "",
        },
        datafolder: {},
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