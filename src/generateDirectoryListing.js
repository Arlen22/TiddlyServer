const { sortBySelector } = require('./server-types')
const fixPutSaver = `javascript:((saver) => {
if (typeof saver !== 'number' || saver < 0) return;
$tw.saverHandler.savers[saver].__proto__.uri = function () { return decodeURI(encodeURI(document.location.toString().split('#')[0])); };
$tw.saverHandler.savers[saver] = $tw.modules.types.saver['$:/core/modules/savers/put.js'].exports.create();
})($tw.saverHandler.savers.findIndex(e => e.info.name === 'put'))`;

const updatedPutSaver = "data:text/vnd.tiddler,%7B%22title%22%3A%22%24%3A%2Fcore%2Fmodules%2Fsavers%2Fput.js%22%2C%22text%22%3A%22%2F*%5C%5C%5Cntitle%3A%20%24%3A%2Fcore%2Fmodules%2Fsavers%2Fput.js%5Cntype%3A%20application%2Fjavascript%5Cnmodule-type%3A%20saver%5Cn%5CnSaves%20wiki%20by%20performing%20a%20PUT%20request%20to%20the%20server%5Cn%5CnWorks%20with%20any%20server%20which%20accepts%20a%20PUT%20request%5Cnto%20the%20current%20URL%2C%20such%20as%20a%20WebDAV%20server.%5Cn%5Cn%5C%5C*%2F%5Cn(function()%7B%5Cn%5Cn%2F*jslint%20node%3A%20true%2C%20browser%3A%20true%20*%2F%5Cn%2F*global%20%24tw%3A%20false%20*%2F%5Cn%5C%22use%20strict%5C%22%3B%5Cn%5Cn%2F*%5CnSelect%20the%20appropriate%20saver%20module%20and%20set%20it%20up%5Cn*%2F%5Cnvar%20PutSaver%20%3D%20function(wiki)%20%7B%5Cn%5Ctthis.wiki%20%3D%20wiki%3B%5Cn%5Ctvar%20self%20%3D%20this%3B%5Cn%5Ctvar%20uri%20%3D%20this.uri()%3B%5Cn%5Ct%2F%2F%20Async%20server%20probe.%20Until%20probe%20finishes%2C%20save%20will%20fail%20fast%5Cn%5Ct%2F%2F%20See%20also%20https%3A%2F%2Fgithub.com%2FJermolene%2FTiddlyWiki5%2Fissues%2F2276%5Cn%5Ct%24tw.utils.httpRequest(%7B%5Cn%5Ct%5Cturl%3A%20uri%2C%5Cn%5Ct%5Cttype%3A%20%5C%22OPTIONS%5C%22%2C%5Cn%5Ct%5Ctcallback%3A%20function(err%2C%20data%2C%20xhr)%20%7B%5Cn%5Ct%5Ct%5Ct%2F%2F%20Check%20DAV%20header%20http%3A%2F%2Fwww.webdav.org%2Fspecs%2Frfc2518.html%23rfc.section.9.1%5Cn%5Ct%5Ct%5Ctif(!err)%20%7B%5Cn%5Ct%5Ct%5Ct%5Ctself.serverAcceptsPuts%20%3D%20xhr.status%20%3D%3D%3D%20200%20%26%26%20!!xhr.getResponseHeader(%5C%22dav%5C%22)%3B%5Cn%5Ct%5Ct%5Ct%7D%5Cn%5Ct%5Ct%7D%5Cn%5Ct%7D)%3B%5Cn%5Ct%2F%2F%20Retrieve%20ETag%20if%20available%5Cn%5Ct%24tw.utils.httpRequest(%7B%5Cn%5Ct%5Cturl%3A%20uri%2C%5Cn%5Ct%5Cttype%3A%20%5C%22HEAD%5C%22%2C%5Cn%5Ct%5Ctcallback%3A%20function(err%2C%20data%2C%20xhr)%20%7B%5Cn%5Ct%5Ct%5Ctif(!err)%20%7B%5Cn%5Ct%5Ct%5Ct%5Ctself.etag%20%3D%20xhr.getResponseHeader(%5C%22ETag%5C%22)%3B%5Cn%5Ct%5Ct%5Ct%7D%5Cn%5Ct%5Ct%7D%5Cn%5Ct%7D)%3B%5Cn%7D%3B%5Cn%5CnPutSaver.prototype.uri%20%3D%20function()%20%7B%5Cn%5Ctreturn%20document.location.toString().split(%5C%22%23%5C%22)%5B0%5D%3B%5Cn%7D%3B%5Cn%5Cn%2F%2F%20TODO%3A%20in%20case%20of%20edit%20conflict%5Cn%2F%2F%20Prompt%3A%20Do%20you%20want%20to%20save%20over%20this%3F%20Y%2FN%5Cn%2F%2F%20Merging%20would%20be%20ideal%2C%20and%20may%20be%20possible%20using%20future%20generic%20merge%20flow%5CnPutSaver.prototype.save%20%3D%20function(text%2C%20method%2C%20callback)%20%7B%5Cn%5Ctif(!this.serverAcceptsPuts)%20%7B%5Cn%5Ct%5Ctreturn%20false%3B%5Cn%5Ct%7D%5Cn%5Ctvar%20self%20%3D%20this%3B%5Cn%5Ctvar%20headers%20%3D%20%7B%20%5C%22Content-Type%5C%22%3A%20%5C%22text%2Fhtml%3Bcharset%3DUTF-8%5C%22%20%7D%3B%5Cn%5Ctif(this.etag)%20%7B%5Cn%5Ct%5Ctheaders%5B%5C%22If-Match%5C%22%5D%20%3D%20this.etag%3B%5Cn%5Ct%7D%5Cn%5Ct%24tw.utils.httpRequest(%7B%5Cn%5Ct%5Cturl%3A%20this.uri()%2C%5Cn%5Ct%5Cttype%3A%20%5C%22PUT%5C%22%2C%5Cn%5Ct%5Ctheaders%3A%20headers%2C%5Cn%5Ct%5Ctdata%3A%20text%2C%5Cn%5Ct%5Ctcallback%3A%20function(err%2C%20data%2C%20xhr)%20%7B%5Cn%5Ct%5Ct%5Ctif(err)%20%7B%5Cn%5Ct%5Ct%5Ct%5Ctcallback(err)%3B%5Cn%5Ct%5Ct%5Ct%7D%20if(xhr.status%20%3D%3D%3D%20200%20%7C%7C%20xhr.status%20%3D%3D%3D%20201)%20%7B%5Cn%5Ct%5Ct%5Ct%5Ctself.etag%20%3D%20xhr.getResponseHeader(%5C%22ETag%5C%22)%3B%5Cn%5Ct%5Ct%5Ct%5Ctcallback(null)%3B%20%2F%2F%20success%5Cn%5Ct%5Ct%5Ct%7D%20else%20if(xhr.status%20%3D%3D%3D%20412)%20%7B%20%2F%2F%20edit%20conflict%5Cn%5Ct%5Ct%5Ct%5Ctvar%20message%20%3D%20%24tw.language.getString(%5C%22Error%2FEditConflict%5C%22)%3B%5Cn%5Ct%5Ct%5Ct%5Ctcallback(message)%3B%5Cn%5Ct%5Ct%5Ct%7D%20else%20%7B%5Cn%5Ct%5Ct%5Ct%5Ctcallback(xhr.responseText)%3B%20%2F%2F%20fail%5Cn%5Ct%5Ct%5Ct%7D%5Cn%5Ct%5Ct%7D%5Cn%5Ct%7D)%3B%5Cn%5Ctreturn%20true%3B%5Cn%7D%3B%5Cn%5Cn%2F*%5CnInformation%20about%20this%20saver%5Cn*%2F%5CnPutSaver.prototype.info%20%3D%20%7B%5Cn%5Ctname%3A%20%5C%22put%5C%22%2C%5Cn%5Ctpriority%3A%202000%2C%5Cn%5Ctcapabilities%3A%20%5B%5C%22save%5C%22%2C%20%5C%22autosave%5C%22%5D%5Cn%7D%3B%5Cn%5Cn%2F*%5CnStatic%20method%20that%20returns%20true%20if%20this%20saver%20is%20capable%20of%20working%5Cn*%2F%5Cnexports.canSave%20%3D%20function(wiki)%20%7B%5Cn%5Ctreturn%20%2F%5Ehttps%3F%3A%2F.test(location.protocol)%3B%5Cn%7D%3B%5Cn%5Cn%2F*%5CnCreate%20an%20instance%20of%20this%20saver%5Cn*%2F%5Cnexports.create%20%3D%20function(wiki)%20%7B%5Cn%5Ctreturn%20new%20PutSaver(wiki)%3B%5Cn%7D%3B%5Cn%5Cn%7D)()%3B%5Cn%22%2C%22type%22%3A%22application%2Fjavascript%22%2C%22module-type%22%3A%22saver%22%7D";
const info = require('../package.json');


