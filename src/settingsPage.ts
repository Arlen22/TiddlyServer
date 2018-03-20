import { ServerConfig, StateObject, Hashmap, obs_stat, serveFile, sendResponse, canAcceptGzip, recieveBody, DebugLogger, ServerEventEmitter, tryParseJSON, normalizeSettings, obs_readFile, obs_writeFile } from "./server-types";
import { EventEmitter } from "events";
import { Observable, Subject } from "../lib/rx";
import { resolve, join } from "path";
import { readFileSync, readFile, writeFile } from "fs";

let settings: ServerConfig;
let eventer: ServerEventEmitter;

const debug = DebugLogger("APP SET");

let serveSettingsRoot: Subject<StateObject>;
let serveSettingsTree: Subject<StateObject>;

function serveAssets() {
	if (serveSettingsRoot) serveSettingsRoot.complete();
	if (serveSettingsTree) serveSettingsTree.complete();

	serveSettingsRoot = new Subject<StateObject>();
	serveSettingsTree = new Subject<StateObject>();

	serveFile(serveSettingsRoot.asObservable(), "settings-root.html", join(settings.__assetsDir, "settings-root")).subscribe();
	serveFile(serveSettingsTree.asObservable(), "settings-tree.html", join(settings.__assetsDir, "settings-tree")).subscribe();

}
export function initSettings(e) {
	eventer = e;
	eventer.on('settings', (set) => {
		settings = set;
		serveAssets();
	});
	eventer.on('settingsChanged', (keys) => {
		if (keys.indexOf("__assetsDir") > -1) serveAssets();
	})
}
type primitive = "string" | "number" | "boolean";
type SettingsPageItem = {
	level: 0 | 1 | 2,
	name: keyof ServerConfig,
};
type ValueType_function = {
	valueType: "function",
	validate: (level: number, upd: ServerConfig, current: ServerConfig) => { valid: boolean, value: any, changed: boolean }
} & SettingsPageItem;
type ValueType_primitive = {
	valueType: primitive
} & SettingsPageItem;
type ValueType_enum = {
	valueType: "enum",
	enumType: primitive,
	enumOpts: any[]
	// valueOptions: ["number" | "string", (number | string)[]]
} & SettingsPageItem;
type ValueType_hashmapenum = {
	valueType: "hashmapenum",
	enumType: primitive,
	enumKeys: string[]
} & SettingsPageItem;
type ValueType_subpage = {
	valueType: "subpage",
	handler: (state: StateObject) => void;
} & SettingsPageItem;
type SettingsPageItemTypes = ValueType_function | ValueType_enum | ValueType_hashmapenum | ValueType_primitive | ValueType_subpage;
const data: (SettingsPageItemTypes)[] = [
	{ level: 1, name: "tree", valueType: "subpage", handler: handleTreeSubpage },
	{ level: 0, name: "types", valueType: "function", validate: validateTypes },
	{ level: 1, name: "host", valueType: "string" },
	{ level: 1, name: "port", valueType: "number" },
	{ level: 1, name: "username", valueType: "string" },
	{ level: 1, name: "password", valueType: "string" },
	{ level: 0, name: "backupDirectory", valueType: "string" },
	{
		level: 0, name: "etag", valueType: "enum",
		enumType: "string", enumOpts: ["", "disabled", "required"]
	},
	{ level: 0, name: "etagWindow", valueType: "number" },
	{ level: 1, name: "useTW5path", valueType: "boolean" },
	{
		level: 0, name: "debugLevel", valueType: "enum",
		enumType: "number",
		enumOpts: [4, 3, 2, 1, 0, -1, -2, -3, -4]
	},
	{
		level: 1,
		name: "allowNetwork",
		valueType: "hashmapenum",
		enumType: "boolean",
		enumKeys: ["mkdir", "upload", "settings", "WARNING_all_settings_WARNING"],
	},
];

