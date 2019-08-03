const { tryParseJSON } = require("./src/server-types");
const { ConvertSettings, OldDefaultSettings } = require('./src/server-config');
const fs = require('fs');
const path = require("path");

if(!ConvertSettings || !tryParseJSON || !OldDefaultSettings) throw "invalid imports";

console.log(`
============================================
==  Upgrade TiddlyServer from 2.0 to 2.1. ==
============================================

Syntax: node upgrade-settings.js old.json new.json

The new settings file must not exist.

useTW5path is always true in v2.1, meaning that
data folders are always loaded with a slash. If you 
still want to load datafolders without a trailing 
slash, set the noTrailingSlash property for the 
parent folder specified in the tree. 

`)

let errors = [
	!process.argv[2] || !process.argv[3],
	!fs.existsSync(process.argv[2]),
	fs.existsSync(process.argv[3])
];
if (errors.some(e => e)) {
	console.log("The conversion failed because: ");
	if (errors[0]) return console.log("  An old and new file must be specified");
  if (errors[1]) console.log("  The old file specified does not exist");
	if (errors[2]) console.log("  The new file specified already exists");
	return;
}

let settingsStr = fs.readFileSync(process.argv[2], "utf8");
let oldSettings = tryParseJSON(settingsStr, (err) => console.log(err));
OldDefaultSettings(oldSettings);
let newSettings = ConvertSettings(oldSettings);

// function convertTree(tree) {
// 	if (typeof tree === "string") {
// 		return tree
// 	} else if (typeof tree === "object") {
// 		Object.keys(tree).forEach(k => {
// 			tree[k] = convertTree(tree[k]);
// 		})
// 		return {
// 			$element: "group",
// 			$children: tree
// 		}
// 	}
// }

// newSettings.tree = convertTree(newSettings.tree);
delete newSettings._datafoldertarget;
delete newSettings._devmode;
let newpath = path.resolve(process.argv[3]);
fs.writeFileSync(newpath, JSON.stringify(newSettings, null, 2));

console.log("Successfully converted settings. The new file is \n" + newpath);

