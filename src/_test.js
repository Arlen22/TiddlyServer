"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const fs = require("fs");
let testFolderChildren = [
    { $element: "authPassword", username: "testuser", password: "********" }
];
function strong(a) {
    return a;
}
let TreeItemArray = strong([
    "test/test1string",
    ...strong([
        { $element: "folder", key: "test1_named", path: "test/test1" },
        { $element: "folder", path: "test/test1" },
        { $element: "folder", key: "test2_named", path: "test/test2", $children: testFolderChildren },
        { $element: "folder", path: "test/test2", $children: testFolderChildren }
    ]),
    ...strong([{
            $element: "group", key: "test/group1", $children: [
                { $element: "folder", path: "test/test5" },
                { $element: "folder", path: "test/test6", $children: testFolderChildren },
                { $element: "folder", key: "test1_named", path: "test/test5" },
                { $element: "folder", key: "test2_named", path: "test/test6", $children: testFolderChildren },
            ]
        }])
]);
let TreeItemObjectChildObject = {
    "test6_1": { $element: "folder", path: "test/test6/child1" },
    "test6_2": { $element: "folder", path: "test/test6/child2", $children: testFolderChildren }
};
let TreeItemObject = strong({
    test1: "test/test1",
    test2: "test/test2",
    test3: { $element: "folder", path: "test/test3" },
    test4: { $element: "folder", path: "test/test4", $children: testFolderChildren },
    test5: { $element: "group", $children: TreeItemArray },
    test6: { $element: "group", $children: TreeItemObjectChildObject }
});
// let testGroupChildren: NewTreeItem[] = 
const settingsString = fs.readFileSync(__dirname + "/../settings.json", 'utf8').replace(/\t/gi, '    ').replace(/\r\n/gi, '\n');
const folderTag = "folder";
const groupTag = "group";
let tree1 = {
    $element: "group",
    $children: TreeItemArray
};
let tree2 = {
    $element: "group",
    $children: {
        test1: "test/test1",
        test2: "test/test2",
        test3: { $element: "folder", path: "test/test3" },
        test4: { $element: "folder", path: "test/test4", $children: testFolderChildren },
        test5: { $element: "group", $children: TreeItemArray },
        test6: { $element: "group", $children: TreeItemObject },
    }
    // 	...strong<NewTreePathSchema[]>([
    // 	{ $element: "folder", key: "test1_named", path: "test/test1" },
    // 	{ $element: "folder", path: "test/test1" },
    // 	{ $element: "folder", key: "test2_named", path: "test/test2", $children: testFolderChildren },
    // 	{ $element: "folder", path: "test/test2", $children: testFolderChildren }
    // ]),
    // ...strong<NewTreeGroupSchema[]>([{
    // 	$element: "group", key: "test/group1", $children: [
    // 		{ $element: "folder", path: "test/test5" },
    // 		{ $element: "folder", path: "test/test6", $children: testFolderChildren },
    // 		{ $element: "folder", key: "test1_named", path: "test/test5" },
    // 		{ $element: "folder", key: "test2_named", path: "test/test6", $children: testFolderChildren },
    // 	]
    // }])
    // ]
};
// tryParseJSON<ServerConfig>(settingsString, (e) => {
// 	console.error(/*colors.BgWhite + */colors.FgRed + "The settings file could not be parsed: %s" + colors.Reset, e.originalError.message);
// 	console.error(e.errorPosition);
// 	throw "The settings file could not be parsed: Invalid JSON";
// });
let tree1normal = server_types_1.normalizeTree(__dirname)(tree1, "tree1", []);
let tree2normal = server_types_1.normalizeTree(__dirname)(tree2, "tree2", []);
function str(char, len) {
    for (var i = 0, s = ""; i < len; i++)
        s += char;
    return s;
}
function buildHTML(tree, indent = 0) {
    let attrs = Object.keys(tree).filter(e => !e.startsWith("$")).sort().map(k => k + "=\"" + tree[k] + "\"").join(' ');
    return str("  ", indent) + `<${tree.$element} ${attrs}${tree.$children && (">\n" + tree.$children.map(e => buildHTML(e, indent + 1)).join("") + str("  ", indent)) + `</${tree.$element}>` || " />"}\n`;
}
console.log(buildHTML(tree1normal));
console.log(buildHTML(tree2normal));
