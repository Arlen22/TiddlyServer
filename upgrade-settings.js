const { ConvertSettings, tryParseJSON, NewDefaultSettings } = require('./src/server-types');
const fs = require('fs');

if (!process.argv[2] || !process.argv[3])
	return console.log("An old and new file must be specified");

if (!fs.existsSync(process.argv[2])) return console.log("The old file specified does not exist");
if (fs.existsSync(process.argv[3])) return console.log("The new file specified already exists");

let settingsStr = fs.readFileSync(process.argv[2], "utf8")
let oldSettings = tryParseJSON(settingsStr, (err) => console.log(err));
let newSettings = ConvertSettings(oldSettings);
newSettings = JSON.parse(JSON.stringify(newSettings));
newSettings = NewDefaultSettings(newSettings);
//override some settings during the upgrade
// newSettings.tiddlyserver.useTW5path = true;
console.log("useTW5path is now set to true")

function convertTree(tree) {
	if (typeof tree === "string") {
		return tree
	} else if (typeof tree === "object") {
		Object.keys(tree).forEach(k => {
			tree[k] = convertTree(tree[k]);
		})
		return {
			$element: "group",
			$children: tree
		}
	}
}

newSettings.tree = convertTree(newSettings.tree);

fs.writeFileSync(process.argv[3], JSON.stringify(newSettings, null, 2));