const descriptions: {[K in keyof ServerConfig]: any} = {
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
	allowNetwork: {
		mkdir: "Allow network users to create directories and datafolders.",
		upload: "Allow network users to upload files.",
		settings: "Allow network users to change non-critical settings.",
		WARNING_all_settings_WARNING: "Allow network users to change critical settings: "
			+ `<code>${data.filter(e => e.level > 0).map(e => e.name).join(', ')}</code>`
	},
	maxAge: "",
	tsa: "",
	_disableLocalHost: "",
	__dirname: "READONLY: Directory of currently loaded settings file",
	__filename: "READONLY: Full file path of the currently loaded settings file",
	__assetsDir: ""
}

const primitives = ["string", "number", "boolean"];
function isPrimitive(a): a is ValueType_primitive {
	return primitives.indexOf(a.valueType) > -1;
}
function testPrimitive(valueType: "string" | "number" | "boolean", value: any): { valid: boolean, value: any } {
	if (typeof value === valueType)
		return { valid: true, value };
	else if (valueType === "boolean") {
		switch (value) {
			case 1:
			case "yes":
			case "true": value = true; break;
			case 0:
			case "no":
			case "false": value = false; break;
		}
		return { valid: typeof value === "boolean", value }
	} else if (valueType === "number") {
		let test: any;
		test = +value;
		return { valid: test === test, value: test }
	} else if (valueType === "string") {
		try {
			return { valid: true, value: value.toString() }
		} catch (e) {
			return { valid: false, value };
		}
	} else {
		return { valid: false, value }
	}
}

