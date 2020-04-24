const json = JSON.parse(require("fs").readFileSync("./package.json", "utf8"));
delete json.devDependencies;
let deps = json.dependencies;
json.dependencies = {};
json.prodDependencies.forEach(e => {
  json.dependencies[e] = deps[e];
})
delete json.prodDependencies;
delete json.main;
delete json.scripts;
json.bin = "./index.js";
require("fs").writeFileSync("./build/package.json", JSON.stringify(json, null, 2), "utf8");
