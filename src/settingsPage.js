"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const rx_1 = require("../lib/rx");
const path_1 = require("path");
const fs_1 = require("fs");
let settings;
let eventer;
const debug = server_types_1.DebugLogger("APP SET");
let serveSettingsRoot;
let serveSettingsTree;
function serveAssets() {
    if (serveSettingsRoot)
        serveSettingsRoot.complete();
    if (serveSettingsTree)
        serveSettingsTree.complete();
    serveSettingsRoot = new rx_1.Subject();
    serveSettingsTree = new rx_1.Subject();
    server_types_1.serveFileObs(serveSettingsRoot.asObservable(), "settings-root.html", path_1.join(settings.__assetsDir, "settings-root")).subscribe();
    server_types_1.serveFileObs(serveSettingsTree.asObservable(), "settings-tree.html", path_1.join(settings.__assetsDir, "settings-tree")).subscribe();
}
function initSettings(e) {
    eventer = e;
    eventer.on('settings', (set) => {
        settings = set;
        serveAssets();
    });
    eventer.on('settingsChanged', (keys) => {
        if (keys.indexOf("__assetsDir") > -1)
            serveAssets();
    });
}
exports.initSettings = initSettings;
const data = [
    // { level: 1, name: "tree", fieldType: "subpage", handler: handleTreeSubpage },
    { level: 0, name: "types", fieldType: "function", validate: validateTypes },
    { level: 1, name: "host", fieldType: "string" },
    { level: 1, name: "port", fieldType: "number" },
    { level: 1, name: "username", fieldType: "string" },
    { level: 1, name: "password", fieldType: "string" },
    { level: 0, name: "backupDirectory", fieldType: "string" },
    {
        level: 0, name: "etag", fieldType: "enum",
        enumType: "string", enumOpts: ["", "disabled", "required"]
    },
    { level: 0, name: "etagWindow", fieldType: "number" },
    {
        level: 0, name: "debugLevel", fieldType: "enum",
        enumType: "number",
        enumOpts: [4, 3, 2, 1, 0, -1, -2, -3, -4]
    },
    { level: 0, name: "logAccess", fieldType: "ifenabled", valueType: "string" },
    { level: 0, name: "logError", fieldType: "string" },
    { level: 0, name: "logColorsToFile", fieldType: "boolean" },
    { level: 0, name: "logToConsoleAlso", fieldType: "boolean" },
    {
        level: 1,
        name: "allowNetwork",
        fieldType: "hashmapenum",
        enumType: "boolean",
        enumKeys: ["mkdir", "upload", "settings", "WARNING_all_settings_WARNING"],
    },
    {
        level: 1,
        name: "allowLocalhost",
        fieldType: "hashmapenum",
        enumType: "boolean",
        enumKeys: ["mkdir", "upload", "settings", "WARNING_all_settings_WARNING"],
    },
    { level: 1, name: "useTW5path", fieldType: "boolean" },
    { level: 0, name: "mixFolders", fieldType: "boolean" }
];
const accessOptions = (type) => {
    return {
        _: `Specifies which advanced and powerful features can be used by <strong>${type}</strong> users`,
        mkdir: `Allow ${type} users to create directories and datafolders.`,
        upload: `Allow ${type} users to upload files.`,
        settings: `Allow ${type} users to change non-critical settings.`,
        WARNING_all_settings_WARNING: `Allow ${type} users to change critical settings: `
            + `<code>${data.filter(e => e.level > 0).map(e => e.name).join(', ')}</code>`
    };
};
const descriptions = {
    tree: "The mount structure of the server",
    types: "Specifies which extensions get used for each icon",
    host: "The IP address to listen on for requests. 0.0.0.0 listens on all IP addresses. "
        + "127.0.0.1 only listens on localhost. <br/>"
        + "TECHNICAL: 127.0.0.1 is always bound to even when another IP is specified.",
    port: "The port number to listen on.",
    username: "The basic auth username to use (changes effective immediately). "
        + "Also forwarded to data folders for signing edits. "
        + "Active data folders will need to be reloaded for the new username to take effect.",
    password: "The basic auth password to use.",
    etag: "disabled (Don't check etags), "
        + "required (Require etags to be used), "
        + "&lt;not specified&gt; (only check etag if sent by the client)",
    etagWindow: "If the etag gets checked, allow a file to be saved if the etag is not stale by more than this many seconds.",
    backupDirectory: "The directory to save backup files in from single file wikis. Data folders are not backed up.",
    debugLevel: "Print out messages with this debug level or higher. <a href=\"https://github.com/Arlen22/TiddlyServer#debuglevel\">See the readme for more detail.</a>",
    useTW5path: "Mount data folders as the directory index (like NodeJS: /mydatafolder/) instead of as a file (like single-file wikis: /mydatafolder). It is recommended to leave this off unless you need it.",
    allowNetwork: accessOptions("network"),
    allowLocalhost: accessOptions("localhost"),
    logAccess: "If access log is enabled, set the log file to write all HTTP request logs to (may be the same as logError)",
    logError: "Log file to write all debug messages to (may be the same as logAccess)",
    logColorsToFile: "Log the console color markers to the file (helpful if read from the console later)",
    logToConsoleAlso: "Log all messages to console, even if logged to file",
    maxAge: "",
    tsa: "",
    mixFolders: "",
    _disableLocalHost: "",
    _devmode: "",
    __dirname: "READONLY: Directory of currently loaded settings file",
    __filename: "READONLY: Full file path of the currently loaded settings file",
    __assetsDir: ""
};
const primitives = ["string", "number", "boolean"];
function isPrimitive(a) {
    return primitives.indexOf(a.fieldType) > -1;
}
function testPrimitive(fieldType, value) {
    if (typeof value === fieldType)
        return { valid: true, value };
    else if (fieldType === "boolean") {
        switch (value) {
            case 1:
            case "yes":
            case "true":
                value = true;
                break;
            case 0:
            case "no":
            case "false":
                value = false;
                break;
        }
        return { valid: typeof value === "boolean", value };
    }
    else if (fieldType === "number") {
        let test;
        test = +value;
        return { valid: test === test, value: test };
    }
    else if (fieldType === "string") {
        try {
            return { valid: true, value: value.toString() };
        }
        catch (e) {
            return { valid: false, value };
        }
    }
    else {
        return { valid: false, value };
    }
}
function updateSettings(level, upd, current) {
    let allowdata = data.filter(e => +e.level <= level);
    debug(-1, 'updateSettings allowdata: length %s, level %s', allowdata.length, level);
    const valids = allowdata.map(item => {
        if (item.level > level)
            return { valid: false, changed: false };
        let key = item.name;
        let changed = false;
        if (isPrimitive(item) || item.fieldType === "ifenabled") {
            let { valid, value } = (item.fieldType === "ifenabled" && upd[key] === false)
                ? testPrimitive("boolean", false)
                : testPrimitive(item.fieldType === "ifenabled" ? item.valueType : item.fieldType, upd[key]);
            if (valid && (value !== current[key])) {
                current[key] = value;
                changed = true;
            }
            return { valid, changed };
        }
        else if (item.fieldType === "function") {
            let { valid, value, changed } = item.validate(level, JSON.parse(JSON.stringify(upd)), current);
            //depend on the function to tell us whether the setting changed
            if (valid && changed) {
                current[key] = value;
                changed = true;
            }
            return { valid, changed };
        }
        else if (item.fieldType === "subpage") {
            //subpage handlers take care of validation and saving.
            //if it's here, it shouldn't be.
            return { valid: false, changed: false };
        }
        else if (item.fieldType === "hashmapenum") {
            if (typeof current[key] !== "object")
                current[key] = {};
            if (typeof upd[key] === "undefined")
                return { valid: false, changed: false };
            return item.enumKeys.map(e => {
                let { valid, value } = testPrimitive(item.enumType, upd[key][e]);
                if (valid && (value !== current[key][e])) {
                    current[key][e] = value;
                    changed = true;
                }
                return { valid, changed };
            }).reduce((n, e) => {
                n.valid = e.valid && n.valid;
                n.changed = e.changed || n.changed;
                return n;
            }, { valid: true, changed: false });
        }
        else if (item.fieldType === "enum") {
            let { valid, value } = testPrimitive(item.enumType, upd[key]);
            if (valid && (current[key] !== value) && item.enumOpts.indexOf(value) > -1) {
                current[key] = value;
                changed = true;
                return { valid, changed };
            }
            else
                return { valid, changed };
        } /* else if (item.fieldType === "ifenabled") {
            let { valid, value } = (upd[key] === false)
                ? testPrimitive("boolean", false)
                : testPrimitive(item.valueType, upd[key]);
            if (valid) {
                if (current[key] !== (upd['isenabled_' + key] && value)) {
                    current[key] = (upd['isenabled_' + key] && value);
                    changed = true;
                }
            }
            return { valid, changed };
        } */
        else {
            //@ts-ignore because item has type never in this block
            debug(-2, "WARNING: updateSettings fieldType %s not found for item %s", item.fieldType, item.name);
            return { valid: false, changed: false };
        }
    });
    // console.log(allowdata.map((item, i) => [item.name, valids[i].valid, valids[i].changed]).join('\n'));
    let keys = [];
    let response = allowdata.map((item, i) => {
        let { valid, changed } = valids[i];
        if (changed)
            keys.push(item.name);
        return { key: item.name, valid, changed };
    });
    return { response, keys };
}
function validateTypes(level, upd, current) {
    return { valid: true, value: [], changed: false };
}
function handleSettings(state) {
    const allow = state.allow;
    const level = (allow.WARNING_all_settings_WARNING) ? 1 : (allow.settings ? 0 : -1);
    if (state.path[3] === "") {
        if (state.req.method === "GET") {
            if (state.url.query.action === "getdata" && state.req.method === "GET") {
                fs_1.readFile(settings.__filename, "utf8", (err, setfile) => {
                    let curjson = server_types_1.tryParseJSON(setfile, (err) => {
                        state.throwReason(500, "Settings file could not be accessed");
                    });
                    if (typeof curjson !== "undefined") {
                        server_types_1.OldDefaultSettings(curjson);
                        let set = {};
                        data.forEach(item => {
                            //don't send sensitive settings unless they are allowed
                            if (item.level > level)
                                return;
                            set[item.name] = curjson[item.name];
                        });
                        server_types_1.sendResponse(state, JSON.stringify({
                            level,
                            data,
                            descriptions,
                            settings: set,
                            currentPath: settings.__filename
                        }), {
                            contentType: "application/json",
                            doGzip: server_types_1.canAcceptGzip(state.req)
                        });
                    }
                });
            }
            else {
                serveSettingsRoot.next(state);
            }
        }
        else if (state.req.method === "PUT") {
            if (state.url.query.action === "update") {
                handleSettingsUpdate(state, level);
            }
            else
                state.throw(404);
        }
        else
            state.throw(405);
    }
    else if (typeof state.path[3] === "string") {
        let key;
        let subpages = data.filter((e) => e.fieldType === "subpage");
        let subIndex = subpages.map(e => e.name).indexOf(state.path[3]);
        if (subIndex === -1)
            return state.throw(404);
        let subpage = subpages[subIndex];
        if (subpage.level > level)
            return state.throw(403);
        subpage.handler(state);
    }
}
exports.handleSettings = handleSettings;
const DRYRUN_SETTINGS = false;
function handleSettingsUpdate(state, level) {
    state.recieveBody(true).concatMap(() => {
        if (typeof state.json === "undefined")
            return rx_1.Observable.empty();
        debug(1, "Settings PUT %s", JSON.stringify(state.json));
        return server_types_1.obs_readFile()(settings.__filename, "utf8");
    }).concatMap(r => {
        let [err, res] = r;
        let threw = false, curjson = server_types_1.tryParseJSON(res, (err) => {
            state.log(2, "Settings file could not be accessed").log(2, err.errorPosition).throw(500);
            threw = true;
        });
        if (threw || !curjson)
            return rx_1.Observable.empty();
        let { response, keys } = updateSettings(level, state.json, curjson);
        const tag = { curjson, keys, response };
        if (!DRYRUN_SETTINGS && keys.length) {
            let newfile = JSON.stringify(curjson, null, 2);
            return server_types_1.obs_writeFile(tag)(settings.__filename, newfile);
        }
        else {
            return rx_1.Observable.of([undefined, tag]);
            // return Observable.empty<never>();
        }
    }).subscribe(r => {
        const [error, { curjson, keys, response }] = r;
        // (error?: NodeJS.ErrnoException) => {
        if (error) {
            state.log(2, "Error writing settings file: %s %s\n%s", error.code, error.message, error.path).throw(500);
        }
        else {
            if (keys.length) {
                debug(-1, "New settings written to current settings file");
                server_types_1.normalizeSettings(curjson, settings.__filename);
                let consts = ["__assetsDir", "host", "port"];
                keys.forEach(k => {
                    if (consts.indexOf(k) > -1) {
                        debug(1, "%s will not be changed until the server is restarted", k);
                    }
                    else {
                        if (!DRYRUN_SETTINGS)
                            settings[k] = curjson[k];
                        debug(1, "update setting %s to %s", k, JSON.stringify(curjson[k]));
                    }
                });
                debug(-1, "== settingsChanged event emit ==\n%s", keys.map(k => `${k}: ${JSON.stringify(curjson[k])}\n`).join(''));
                if (DRYRUN_SETTINGS) {
                    debug(2, "DRYRUN_SETTINGS enabled");
                }
                eventer.emit('settingsChanged', keys);
            }
            else {
                debug(-1, "no keys to be written");
            }
            server_types_1.sendResponse(state, JSON.stringify(response), {
                contentType: "application/json",
                doGzip: server_types_1.canAcceptGzip(state.req)
            });
        }
    });
}
function handleTreeSubpage(state) {
    const allow = state.allow;
    const level = (allow.WARNING_all_settings_WARNING) ? 1 : (allow.settings ? 0 : -1);
    // we don't need to process anything here because the user will paste the new settings into 
    // settings.json and then restart the server. The best way to prevent unauthorized access
    // is to not build a door. If code running on the user's computer can't access the file system
    // then we shouldn't give it access through a server running on localhost by allowing it to add
    // tree items. Oh well, not much we can do about it knowing the current paths.
    if (state.req.method !== "GET")
        return state.throw(405);
    if (state.url.search === "") {
        serveSettingsTree.next(state);
    }
    else if (state.url.query.action === "getdata") {
        server_types_1.sendResponse(state, JSON.stringify({ level, settings }), {
            contentType: "application/json",
            doGzip: server_types_1.canAcceptGzip(state.req)
        });
    }
}
// function processItem(item: SettingsPageItemTypes, defValue: any, readonly: boolean, description: any) {
// 	const primitivesTypeMap = {
// 		"string": "text",
// 		"number": "number",
// 		"boolean": "checkbox"
// 	}
// 	const { valueType } = item;
// 	const valueTypeParts = valueType.split('-');
// 	if (item.valueType === "function") {
// 		// if (!item.valueOptions) return "";
// 		// else return `<fieldset><legend>${item.name}</legend>${
// 		// 	item.valueOptions[0](defValue as any, [item.name], readonly, description)
// 		// 	}</fieldset>`;
// 	} else if (item.valueType === "hashmapenum") {
// 		if (!item.valueOptions) return "";
// 		const dataTypes = item.valueOptions[0];
// 		const valueOptions = item.valueOptions[1];
// 		return `<fieldset><legend>${item.name}</legend>${valueOptions.map((e, i) => `${
// 			processItem({ name: e, type: item.type, valueType: dataTypes[0] }, defValue[e], readonly, description[e])
// 			}`).join('\n')}</fieldset>`;
// 	} else if (Object.keys(primitivesTypeMap).indexOf(item.valueType) > -1) {
// 		let type = primitivesTypeMap[item.valueType];
// 		return `<fieldset><legend>${item.name}</legend><input type="${type}" value="${
// 			defValue ? defValue.toString().replace(/"/g, "&dquot;") : ""
// 			}" name="${item.name}" ${readonly ? "disabled" : ""} /> ${description}</fieldset>`;
// 	} else if (item.valueType === "enum") {
// 		if (!item.valueOptions) return "";
// 		let options = item.valueOptions[1];
// 		let type = item.valueOptions[0];
// 		return `
// <fieldset><legend>${item.name}</legend>
// <select name="${item.name}" value="" ${readonly ? "disabled" : ""}>
// ${(options).map(e => `<option ${defValue === e ? "selected" : ""} value="${e}">${e}</option>`).join('\n')}
// </select> ${description}
// </fieldset>`;
// 	}
// }
// function treeGenerate(defValue: any, keys: string[]) {
// 	let res = "";
// 	let type = (val) =>
// 		`onclick="this.form.elements.tree.disabled=true;" ${(typeof defValue === val ? "checked" : "")}`;
// 	res += `<fieldset><legend>Root Mount Type</legend><label>`
// 		+ `<input type="radio" name="treeType" value="string" ${type("string")}/> Folder`
// 		+ `</label><label>`
// 		+ `<input type="radio" name="treeType" value="object" ${type("object")}/> Category`
// 		+ `</label></fieldset>`;
// 	if (typeof defValue === "object") {
// 		// res = `<dl class="treelist">${keys.length > 1 ? `<dt>${keys[keys.length - 1]}</dt>` : ""}\n`
// 		// 	+ Object.keys(defValue).map(e => `<dd>${treeFunction(defValue[e], keys.concat(e))}</dd>`).join('\n')
// 		// 	+ `</dl>`
// 		res += `<p>Add or remove folders in the directory index</p>`;
// 		res += `<input type="hidden" name="tree" value=""`;
// 	} else {
// 		res += `<br/><input type="text" name="tree" value="${defValue.toString()}"/>`
// 	}
// 	return res;
// }
// type TreeCheck = (boolean | [boolean, string])
// function treeValidate(post: Hashmap<string>) {
// 	let checks: TreeCheck[] = [post.treeType === "string" || post.treeType === "object"];
// 	let getChecks = () => checks.filter(e => {
// 		Array.isArray(e) ? !e[0] : !e;
// 	});
// 	return Observable.of({}).mergeMap(() => {
// 		if (post.treeType === "string") {
// 			checks.push([typeof post.tree === "string", "TREETYPE_CHANGED"]);
// 			let treePath = resolve(settings.__dirname, post.tree);
// 			return obs_stat()(treePath);
// 		} else {
// 			return Observable.of("true");
// 		}
// 	}).map((res) => {
// 		if (!Array.isArray(res)) return getChecks();
// 		let [err, stat, tag, filePath] = res;
// 		checks.push([!err, "The specified path does not exist"]);
// 		checks.push([
// 			stat.isDirectory() || stat.isFile(),
// 			"The specified path is not a directory or file."
// 		]);
// 		return getChecks();
// 	})
// }
// function treeSave(post: Hashmap<string>, checks: TreeCheck[]) {
// 	//OK, this whole tree thing is vulnerable to a critical attack
// 	//I drive myself crazy thinking of every single scenario.
// 	//Evil Villian: OK, let me make an Iframe that will load the 
// 	//              localhost page and then I will add a tree item
// 	//              pointing to the C:/ drive and download the 
// 	//              registry and passwords. 
// 	//https://security.stackexchange.com/a/29502/109521
// 	let ch = checks.filter(e => Array.isArray(e) && e[1] === "TREETYPE_CHANGED");
// 	let tt = typeof settings.tree === post.treeType;
// 	if (ch.length && checks.length === 1) {
// 		settings.tree = post.tree;
// 		eventer.emit("settings", settings);
// 	}
// }
// function typesFunction(defValue: any, keys: string[]) {
// 	// return `<dl class="treelist">${keys.length > 1 ? `<dt>${keys[keys.length - 1]}</dt>` : ""}\n`
// 	// 	+ Object.keys(defValue).map(e => `<dd>${e}<dl class="treelist">${defValue[e].map(f => `<dd>${f}</dd>`).join('')}</dl></dd>`).join('\n')
// 	// 	+ `</dl>`
// 	return `<dl>${Object.keys(defValue).map(e =>
// 		`<dt>${e}</dt><dd><input type="text" name="types-${e}" value=${JSON.stringify(defValue[e].join(', '))} /></dd>`
// 	)}</dl>`;
// }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3NQYWdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2V0dGluZ3NQYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaURBQXlQO0FBRXpQLGtDQUFnRDtBQUNoRCwrQkFBcUM7QUFDckMsMkJBQXVEO0FBRXZELElBQUksUUFBc0IsQ0FBQztBQUMzQixJQUFJLE9BQTJCLENBQUM7QUFFaEMsTUFBTSxLQUFLLEdBQUcsMEJBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUVyQyxJQUFJLGlCQUF1QyxDQUFDO0FBQzVDLElBQUksaUJBQXVDLENBQUM7QUFFNUM7SUFDQyxJQUFJLGlCQUFpQjtRQUFFLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3BELElBQUksaUJBQWlCO1FBQUUsaUJBQWlCLENBQUMsUUFBUSxFQUFFLENBQUM7SUFFcEQsaUJBQWlCLEdBQUcsSUFBSSxZQUFPLEVBQWUsQ0FBQztJQUMvQyxpQkFBaUIsR0FBRyxJQUFJLFlBQU8sRUFBZSxDQUFDO0lBRS9DLDJCQUFZLENBQUMsaUJBQWlCLENBQUMsWUFBWSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsV0FBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUM5SCwyQkFBWSxDQUFDLGlCQUFpQixDQUFDLFlBQVksRUFBRSxFQUFFLG9CQUFvQixFQUFFLFdBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7QUFFL0gsQ0FBQztBQUNELHNCQUE2QixDQUFDO0lBQzdCLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDWixPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFO1FBQzlCLFFBQVEsR0FBRyxHQUFHLENBQUM7UUFDZixXQUFXLEVBQUUsQ0FBQztJQUNmLENBQUMsQ0FBQyxDQUFDO0lBQ0gs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