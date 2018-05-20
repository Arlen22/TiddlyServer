const path = require('path');
const settings = require(process.argv[2] || path.resolve(__dirname, '../settings.json'));
if(process.argv[3] !== "iknow") throw "This script is not finished yet.";

function walkTree(item, key){
	if(typeof item === "object") {
		return {
			"$type": "category",
			"name": key,
			"$children": Object.keys(item).map(k => walkTree(item[k], k))
		}
	} else if (typeof item === "string"){
		return {
			"$type": "folder",
			"name": key,
			"path": item
		}
	}
}

settings.tree = walkTree(settings.tree);
settings.version = 1;

console.log(JSON.stringify(settings, null, 2));