function updateSettings(level: number, upd: ServerConfig, current: ServerConfig) {
	let allowdata = data.filter(e => +e.level <= level);
	const valids = allowdata.map(item => {
		if (item.level > level) return { valid: false, changed: false };
		let key = item.name;
		let changed = false;
		if (isPrimitive(item)) {
			let { valid, value } = testPrimitive(item.valueType, upd[key]);
			if (valid && (value !== current[key])) { current[key] = value; changed = true; }
			return { valid, changed };
		} else if (item.valueType === "function") {
			let { valid, value, changed } = item.validate(level, JSON.parse(JSON.stringify(upd)), current);
			//depend on the function to tell us whether the setting changed
			if (valid && changed) { current[key] = value; changed = true; }
			return { valid, changed };
		} else if (item.valueType === "subpage") {
			//subpage handlers take care of validation and saving.
			//if it's here, it shouldn't be.
			return { valid: false, changed: false };
		} else if (item.valueType === "hashmapenum") {
			if (typeof current[key] !== "object") current[key] = {};
			return item.enumKeys.map(e => {
				let { valid, value } = testPrimitive(item.enumType, upd[key]);
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
		} else if (item.valueType === "enum") {
			let { valid, value } = testPrimitive(item.enumType, upd[key]);
			if (valid && (current[key] !== value) && item.enumOpts.indexOf(value) > -1) {
				current[key] = value;
				changed = true;
				return { valid, changed };
			} else
				return { valid, changed };
		} else {
			return { valid: false, changed: false };
		}
	});

	let keys: (keyof ServerConfig)[] = [];
	let response = allowdata.map((item, i) => {
		let { valid, changed } = valids[i];
		if (changed) keys.push(item.name);
		return { key: item.name, valid, changed };
	})
	return { response, keys };
}
function validateTypes(level: number, upd: ServerConfig, current: ServerConfig) {
	return { valid: true, value: [], changed: false };
}
export function handleSettings(state: StateObject) {
	let level = (state.isLocalHost || settings.allowNetwork.WARNING_all_settings_WARNING) ? 1
		: (settings.allowNetwork.settings ? 0 : -1);

	if (state.path[3] === "") {
		if (state.req.method === "GET") {
			if (state.url.query.action === "getdata" && state.req.method === "GET") {

				readFile(settings.__filename, "utf8", (err, setfile) => {
					let curjson = tryParseJSON(setfile, (err) => {
						state.throw(500, "Settings file could not be accessed");
					})
					if (typeof curjson !== "undefined") {
						let set = {};
						data.forEach(item => {
							// if(item.level > level) return;
							set[item.name] = settings[item.name];
						})
						sendResponse(state.res, JSON.stringify({ level, data, descriptions, settings: set }), {
							contentType: "application/json",
							doGzip: canAcceptGzip(state.req)
						})
					}
				});
			} else {
				serveSettingsRoot.next(state);
			}
		} else if (state.req.method === "PUT") {
			if (state.url.query.action === "update") {
				handleSettingsUpdate(state, level);
			} else state.throw(404);
		} else state.throw(405);
	} else if (typeof state.path[3] === "string") {
		let key: string;
		let subpages = data.filter((e): e is ValueType_subpage => e.valueType === "subpage");
		let subIndex = subpages.map(e => e.name).indexOf(state.path[3] as any)
		if (subIndex === -1)
			return state.throw(404);
		let subpage = subpages[subIndex];
		if (subpage.level > level)
			return state.throw(403);
		subpage.handler(state);
	}

}
const DRYRUN_SETTINGS = true;
function handleSettingsUpdate(state: StateObject, level: number) {
	state.recieveBody(true).concatMap(() => {
		if (typeof state.json === "undefined") return Observable.empty<never>();
		debug(1, "Settings PUT %s", JSON.stringify(state.json));
		return obs_readFile()(settings.__filename, "utf8");
	}).concatMap(r => {
		let [err, res] = r
		let threw = false, curjson = tryParseJSON<ServerConfig>(res, (err) => {
			state.throw(500, "Settings file could not be accessed");
			threw = true
		});
		if (threw || !curjson) return Observable.empty<never>();
		let { response, keys } = updateSettings(level, state.json, curjson);
		const tag = { curjson, keys, response };
		if (!DRYRUN_SETTINGS && keys.length) {
			let newfile = JSON.stringify(curjson, null, 2);
			return obs_writeFile(tag)(settings.__filename, newfile);
		} else {
			return Observable.of([undefined, tag] as [undefined, typeof tag]);
			// return Observable.empty<never>();
		}
	}).subscribe(r => {
		const [error, { curjson, keys, response }] = r;
		// (error?: NodeJS.ErrnoException) => {
		if (error) {
			state.log(2, "Error writing settings file: %s %s\n%s",
				error.code, error.message, error.path).throw(500);
		} else {
			if (keys.length) {
				debug(1, "New settings written to current settings file");
				normalizeSettings(curjson, settings.__filename);
				if (!DRYRUN_SETTINGS) {
					let consts: (keyof ServerConfig)[] = ["__assetsDir", "host", "port"];
					keys.forEach(k => {
						if (consts.indexOf(k) > -1)
							debug(1, "%s will not be changed until the server is restarted", k);
						else
							settings[k] = curjson[k];
					});
				}
				debug(-1, "== settingsChanged event emit ==\n%s",
					keys.map(k => `${k}: ${JSON.stringify(curjson[k])}\n`).join('')
				);
				if (DRYRUN_SETTINGS) debug(1, "DRYRUN_SETTINGS enabled");
				eventer.emit('settingsChanged', keys as any);
			}

			sendResponse(state.res, JSON.stringify(response), {
				contentType: "application/json",
				doGzip: canAcceptGzip(state.req)
			});
		}
	})
}
function handleTreeSubpage(state: StateObject) {
	let level = (state.isLocalHost || settings.allowNetwork.WARNING_all_settings_WARNING) ? 1
		: (settings.allowNetwork.settings ? 0 : -1);
	// we don't need to process anything here because the user will paste the new settings into 
	// settings.json and then restart the server. The best way to prevent unauthorized access
	// is to not build a door. If code running on the user's computer can't access the file system
	// then we shouldn't give it access through a server running on localhost by allowing it to add
	// tree items. Oh well, not much we can do about it knowing the current paths.
	if (state.req.method !== "GET")
		return state.throw(405);
	if (state.url.search === "") {
		serveSettingsTree.next(state);
	} else if (state.url.query.action === "getdata") {
		sendResponse(state.res, JSON.stringify({ level, settings }), {
			contentType: "application/json",
			doGzip: canAcceptGzip(state.req)
		})
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
