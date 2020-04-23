const json = JSON.parse(require("fs").readFileSync("./package.json", "utf8"));
delete json.devDependencies;
delete json.main;
delete json.scripts;
json.bin = "./index.js";
require("fs").writeFileSync("./build/package.json", JSON.stringify(json, null, 2), "utf8");
