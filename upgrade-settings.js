const { ConvertSettings, tryParseJSON } = require('./src/server-types');
const fs = require('fs');

if (!process.argv[2] || !process.argv[3])
	throw "An old and new file must be specified";

let settingsStr = fs.readFileSync(process.argv[2], "utf8");

let oldSettings = tryParseJSON(settingsStr, (err) => console.log(err));

let newSettings = ConvertSettings(oldSettings);

fs.writeFileSync(process.argv[3], JSON.stringify(newSettings, null, 2));