/**
 * @param { {path: string;entries: DirectoryEntry[];type: "group" | "folder";} } directory 
 * @param {import("./server-types").DirectoryIndexOptions} options
 */
exports.generateDirectoryListing = function (directory, options) {
    function listEntries(entries) {
        return entries.slice().sort(
            sortBySelector(e => ((options.mixFolders ? "" : (e.type === 'folder' ? '0-' : '1-')) + e.name.toLocaleLowerCase()))
        ).map((entry, index) => {
            const isFile = ['category', 'folder', 'datafolder', 'error', 'other'].indexOf(entry.type) === -1;
            const showSize = isFile || entry.type === "other";
            return `
<li>
    <span class="icon">
        <img style="width:16px;" src="/assets/icons/${(isFile ? 'files/' : '') + entry.type}.png"/>
    </span>
    <span class="size">${showSize ? entry.size : ""}</span>
    <span class="name">
        <a href="${encodeURI(entry.path)}">${entry.name}</a>
    </span>
</li>`
// return `<tr class="row ${(index + 1) % 2 ? 'odd' : 'even'} ${entry.type}">
//     <td>
//         <span class="icon">
//             <img style="width:16px;" src="/assets/icons/${(isFile ? 'files/' : '') + entry.type}.png"/>
//         </span>
//         <span class="name">
//             <a href="${encodeURI(entry.path)}">${entry.name}</a>
//         </span>
//     </td>
//     <td class="type"><span>${entry.type}</span></td>
//     <td class="size"><span>${entry.size}</span></td>
// </tr>`
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
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
function logout(){
    fetch("/admin/authenticate/logout", { "method": "POST" }).then(res => {
        location.href = location.href;
    });
}
</script>
</head>
<body>
${
    options.isLoggedIn 
    ? `<p>Welcome ${options.isLoggedIn}, <a href="javascript:return false;" onclick="logout()">logout</a></p>`
    : `<p><a href="/admin/authenticate/login.html">Login</a></p>`
}
${
        (pathArr.length > 0)
            ? `<p><a href="${parentPath}">Parent Directory: ${parentPath}</a></p>`
            : ``
        }
<ul>${listEntries(directory.entries)}</ul>
${(options.upload) ? `<p>
<form action="?formtype=upload" method="post" enctype="multipart/form-data" name="upload">
    <label>Upload file</label>
    <input type="text" name="filename" placeholder="File name" />
    <input type="file" name="filetoupload" 
        onchange="this.form.elements.filename.value=this.files[0].name;"/>
    <input type="submit"/>
</form>
</p>` : ''}
${(options.mkdir) ? `<p>
<form action="?formtype=mkdir" method="post" enctype="multipart/form-data" name="mkdir">
    <label>Create Directory</label>
    <input type="hidden" name="dirtype" value="directory" />
    <input type="text" name="dirname" placeholder="Directory name"/>
    <input type="submit" value="Directory"/>
    <input type="button" onclick="this.form.elements.dirtype.value = 'datafolder'; this.form.submit()" value="Data Folder"/>
</form>` : ''}
</p>

<p><a href="${fixPutSaver}">Fix Put Saver</a>  Bookmarklet</p>
<p>After executing the bookmarklet, drag this <a href="${updatedPutSaver}">updated Put Saver</a> into your wiki to fix it permenantly.</p>
<p style="color:grey; font-family:sans-serif; font-size:0.8em;">
<a href="https://github.com/Arlen22/TiddlyServer">TiddlyServer</a> v${info.version}</p>
</body>
</html>
`
}

// `<table>
//   <caption>${(pathArr.length > 0) ? name : 'Home'}</caption>
//   <thead>
//     <tr>
//       <th scope="col">Name</th>
//       <th scope="col">Type</th>
//       <th scope="col">Size</th>
//     </tr>
//   </thead>
//  <tbody>
// ${listEntries(directory.entries)}
//   </tbody>
// </table>`