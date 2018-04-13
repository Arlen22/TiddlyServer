const settings = require('./settings.json');

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

console.log(walkTree(settings.tree));