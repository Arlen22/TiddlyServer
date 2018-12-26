"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const fs = require("fs");
const settingsString = fs.readFileSync(__dirname + "/../settings.json", 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
let settingsObj = server_types_1.tryParseJSON(settingsString, (e) => {
    console.error(/*colors.BgWhite + */ server_types_1.colors.FgRed + "The settings file could not be parsed: %s" + server_types_1.colors.Reset, e.originalError.message);
    console.error(e.errorPosition);
    throw "The settings file could not be parsed: Invalid JSON";
});
server_types_1.normalizeSettings(settingsObj, __dirname + "/test.json", []);
console.log(JSON.stringify(settingsObj, null, 2));
console.log(server_types_1.resolvePath(["dbx-media"], settingsObj.tree));
console.log(server_types_1.resolvePath(["dbx-media", "Hogan-NobleMen-01-SD.mp4"], settingsObj.tree));
console.log(server_types_1.resolvePath(["dbx-media", "THISFILEDOESNOTEXIST"], settingsObj.tree));
console.log(server_types_1.resolvePath(["projects", "fol"], settingsObj.tree));
console.log(server_types_1.resolvePath(["projects", "fol", "test file"], settingsObj.tree));
function str(char, len) {
    for (var s = ""; s.length < len; s += char)
        ;
    return s;
}
settingsObj.tree;
function buildHTML(tree, indent = 0) {
    let attrs = Object.keys(tree).filter(e => !e.startsWith("$")).map(k => k + "=\"" + tree[k] + "\"").join(' ');
    return str("  ", indent) + `<${tree.$element} ${attrs}>${tree.$children && ("\n" + tree.$children.map(e => buildHTML(e, indent + 1)).join("") + str("\t", indent)) || ""}</${tree.$element}>\n`;
}
console.log(buildHTML(settingsObj.tree));
