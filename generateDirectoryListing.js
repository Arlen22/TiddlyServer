const { sortBySelector } = require('./server-types')
const fixPutSaver = `javascript:((saver) => {
if (typeof saver !== 'number' || saver < 0) return;
$tw.saverHandler.savers[saver].__proto__.uri = function () { return decodeURI(encodeURI(document.location.toString().split('#')[0])); };
$tw.saverHandler.savers[saver] = $tw.modules.types.saver['$:/core/modules/savers/put.js'].exports.create();
})($tw.saverHandler.savers.findIndex(e => e.info.name === 'put'))`;

const info = require('./package.json');

exports.generateDirectoryListing = function (directory) {
    function listEntries(entries) {
        return entries.slice().sort(
            sortBySelector(e => ((e.type === 'folder' ? '0-' : '1-') + e.name.toLocaleLowerCase()))
        ).map((entry, index) => {
            const isFile = ['category', 'folder', 'datafolder', 'error', 'other'].indexOf(entry.type) === -1;
            return `
<tr class="row ${(index + 1) % 2 ? 'odd' : 'even'} ${entry.type}">
    <td><span class="icon"><img src="/icons/${(isFile ? 'files/' : '') + entry.type}.png"/></span></td>
    <td><span class="name"><a href="${encodeURI(entry.path)}">${entry.name}</a></span></td>
    <td><span class="type">${entry.type}</span></td>
    <td><span class="size">${entry.size}</span></td>
</tr>`
        }).join("")
    }
    const pathArr = directory.path.split('/').filter(a => a);
    const parentJoin = ["", pathArr.slice(0, pathArr.length - 1).join('/'), ""].join('/');
    const parentPath = parentJoin === '//' ? '/' : parentJoin;
    const name = pathArr.slice(pathArr.length - 1);
    return `
<!DOCTYPE html>
<html>
<head>
<title>${name}</title>
<link rel="stylesheet" href="/directory.css" />
</head>
<body>
<p><a href="${parentPath}">Parent directory: ${parentPath}</a></p>
<h3>${name}</h3>
<table style="min-width:400px;">
<tr><th></th><th>Name</th><th>Type</th><th>Size</th></tr>
${listEntries(directory.entries)}
</table>
<p><a href="${fixPutSaver}">Fix Put Saver</a>  Bookmarklet</p>
<p style="color:grey; font-family:sans-serif; font-size:0.8em;">TiddlyServer v${info.version}</p>
</body>
</html>
`
}