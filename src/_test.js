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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX3Rlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJfdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGlEQUF5WTtBQUN6WSx5QkFBeUI7QUFDekIsMkJBQTZEO0FBQzdELElBQUksa0JBQWtCLEdBQXFCO0lBQzFDLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUU7Q0FDeEUsQ0FBQTtBQUNELGdCQUFtQixDQUFJO0lBQ3RCLE9BQU8sQ0FBQyxDQUFDO0FBQ1YsQ0FBQztBQUNELElBQUksYUFBYSxHQUFHLE1BQU0sQ0FBc0I7SUFDL0Msa0JBQWtCO0lBQ2xCLEdBQUcsTUFBTSxDQUFzQjtRQUM5QixFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFO1FBQzlELEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFO1FBQzFDLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLGtCQUFrQixFQUFFO1FBQzdGLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRTtLQUN6RSxDQUFDO0lBQ0YsR0FBRyxNQUFNLENBQXVCLENBQUM7WUFDaEMsUUFBUSxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRTtnQkFDakQsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUU7Z0JBQzFDLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRTtnQkFDekUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFB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