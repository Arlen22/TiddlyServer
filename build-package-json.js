const json = JSON.parse(require("fs").readFileSync("./package.json", "utf8"));
// delete dev deps
delete json.devDependencies;
// carry over dependencies required for the production build
let deps = json.dependencies;
json.dependencies = {};
json.prodDependencies.forEach(e => {
  json.dependencies[e] = deps[e];
})
// remove keys not used in production
delete json.prodDependencies;
delete json.main;
delete json.scripts;
//set the webpack output as the bin file
json.bin = "./index.js";
//save to the output directory
require("fs").writeFileSync("./dist/package.json", JSON.stringify(json, null, 2), "utf8");
