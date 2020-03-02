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
        throw new Error("Missing $element property in " + keypath.join('.'));
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
            throw format("  Error loading settings: path must be specified for folder item under '%s'", keypath.join(', '));
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
        "localhost": Object.assign(Object.assign({}, as({
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
            logToConsoleAlso: set.logging.logToConsoleAlso(true),
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
            icons: Object.assign(Object.assign({}, set.directoryIndex.icons({})), { "htmlfile": set.directoryIndex.icons["htmlfile"](["htm", "html"]) }),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2ZXItY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsK0JBQStCO0FBQy9CLE1BQU0sSUFBSSxHQUEwQixPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7QUFFbkQsMkRBQXlDO0FBQ3pDLDRCQUE0QjtBQUM1QiwwREFBMEQ7QUFDMUQsS0FBSztBQUNMLHFFQUFxRTtBQUVyRSx5Q0FBeUM7QUFDekMsTUFBTTtBQUNOLDZCQUE2QjtBQUM3QiwrREFBK0Q7QUFDL0QsMkRBQTJEO0FBQzNELHVCQUF1QjtBQUN2QixRQUFRO0FBQ1IsT0FBTztBQUNQLE1BQU07QUFDTixvQ0FBb0M7QUFDcEMsU0FBUztBQUNULGdDQUFnQztBQUNoQyxrRUFBa0U7QUFDbEUsOERBQThEO0FBQzlELDBCQUEwQjtBQUMxQixXQUFXO0FBQ1gsVUFBVTtBQUNWLFNBQVM7QUFDVCxJQUFJO0FBQ0osa0NBQWtDO0FBRWxDLFNBQVMsTUFBTSxDQUFDLEdBQVcsRUFBRSxHQUFHLElBQVc7SUFDekMsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVDLEdBQUcsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2xCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4QixDQUFDO0FBQ0QsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ3hDLFNBQVMsbUJBQW1CLENBQUMsV0FBbUIsRUFBRSxHQUFXO0lBQzNELElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUM7UUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7UUFDNUQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBQ0QsU0FBUyxFQUFFLENBQUksSUFBOEIsRUFBRSxDQUFNO0lBQ25ELE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLENBQUM7QUFDRCxTQUFTLEVBQUUsQ0FBSSxHQUFNO0lBQ25CLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsT0FBaUIsRUFBRSxDQUFxQztJQUNoRixJQUFJLE9BQU8sQ0FBQyxDQUFDLFFBQVEsS0FBSyxRQUFRO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFekcsSUFBSSxDQUFDLENBQUMsUUFBUSxLQUFLLE1BQU0sRUFBRTtLQUUxQjtTQUFNLElBQUksQ0FBQyxDQUFDLFFBQVEsS0FBSyxVQUFVLEVBQUU7S0FFckM7U0FBTSxJQUFJLENBQUMsQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFO0tBRWxDO1NBQU07UUFDTCxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLEdBQUcsUUFBUSxHQUFHLFlBQVksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDbkY7QUFDSCxDQUFDO0FBb0JELFNBQWdCLGFBQWEsQ0FBQyxXQUFXLEVBQUUsSUFBNEIsRUFBRSxHQUFHLEVBQUUsT0FBaUI7SUFDN0YsK0NBQStDO0lBQy9DLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUM5QyxZQUFZO1FBQ1osSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDNUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxRUFBcUUsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDekcsSUFBSSxHQUFHLEVBQUUsQ0FBc0I7WUFDN0IsUUFBUSxFQUFFLE9BQU87WUFDakIsU0FBUyxFQUFFLElBQVc7U0FDdkIsQ0FBQyxDQUFDO0tBQ0o7SUFDRCxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRTtRQUMxRCxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVE7WUFBRSxJQUFJLEdBQUcsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQXdCLENBQUM7UUFDOUYsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQUUsTUFBTSxNQUFNLENBQUMsNkVBQTZFLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2hJLElBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4RCxHQUFHLEdBQUcsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RDLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ25DLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRCxPQUFPLEVBQUUsQ0FBcUI7WUFDNUIsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3ZCLFFBQVE7WUFDUixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixHQUFHO1lBQ0gsZUFBZSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZTtTQUN4QyxDQUFDLENBQUM7S0FDSjtTQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxPQUFPLEVBQUU7UUFDcEMsSUFBSSxDQUFDLEdBQUc7WUFBRSxHQUFHLEdBQUksSUFBaUMsQ0FBQyxHQUFHLENBQUM7UUFDdkQsSUFBSSxDQUFDLEdBQUc7WUFBRSxNQUFNLHlDQUF5QyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDOUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN4QixJQUFJLFFBQVEsR0FBNEIsRUFBRSxDQUFDO1FBQzNDLElBQUksU0FBUyxHQUFpRCxFQUFFLENBQUM7UUFDakUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUNqQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFNLEVBQTJELEVBQUU7Z0JBQ3BHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRTtvQkFDdEIsTUFBTSxvREFBb0QsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2lCQUNoRjtxQkFBTTtvQkFDTCxPQUFPLElBQUksQ0FBQztpQkFDYjtZQUNILENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEdBQUcsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6RSxJQUFJLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDbEQ7YUFBTTtZQUNMLHFGQUFxRjtZQUNyRixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUTtnQkFBRSxNQUFNLG9EQUFvRCxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDNUcsU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUN2SCxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQThCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEQsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2QsSUFBSSxPQUFPLENBQUMsS0FBSyxXQUFXLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsTUFBTSw4QkFBOEIsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUMzRCxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDakIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ25CO1FBQ0QsR0FBRyxHQUFHLEVBQUUsQ0FBMkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQ3hFLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRCxPQUFPLEVBQUUsQ0FBc0I7WUFDN0IsUUFBUSxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLFFBQVE7WUFDM0MsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUs7U0FDckYsQ0FBQyxDQUFDO0tBQ0o7U0FBTTtRQUNMLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFDSCxDQUFDO0FBNURELHNDQTREQztBQUNELFNBQWdCLGlCQUFpQixDQUFDLFdBQW1CLEVBQUUsSUFBd0I7SUFDN0UsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLE1BQU07UUFBRSxNQUFNLDJEQUEyRCxDQUFDO0lBQ2hHLHVDQUFZLElBQUksS0FBRSxNQUFNLEVBQUUsYUFBYSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsTUFBYSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsSUFBRztBQUMzRixDQUFDO0FBSEQsOENBR0M7QUFDRCxTQUFnQixxQkFBcUIsQ0FBQyxXQUFtQixFQUFFLElBQWdDO0lBQ3pGLElBQUksV0FBVyxHQUFHLENBQUMsS0FBVSxFQUFzQixFQUFFLENBQUMsQ0FBQztRQUNyRCxRQUFRLEVBQUUsTUFBTTtRQUNoQixjQUFjO1FBQ2QsMEJBQTBCO1FBQzFCLG1CQUFtQjtRQUNuQixLQUFLO1FBQ0wsMkJBQTJCO1FBQzNCLE1BQU0sRUFBRSxhQUFhLENBQUMsV0FBVyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDO0tBQ3hELENBQUMsQ0FBQztJQUNILElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDckQsc0RBQXNEO0tBRXZEO1NBQU0sSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRTtRQUN2RixpREFBaUQ7UUFDakQsSUFBSSxRQUFRLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3RELElBQUksV0FBVyxHQUFHLHVCQUF1QixDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQzlFLElBQUksR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDO0tBQ25DO0lBQ0QscURBQXFEO0lBQ3JELHFFQUFxRTtJQUNyRSxzRUFBc0U7SUFDdEUsdUVBQXVFO0lBQ3ZFLGFBQWE7SUFDYixPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFFN0IsQ0FBQztBQTFCRCxzREEwQkM7QUFDRCxTQUFnQiw2QkFBNkIsQ0FBQyxJQUF3QztJQUNwRixJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ3JCLElBQUksT0FBTyxHQUFpQyxFQUFFLENBQUM7SUFFL0MsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQztBQUxELHNFQUtDO0FBR0QsU0FBUyxRQUFRLENBQUMsQ0FBQztJQUNqQixPQUFPLE9BQU8sQ0FBQyxLQUFLLFFBQVEsQ0FBQztBQUMvQixDQUFDO0FBQ0QsU0FBUyxNQUFNLENBQUMsQ0FBTTtJQUNwQixPQUFPLE9BQU8sQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDeEMsQ0FBQztBQUNELFNBQWdCLGlCQUFpQixDQUFDLElBQXdCLEVBQUUsWUFBWTtJQUN0RSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQy9DLElBQUksR0FBRyxHQUFHLHNCQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkIsbUJBQW1CO0lBQ25CLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSTtRQUFFLE1BQU0sa0NBQWtDLENBQUM7SUFDeEQsSUFBSSxHQUFHLEdBQUc7UUFDUixXQUFXLGtDQUNOLEVBQUUsQ0FBNkI7WUFDaEMsV0FBVyxFQUFFLElBQUk7WUFDakIsS0FBSyxFQUFFLElBQUk7WUFDWCxNQUFNLEVBQUUsSUFBSTtZQUNaLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLFFBQVEsRUFBRSxJQUFJO1lBQ2QsU0FBUyxFQUFFLElBQUk7WUFDZixRQUFRLEVBQUUsS0FBSztTQUNoQixDQUFDLEdBQ0MsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFTLENBQUMsQ0FDaEU7UUFDRCxHQUFHLGtDQUNFLEVBQUUsQ0FBNkI7WUFDaEMsV0FBVyxFQUFFLElBQUk7WUFDakIsS0FBSyxFQUFFLEtBQUs7WUFDWixNQUFNLEVBQUUsS0FBSztZQUNiLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLGNBQWMsRUFBRSxLQUFLO1lBQ3JCLFFBQVEsRUFBRSxJQUFJO1lBQ2QsU0FBUyxFQUFFLElBQUk7WUFDZixRQUFRLEVBQUUsS0FBSztTQUNoQixDQUFDLEdBQ0MsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFTLENBQUMsQ0FDeEQ7S0FDRixDQUFDO0lBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ2hFLElBQUksQ0FBQyxLQUFLLFdBQVcsSUFBSSxDQUFDLEtBQUssR0FBRztZQUFFLE9BQU87UUFDM0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDM0QsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFDakMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssU0FBUztnQkFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFELENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDSCxJQUFJLE1BQU0sR0FBaUI7UUFDekIsU0FBUyxFQUFFLEVBQUU7UUFDYixVQUFVLEVBQUUsRUFBRTtRQUNkLFdBQVcsRUFBRSxFQUFFO1FBQ2YsVUFBVSxFQUFFLEVBQUU7UUFDZCxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7UUFDMUIsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLGlCQUFpQixFQUFFLElBQUksRUFBRTtRQUNoRCxJQUFJLEVBQUUscUJBQXFCLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQVMsQ0FBQztRQUMzRCxRQUFRLEVBQUU7WUFDUixPQUFPO1lBQ1AsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztZQUN6QyxZQUFZLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1lBQzlDLFVBQVUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUM7WUFDMUMsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUM7WUFDeEQsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztZQUM3Qix1QkFBdUIsRUFBRSxHQUFHO1lBQzVCLGNBQWMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUM7WUFDbEQsS0FBSyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDL0IsS0FBSztZQUNMLDJCQUEyQjtZQUMzQixPQUFPO1lBQ1AsaURBQWlEO1lBQ2pELElBQUk7U0FDTDtRQUNELE9BQU8sRUFBRTtZQUNQLE9BQU87WUFDUCxVQUFVLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ3JDLFNBQVMsRUFBRSxHQUFHLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDcEMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUNsQyxlQUFlLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDO1lBQ25ELGdCQUFnQixFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDO1NBRXJEO1FBQ0QsWUFBWSxFQUFFLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQ2xDLFFBQVEsRUFBRTtZQUNSLE9BQU87WUFDUCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFlBQVksRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDM0MsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUNuQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ25DLFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7U0FDNUM7UUFDRCxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDOUIsY0FBYyxFQUFFO1lBQ2QsT0FBTztZQUNQLFdBQVcsRUFBRSxHQUFHLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7WUFDbkQsS0FBSyxrQ0FDQSxHQUFHLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FDL0IsVUFBVSxFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQ2xFO1lBQ0QsS0FBSyxFQUFFLEVBQUU7WUFDVCxVQUFVLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQy9DLFNBQVMsRUFBRSxFQUFFO1lBQ2IsS0FBSztZQUNMLGdDQUFnQztTQUNqQztRQUNELHlDQUF5QztRQUN6QyxZQUFZO1FBQ1oscUVBQXFFO1FBQ3JFLDBGQUEwRjtRQUMxRixvRkFBb0Y7UUFDcEYsVUFBVTtRQUNWLDBEQUEwRDtRQUMxRCxLQUFLO1FBQ0wsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3pDLG1CQUFtQixFQUFFLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7UUFDL0MsT0FBTyxFQUFFLHdCQUF3QjtLQUNsQyxDQUFBO0lBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUN0RCxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDOUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUNyQyxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUM7YUFDekM7aUJBQU07Z0JBQ0wsTUFBTSxNQUFNLENBQUMscUNBQXFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ2xHO1FBQ0gsQ0FBQyxDQUFDLENBQUE7SUFDSixDQUFDLENBQUMsQ0FBQztJQUdILElBQUksTUFBTSxDQUFDLFFBQVEsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQVk7UUFDakQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDaEcsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVM7UUFDMUIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDeEYsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVE7UUFDekIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFdEYsTUFBTSxDQUFDLFNBQVMsR0FBRyxXQUFXLENBQUM7SUFDL0IsTUFBTSxDQUFDLFVBQVUsR0FBRyxZQUFZLENBQUM7SUFFakMsSUFBSSxNQUFNLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLFVBQVUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFO1FBQzNGLE9BQU8sQ0FBQyxHQUFHLENBQUMsNkRBQTZEO2NBQ3JFLDhFQUE4RTtjQUM5RSxvRkFBb0Y7Y0FDcEYsb0ZBQW9GO2NBQ3BGLGtGQUFrRjtjQUNsRiw0Q0FBNEMsQ0FBQyxDQUFDO0tBQ25EO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQTVJRCw4Q0E0SUM7QUFvV0QsSUFBaUIsTUFBTSxDQWtHdEI7QUFsR0QsV0FBaUIsTUFBTTtJQTJEckIsU0FBZ0IsUUFBUSxDQUFDLENBQU07UUFDN0IsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNqRixDQUFDO0lBRmUsZUFBUSxXQUV2QixDQUFBO0lBQ0QsU0FBZ0IsU0FBUyxDQUFDLENBQU07UUFDOUIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRmUsZ0JBQVMsWUFFeEIsQ0FBQTtJQUNELFNBQWdCLE9BQU8sQ0FBQyxDQUFNO1FBQzVCLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDO0lBQ2hELENBQUM7SUFGZSxjQUFPLFVBRXRCLENBQUE7SUFDRCxTQUFnQixNQUFNLENBQUMsQ0FBTTtRQUMzQixPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQztJQUNqRCxDQUFDO0lBRmUsYUFBTSxTQUVyQixDQUFBO0FBNEJILENBQUMsRUFsR2dCLE1BQU0sR0FBTixjQUFNLEtBQU4sY0FBTSxRQWtHdEI7QUFDRCxJQUFpQixNQUFNLENBNkV0QjtBQTdFRCxXQUFpQixNQUFNO0lBU3JCLFNBQVMsTUFBTSxDQUFDLElBQVksRUFBRSxHQUFRO0lBRXRDLENBQUM7SUFDRCxTQUFTLFNBQVMsQ0FBQyxPQUFrQjtRQUNuQyxPQUFPO1lBQ0wsTUFBTSxFQUFFLFFBQVE7WUFDaEIsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDO1NBQ2xCLENBQUE7SUFDSCxDQUFDO0FBNERILENBQUMsRUE3RWdCLE1BQU0sR0FBTixjQUFNLEtBQU4sY0FBTSxRQTZFdEI7QUErSUQsU0FBZ0Isa0JBQWtCLENBQUMsR0FBb0I7SUFDckQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJO1FBQUUsR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFDL0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJO1FBQUUsR0FBRyxDQUFDLElBQUksR0FBRyxXQUFXLENBQUM7SUFDdEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLO1FBQUUsR0FBRyxDQUFDLEtBQUssR0FBRztZQUMxQixVQUFVLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO1NBQzVCLENBQUE7SUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUk7UUFBRSxHQUFHLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUM3QixJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVU7UUFBRSxHQUFHLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQztJQUN4QyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVU7UUFBRSxHQUFHLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUM1QyxJQUFJLE9BQU8sR0FBRyxDQUFDLFVBQVUsS0FBSyxRQUFRO1FBQUUsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUU1RCxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQVcsRUFBRSxFQUFFO1FBQ3pELElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO1lBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQVMsQ0FBQztRQUNwQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUs7WUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUM1QyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU07WUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztRQUM5QyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVE7WUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUNsRCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLDRCQUE0QjtZQUN4QyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsNEJBQTRCLEdBQUcsS0FBSyxDQUFDO0lBQ2xELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlO1FBQUUsR0FBRyxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7SUFDdEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0I7UUFBRSxHQUFHLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO0lBRXhELElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTtRQUFFLEdBQUcsQ0FBQyxNQUFNLEdBQUcsRUFBUyxDQUFDO0lBQ3hDLElBQUksT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLFVBQVUsS0FBSyxRQUFRO1FBQzNDLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyx3QkFBd0I7QUFDL0UsQ0FBQztBQTFCRCxnREEwQkM7QUFFRCxTQUFnQixlQUFlLENBQUMsR0FBb0I7SUFDbEQsT0FBTztRQUNMLGdDQUFnQztRQUNoQyw0QkFBNEI7UUFDNUIsOEJBQThCO1FBQzlCLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUTtRQUN0QixpQkFBaUIsRUFBRSxTQUFTO1FBQzVCLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtRQUNkLFFBQVEsRUFBRTtZQUNSLFdBQVcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ25GLGlCQUFpQixFQUFFLFNBQVM7WUFDNUIsVUFBVSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEtBQUssSUFBSTtZQUM3QixJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUk7WUFDZCxZQUFZLEVBQUUsR0FBRyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxJQUFJO1lBQ3pELHVCQUF1QixFQUFFO2dCQUN2QixXQUFXLEVBQUUsR0FBRyxDQUFDLGNBQWM7Z0JBQy9CLEdBQUcsRUFBRSxHQUFHLENBQUMsWUFBWTthQUN0QjtZQUNELEtBQUssRUFBRSxTQUFTO1lBQ2hCLGNBQWMsRUFBRSxHQUFHLENBQUMsaUJBQWlCLEtBQUssS0FBSztTQUNoRDtRQUNELE9BQU8sRUFBRTtZQUNQLFNBQVMsRUFBRSxHQUFHLENBQUMsU0FBUztZQUN4QixRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVE7WUFDdEIsZUFBZSxFQUFFLEdBQUcsQ0FBQyxlQUFlO1lBQ3BDLGdCQUFnQixFQUFFLEdBQUcsQ0FBQyxnQkFBZ0I7WUFDdEMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVO1NBQzNCO1FBQ0QsUUFBUSxFQUFFO1lBQ1IsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLElBQUksVUFBVTtZQUM1QixPQUFPLEVBQUUsR0FBRyxDQUFDLFVBQVU7WUFDdkIsWUFBWSxFQUFFLEVBQUU7U0FDakI7UUFDRCxVQUFVLEVBQUUsRUFBRTtRQUNkLFlBQVksRUFBRSxFQUFFO1FBQ2hCLGNBQWMsRUFBRTtZQUNkLFdBQVcsRUFBRSxNQUFNO1lBQ25CLEtBQUssRUFBRSxHQUFHLENBQUMsS0FBSztZQUNoQixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVU7U0FFM0I7UUFDRCwyR0FBMkc7UUFDM0csb0JBQW9CO1FBQ3BCLHlGQUF5RjtRQUN6RixrRkFBa0Y7UUFDbEYsaUJBQWlCO1FBQ2pCLGFBQWEsRUFBRSxPQUFPO1FBQ3RCLE9BQU8sRUFBRSw0QkFBNEI7S0FDdEMsQ0FBQTtBQUNILENBQUM7QUFqREQsMENBaURDIn0=