const { sortBySelector } = require('./server-types')
const fixPutSaver = `javascript:((saver) => {
if (typeof saver !== 'number' || saver < 0) return;
$tw.saverHandler.savers[saver].__proto__.uri = function () { return decodeURI(encodeURI(document.location.toString().split('#')[0])); };
$tw.saverHandler.savers[saver] = $tw.modules.types.saver['$:/core/modules/savers/put.js'].exports.create();
})($tw.saverHandler.savers.findIndex(e => e.info.name === 'put'))`;

const info = require('../package.json');

exports.generateDirectoryListing = function (directory) {
    function listEntries(entries) {
        return entries.slice().sort(
            sortBySelector(e => ((e.type === 'folder' ? '0-' : '1-') + e.name.toLocaleLowerCase()))
        ).map((entry, index) => {
            const isFile = ['category', 'folder', 'datafolder', 'error', 'other'].indexOf(entry.type) === -1;
            return `
<tr class="row ${(index + 1) % 2 ? 'odd' : 'even'} ${entry.type}">
    <td>
        <span class="icon">
            <img style="width:16px;" src="/icons/${(isFile ? 'files/' : '') + entry.type}.png"/>
        </span>
        <span class="name">
            <a href="${encodeURI(entry.path)}">${entry.name}</a>
        </span>
    </td>
    <td class="type"><span>${entry.type}</span></td>
    <td class="size"><span>${entry.size}</span></td>
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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${
        (pathArr.length > 0)
            ? `<p><a href="${parentPath}">Parent Directory: ${parentPath}</a></p>`
            : ``
        }
<table>
  <caption>${(pathArr.length > 0) ? name : 'Home'}</caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Type</th>
      <th scope="col">Size</th>
    </tr>
  </thead>
 <tbody>
${listEntries(directory.entries)}
  </tbody>
</table>

<form action="" method="post" enctype="multipart/form-data">
    <input type="file" name="filetoupload"><input type="submit">
</form>

<p><a href="${fixPutSaver}">Fix Put Saver</a>  Bookmarklet</p>
<p style="color:grey; font-family:sans-serif; font-size:0.8em;">
<a href="https://github.com/Arlen22/TiddlyServer">TiddlyServer</a> v${info.version}</p>
</body>
</html>
`
}