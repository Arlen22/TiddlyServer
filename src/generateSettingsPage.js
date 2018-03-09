"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data = [
    { type: 0, name: "tree", valueType: "function", valueOptions: [treeFunction] },
    { type: 0, name: "types", valueType: "function", valueOptions: [typesFunction] },
    { type: 1, name: "host", valueType: "string" },
    { type: 1, name: "port", valueType: "number" },
    { type: 1, name: "username", valueType: "string" },
    { type: 1, name: "password", valueType: "string" },
    { type: 0, name: "backupDirectory", valueType: "string" },
    { type: 0, name: "etag", valueType: "enum-string", valueOptions: ["", "disabled", "required"] },
    { type: 0, name: "etagWindow", valueType: "number" },
    { type: 1, name: "useTW5path", valueType: "boolean" },
    { type: 0, name: "debugLevel", valueType: "enum-number", valueOptions: [4, 3, 2, 1, 0, -1, -2, -3, -4] },
    {
        type: 1,
        name: "allowNetwork",
        valueType: "hashmap-enum",
        valueOptions: [
            ["boolean"],
            ["mkdir", "upload", "settings", "WARNING_all_settings_WARNING"]
        ]
    },
];
const descriptions = {
    tree: "The mount structure of the server",
    types: "Specifies which extensions get used for each icon",
    host: "The IP address to listen on for requests. 0.0.0.0 listens on all IP addresses. "
        + "127.0.0.1 only listens on localhost. <br/>"
        + "TECHNICAL: 127.0.0.1 is always bound to even when another IP is specified.",
    port: "The port number to listen on.",
    username: "The basic auth username to use. Also forwarded to data folders for signing edits.",
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
        WARNING_all_settings_WARNING: "Allow network users to change critical settings: <br/>"
            + `<pre>${data.filter(e => e.type === 1).map(e => e.name).join(', ')}</pre>`
    },
    maxAge: "",
    tsa: "",
    _disableLocalHost: ""
};
function generateSettingsPage(settings, level) {
    return `<!doctype html>
<html>
<head>
<style>
dl.treelist {
	margin: 0;
}
</style>
<title></title>
</head>
<body>
${data.map(item => processItem(item, settings[item.name], item.type > level, descriptions[item.name])).join('<br/>\n')}
</body>
</html>
`;
}
exports.generateSettingsPage = generateSettingsPage;
// type settings = keyof ServerConfig;
function processItem(item, defValue, readonly, description) {
    const primitivesTypeMap = {
        "string": "text",
        "number": "number",
        "boolean": "checkbox"
    };
    const { valueType } = item;
    const valueTypeParts = valueType.split('-');
    if (item.valueType === "function") {
        if (!item.valueOptions)
            return "";
        else
            return `<fieldset><legend>${item.name}</legend>${item.valueOptions[0](defValue, [item.name], readonly, description)}</fieldset>`;
    }
    else if (item.valueType === "hashmap-enum") {
        if (!item.valueOptions)
            return "";
        if (valueTypeParts[1] === "enum") {
            const dataTypes = item.valueOptions[0];
            const valueOptions = item.valueOptions[1];
            return `<fieldset><legend>${item.name}</legend>${valueOptions.map((e, i) => `${processItem({ name: e, type: item.type, valueType: dataTypes[0] }, defValue[e], readonly, description[e])}`).join('\n')}</fieldset>`;
        }
    }
    else if (Object.keys(primitivesTypeMap).indexOf(item.valueType) > -1) {
        let type = primitivesTypeMap[item.valueType];
        return `<fieldset><legend>${item.name}</legend><input type="${type}" value="${defValue ? defValue.toString().replace(/"/g, "&dquot;") : ""}" name="${item.name}" ${readonly ? "disabled" : ""} /> ${description}</fieldset>`;
    }
    else if (item.valueType === "enum-number" || item.valueType === "enum-string") {
        if (!item.valueOptions)
            return "";
        return `
<fieldset><legend>${item.name}</legend>
<select name="${item.name}" value="" ${readonly ? "disabled" : ""}>
${item.valueOptions.map(e => `<option ${defValue === e ? "selected" : ""} value="${e}">${e}</option>`).join('\n')}
</select> ${description}
</fieldset>`;
    }
}
function treeFunction(defValue, keys) {
    let res = "";
    if (typeof defValue === "object") {
        res = `<dl class="treelist">${keys.length > 1 ? `<dt>${keys[keys.length - 1]}</dt>` : ""}\n`
            + Object.keys(defValue).map(e => `<dd>${treeFunction(defValue[e], keys.concat(e))}</dd>`).join('\n')
            + `</dl>`;
    }
    else {
        res = `<label>${keys[keys.length - 1]}</label>`;
        // + `<input type="text" value="${defValue.toString()}" x-data-tree-path="${keys.join('/')}" />`
    }
    return res;
}
function typesFunction(defValue, keys) {
    return `<dl class="treelist">${keys.length > 1 ? `<dt>${keys[keys.length - 1]}</dt>` : ""}\n`
        + Object.keys(defValue).map(e => `<dd>${e}<dl class="treelist">${defValue[e].map(f => `<dd>${f}</dd>`).join('')}</dl></dd>`).join('\n')
        + `</dl>`;
}
