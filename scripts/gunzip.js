const z = require("zlib");
const fs = require("fs");
if(fs.existsSync(process.argv[3])) throw "The output file already exists";
fs.writeFileSync(process.argv[3], z.gunzipSync(fs.readFileSync(process.argv[2])));