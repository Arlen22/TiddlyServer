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
    return args.join(",");
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
        throw new Error("Missing $element property in " + keypath.join("."));
    if (a.$element === "auth") {
    }
    else if (a.$element === "putsaver") {
    }
    else if (a.$element === "index") {
    }
    else {
        let { $element } = a;
        throw new Error("Invalid element " + $element + " found at " + keypath.join("."));
    }
}
function normalizeTree(settingsDir, item, key, keypath) {
    // type k<T> = T extends "options" ? never : T;
    if (typeof item === "object" && !item.$element) {
        //@ts-ignore
        if (Object.keys(item).findIndex(e => e.startsWith("$")) !== -1)
            console.log("Is this a mistake? Found keys starting with the dollar sign under /" +
                keypath.join("/"));
        item = as({
            $element: "group",
            $children: item
        });
    }
    if (typeof item === "string" || item.$element === "folder") {
        if (typeof item === "string")
            item = { $element: "folder", path: item };
        if (!item.path)
            throw format("  Error loading settings: path must be specified for folder item under '%s'", keypath.join(", "));
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
            throw "key not provided for group element at /" + keypath.join("/");
        let tc = item.$children;
        let $options = [];
        let $children = [];
        if (Array.isArray(item.$children)) {
            $children = item.$children
                .filter((e) => {
                if (Config.isOption(e)) {
                    throw "specifying options in $children is unsupported at " +
                        keypath.join(".");
                }
                else {
                    return true;
                }
            })
                .map(e => normalizeTree(settingsDir, e, undefined, [...keypath, key]));
            item.$options && $options.push(...item.$options);
        }
        else {
            // let tc: Record<string, Schema.GroupElement | Schema.PathElement> = item.$children;
            if (item.$children.$options)
                throw "specifying options in $children is unsupported at " +
                    keypath.join(".");
            $children = Object.keys(tc)
                .map(k => k === "$options"
                ? undefined
                : normalizeTree(settingsDir, tc[k], k, [...keypath, k]))
                .filter((e) => !!e);
            $options = (e => {
                if (typeof e !== "undefined" && !Array.isArray(e))
                    throw "$options is not an array at " + keypath.join(".");
                return e || [];
            })(item.$options);
        }
        key = is(a => !!a.key, item) ? item.key : key;
        $options.forEach(e => normalizeOptions(keypath, e));
        return as({
            $element: "group",
            key,
            $children,
            $options,
            indexPath: item.indexPath
                ? pathResolveWithUser(settingsDir, item.indexPath)
                : false
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
    return Object.assign(Object.assign({}, host), { $mount: normalizeTree(settingsDir, host.$mount, "$mount", []) });
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
    else if (typeof tree === "string" &&
        (tree.endsWith(".js") || tree.endsWith(".json"))) {
        //require the json or js file and use it directly
        let filepath = pathResolveWithUser(settingsDir, tree);
        let nodeRequire = __non_webpack_require__
            ? __non_webpack_require__
            : require;
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
        localhost: Object.assign(Object.assign({}, as({
            writeErrors: true,
            mkdir: true,
            upload: true,
            websockets: true,
            registerNotice: true,
            putsaver: true,
            loginlink: true,
            transfer: false
        })), set.bindInfo.localAddressPermissions["localhost"]({})),
        "*": Object.assign(Object.assign({}, as({
            writeErrors: true,
            mkdir: false,
            upload: false,
            websockets: true,
            registerNotice: false,
            putsaver: true,
            loginlink: true,
            transfer: false
        })), set.bindInfo.localAddressPermissions["*"]({}))
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
        __targetTW: "",
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
            logToConsoleAlso: set.logging.logToConsoleAlso(true)
            // }
        },
        authAccounts: set.authAccounts({}),
        putsaver: {
            // ...{
            etagAge: set.putsaver.etagAge(3),
            backupFolder: set.putsaver.backupFolder(""),
            etag: set.putsaver.etag("optional"),
            enabled: set.putsaver.enabled(true),
            gzipBackups: set.putsaver.gzipBackups(true)
        },
        datafolder: set.datafolder({}),
        directoryIndex: {
            // ...{
            defaultType: set.directoryIndex.defaultType("html"),
            icons: Object.assign(Object.assign({}, set.directoryIndex.icons({})), { htmlfile: set.directoryIndex.icons["htmlfile"](["htm", "html"]) }),
            types: {},
            mixFolders: set.directoryIndex.mixFolders(true),
            mimetypes: {}
            // },
            // ...spread(set.directoryIndex)
        },
        // EXPERIMENTAL_clientside_datafolders: {
        //   // ...{
        //   enabled: set.EXPERIMENTAL_clientside_datafolders.enabled(false),
        //   alwaysRefreshCache: set.EXPERIMENTAL_clientside_datafolders.alwaysRefreshCache(true),
        //   maxAge_tw_plugins: set.EXPERIMENTAL_clientside_datafolders.maxAge_tw_plugins(0)
        //   // },
        //   // ...spread(set.EXPERIMENTAL_clientside_datafolders)
        // },
        authCookieAge: set.authCookieAge(2592000),
        maxTransferRequests: set.maxTransferRequests(0),
        $schema: "./settings.schema.json"
    };
    Object.keys(newset.directoryIndex.icons).forEach(type => {
        newset.directoryIndex.icons[type].forEach(ext => {
            if (!newset.directoryIndex.types[ext]) {
                newset.directoryIndex.types[ext] = type;
            }
            else {
                throw format("Multiple types for extension %s: %s", ext, newset.directoryIndex.types[ext], type);
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
    if (newset.putsaver &&
        newset.putsaver.etag === "disabled" &&
        !newset.putsaver.backupFolder) {
        console.log("Etag checking is disabled, but a backup folder is not set. " +
            "Changes made in multiple tabs/windows/browsers/computers can overwrite each " +
            "other with stale information. SAVED WORK MAY BE LOST IF ANOTHER WINDOW WAS OPENED " +
            "BEFORE THE WORK WAS SAVED. Instead of disabling Etag checking completely, you can " +
            "also set the etagWindow setting to allow files to be modified if not newer than " +
            "so many seconds from the copy being saved.");
    }
    return newset;
}
exports.normalizeSettings = normalizeSettings;
var Config;
(function (Config) {
    function isOption(a) {
        return (!!a.$element && ["auth", "backups", "index"].indexOf(a.$element) !== -1);
    }
    Config.isOption = isOption;
    function isElement(a) {
        return typeof a === "object" && typeof a["$element"] === "string";
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
    function define(name, val) { }
    function defstring(enumArr) {
        return {
            type: "string",
            enum: ["group"]
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
            htmlfile: ["htm", "html"]
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
            bindAddress: set.host === "0.0.0.0" || set.host === "::" ? undefined : [set.host],
            filterBindAddress: undefined,
            enableIPv6: set.host === "::",
            port: set.port,
            bindWildcard: set.host === "0.0.0.0" || set.host === "::",
            localAddressPermissions: {
                localhost: set.allowLocalhost,
                "*": set.allowNetwork
            },
            https: undefined,
            _bindLocalhost: set._disableLocalHost === false
        },
        logging: {
            logAccess: set.logAccess,
            logError: set.logError,
            logColorsToFile: set.logColorsToFile,
            logToConsoleAlso: set.logToConsoleAlso,
            debugLevel: set.debugLevel
        },
        putsaver: {
            etag: set.etag || "optional",
            etagAge: set.etagWindow,
            backupFolder: ""
        },
        datafolder: {},
        authAccounts: {},
        directoryIndex: {
            defaultType: "html",
            icons: set.types,
            mixFolders: set.mixFolders
            // types: {}
        },
        // EXPERIMENTAL_clientside_datafolders: (typeof set.tsa === "object" || typeof set.maxAge === "object") ? {
        //   enabled: false,
        //   alwaysRefreshCache: typeof set.tsa === "object" ? set.tsa.alwaysRefreshCache : true,
        //   maxAge_tw_plugins: typeof set.maxAge === "object" ? set.maxAge.tw_plugins : 0
        // } : undefined,
        authCookieAge: 2592000,
        $schema: "./settings-2-1.schema.json"
    };
}
exports.ConvertSettings = ConvertSettings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2ZXItY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsK0JBQStCO0FBQy9CLE1BQU0sSUFBSSxHQUEwQixPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFcEQsMkRBQXlDO0FBQ3pDLDRCQUE0QjtBQUM1QiwwREFBMEQ7QUFDMUQsS0FBSztBQUNMLHFFQUFxRTtBQUVyRSx5Q0FBeUM7QUFDekMsTUFBTTtBQUNOLDZCQUE2QjtBQUM3QiwrREFBK0Q7QUFDL0QsMkRBQTJEO0FBQzNELHVCQUF1QjtBQUN2QixRQUFRO0FBQ1IsT0FBTztBQUNQLE1BQU07QUFDTixvQ0FBb0M7QUFDcEMsU0FBUztBQUNULGdDQUFnQztBQUNoQyxrRUFBa0U7QUFDbEUsOERBQThEO0FBQzlELDBCQUEwQjtBQUMxQixXQUFXO0FBQ1gsVUFBVTtBQUNWLFNBQVM7QUFDVCxJQUFJO0FBQ0osa0NBQWtDO0FBRWxDLFNBQVMsTUFBTSxDQUFDLEdBQVcsRUFBRSxHQUFHLElBQVc7SUFDekMsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVDLEdBQUcsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2xCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4QixDQUFDO0FBQ0QsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ3hDLFNBQVMsbUJBQW1CLENBQUMsV0FBbUIsRUFBRSxHQUFXO0lBQzNELElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFH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