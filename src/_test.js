"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const fs = require("fs");
const os_1 = require("os");
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
    test1: "test/test1string",
    test2: "test/test2string",
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
};
// tryParseJSON<ServerConfig>(settingsString, (e) => {
// 	console.error(/*colors.BgWhite + */colors.FgRed + "The settings file could not be parsed: %s" + colors.Reset, e.originalError.message);
// 	console.error(e.errorPosition);
// 	throw "The settings file could not be parsed: Invalid JSON";
// });
let tree1normal = server_types_1.normalizeTree(__dirname, tree1, "tree1", []);
let tree2normal = server_types_1.normalizeTree(__dirname, tree2, "tree2", []);
function str(char, len) {
    for (var i = 0, s = ""; i < len; i++)
        s += char;
    return s;
}
function buildHTML(tree, indent = 0) {
    let attrs = Object.keys(tree).filter(e => !e.startsWith("$")).sort().map(k => k + "=\"" + tree[k] + "\"").join(' ');
    return str("  ", indent) + `<${tree.$element} ${attrs}${tree.$children && (">\n" + tree.$children.map(e => buildHTML(e, indent + 1)).join("") + str("  ", indent)) + `</${tree.$element}>` || " />"}\n`;
}
// console.log(buildHTML(tree1normal));
// console.log(buildHTML(tree2normal));
// console.log(getUsableAddresses(["0.0.0.0/0", "::"]));
let tester = server_types_1.parseHostList([process.argv[2], "-127.0.0.0/8"]);
let ifaces = os_1.networkInterfaces();
let addresses = Object.keys(ifaces)
    .reduce((n, k) => n.concat(ifaces[k]), [])
    .filter(e => (e.family === "IPv4") && tester(e.address))
    .map(e => e.address);
console.log(addresses);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX3Rlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJfdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGlEQUF5WTtBQUN6WSx5QkFBeUI7QUFDekIsMkJBQTZEO0FBQzdELElBQUksa0JBQWtCLEdBQXFCO0lBQzFDLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUU7Q0FDeEUsQ0FBQTtBQUNELFNBQVMsTUFBTSxDQUFJLENBQUk7SUFDdEIsT0FBTyxDQUFDLENBQUM7QUFDVixDQUFDO0FBQ0QsSUFBSSxhQUFhLEdBQUcsTUFBTSxDQUFzQjtJQUMvQyxrQkFBa0I7SUFDbEIsR0FBRyxNQUFNLENBQXNCO1FBQzlCLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUU7UUFDOUQsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUU7UUFDMUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsa0JBQWtCLEVBQUU7UUFDN0YsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLGtCQUFrQixFQUFFO0tBQ3pFLENBQUM7SUFDRixHQUFHLE1BQU0sQ0FBdUIsQ0FBQztZQUNoQyxRQUFRLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFO2dCQUNqRCxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRTtnQkFDMUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLGtCQUFrQixFQUFFO2dCQUN6RSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUs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