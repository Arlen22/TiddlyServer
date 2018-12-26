import { treeWalkerOld, treeWalker, normalizeSettings, statWalkPath, resolvePath, ServerConfig, tryParseJSON, colors, NewTreeGroup, NewTreeItem } from './server-types';
import * as fs from 'fs';
const settingsString = fs.readFileSync(__dirname + "/../settings.json", 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
let settingsObj: ServerConfig = tryParseJSON<ServerConfig>(settingsString, (e) => {
	console.error(/*colors.BgWhite + */colors.FgRed + "The settings file could not be parsed: %s" + colors.Reset, e.originalError.message);
	console.error(e.errorPosition);
	throw "The settings file could not be parsed: Invalid JSON";
});

normalizeSettings(settingsObj as any, __dirname + "/test.json", []);

console.log(JSON.stringify(settingsObj, null, 2));
console.log(resolvePath(["dbx-media"], settingsObj.tree as any));
console.log(resolvePath(["dbx-media", "Hogan-NobleMen-01-SD.mp4"], settingsObj.tree as any));
console.log(resolvePath(["dbx-media", "THISFILEDOESNOTEXIST"], settingsObj.tree as any));
console.log(resolvePath(["projects", "fol"], settingsObj.tree as any));
console.log(resolvePath(["projects", "fol", "test file"], settingsObj.tree as any));
function str(char: string, len: number) {
	for (var s = ""; s.length < len; s += char);
	return s;
}
settingsObj.tree
type TreeItem = { $element: string, $children: TreeItem[] };
function buildHTML(tree: TreeItem, indent: number = 0) {
	let attrs = Object.keys(tree).filter(e => !e.startsWith("$")).map(k => k + "=\"" + tree[k] + "\"").join(' ');
	return str("  ", indent) + `<${tree.$element} ${attrs}>${tree.$children && ("\n" + tree.$children.map(e => buildHTML(e, indent + 1)).join("") + str("\t", indent)) || ""}</${tree.$element}>\n`
}
console.log(buildHTML(settingsObj.tree as any));