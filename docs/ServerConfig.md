---
id: serverconfig
title: Server Config
---

The server config is both a TypeScript interface, and a JSON file. The JSON file is loaded and normalized to match the ServerConfig interface definition and then type-checked to make sure all the data is valid. This helps me catch bugs during development and helps everyone make sure their settings.json file has the correct format. 

```json
{
  "$schema": "./settings-2-1.schema.json",
  "tree": {},
  "authAccounts": {},
  "bindInfo": {},
  "logging": {},
  "directoryIndex": {},
  "datafolder": {},
  "putsaver": {},
  "authCookieAge": 86400,
  "maxTransferRequests": 20,
  "_devmode": false,
  "_datafoldertarget": ""
}
```

## Section `tree`

The tree property has many expressions, but only one format. In it's simplest form, it is expressed as string values specifying folders and files to be served organized into a tree structure using objects.

<div style="color: rgb(0, 0, 0); font-family: Menlo, Monaco, &quot;Courier New&quot;, monospace; font-size: 12px; line-height: 18px; white-space: pre; overflow: scroll hidden; "><div>{</div><div>  <span style="color: rgb(4, 81, 165);">"tree"</span>: {</div><div>    <span style="color: rgb(4, 81, 165);">"myfolder"</span>: <span style="color: rgb(163, 21, 21);">"../personal"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"workstuff"</span>: <span style="color: rgb(163, 21, 21);">"../work"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"user"</span>: <span style="color: rgb(163, 21, 21);">"~/Desktop/random"</span>,</div><div>    <span style="color: rgb(4, 81, 165);">"projects_group"</span>: {</div><div>      <span style="color: rgb(4, 81, 165);">"tiddlyserver"</span>: <span style="color: rgb(163, 21, 21);">"~/Desktop/Github/TiddlyServer"</span>,</div><div>      <span style="color: rgb(4, 81, 165);">"material-theme"</span>: <span style="color: rgb(163, 21, 21);">"~/Dropbox/Material Theme"</span></div><div>    }</div><div>  }</div><div>}</div></div>

In it's most advanced form it is more like an array of Group and Folder class instances. Each Group class instance may contain its own array of Group and Folder class instances, and so on. The end result is exactly the same. In fact, this is the internal representation that TiddlyServer uses. 

In the settings file, the simple and advanced formats may be mixed. In other words, an object which doesn't contain the `$element` property is converted to a Group instance. A string is converted to a Folder instance. 

The `$element` property is used to keep track of which instance type an object is. All instance types are written in a way that imitates XML. This means the tree can also be expressed using XML. Because of this I refer to instances as "elements". 

The navigation and linking is seamless, making it easy to logically organized different folders. 

Internally, the tree property has an array of Host instances at the top level, but TiddlyServer simply uses the first Host in the array, unless the [preflighter](Preflighter.md) specifies a different host index. There are no plans to expand this feature, it is simply there for advanced use-cases to implement if desired. 

Group and Folder elements are collectively referred to as "mount" elements. 

### Host element type

- $element: `host`
- $mount: One group or folder element, not an array. 

### Group element type

- $element: `group`,
- indexPath: string,
- key: string - not used if specified in a hashmap instead of an array
- $children: An array or hashmap of Group and Folder elements
- $options: An array of Option elements

In XML: Group, Folder, and Option elements are all be mixed together as child elements. 

### Folder element type

- $element: `folder`,
- path: string,
- key: string - not used if specified in a hashmap instead of an array
- $options: An array of Option elements

### Option element types

The option elements can be specified on a mount element and apply to all children of that mount element, unless overriden by an option element for a mount element below it. Each element overrides the properties of the element above it, unless the property is undefined. Here is a simple xml example of this.

```xml
<group>
  <putsaver backupFolder="~/backups" />
  <folder path="/junkstuff">
    <backups backupFolder="" />
  </folder>
  <folder path="/treasures">
    <auth authList='["someone"]' />
  </folder>
</group>
```

In this case, backups will be made for all items in the group except for the `/junkstuff` folder, and users may access all resources in the group except `/treasures`, which is restricted to the auth account `someone`. 

#### Auth option

- $element: `auth`
- authList: Array of strings that are the keys of the authAccounts object. These auth accounts are allowed to access this resource.
- authError: Either `403` or `404`, as desired. The default is 403.

#### Backups option

- $element: `backups`
- backupFolder: The folder path to put backups in. An empty string disables backups for this element.
- etagAge: Don't save a backup unless the previous backup is older than this.
- gzip: Whether to gzip compress the backup file to save space (highly recommended).

#### Index option

- $element: `index`
- defaultType: The type of directory index to return if no index file is found. `"html"`, `"json"`, `403`, `404` 
- indexFile: Array of index file names to check for.
- indexExts: Array of index file extensions to use when checking for index. 

`indexFile` and `indexExts` must both apply to the request in order for the index file to be used, but they don't need to be specified on the same element. For instance, one may be specified on a group, and the other may be specified on the folder underneath it. 

## Section `authAccounts`

Auth accounts is a hashmap. The key is the account ID and the value is an object with two properties. 

- `permissions` - The same permissions object specified in `bindInfo.localAddressPermissions`.
- `clientKeys` - A hashmap of { [`username`]: { `publicKey`: , `cookieSalt` } }

<div style="color: rgb(0, 0, 0); font-family: Menlo, Monaco, &quot;Courier New&quot;, monospace; font-size: 12px; line-height: 18px; white-space: pre; overflow: auto;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div>&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"authAccounts"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"designteam"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"clientKeys"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"arlen"</span>:&nbsp;{&nbsp;<span style="color: rgb(4, 81, 165);">"publicKey"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">""</span>,&nbsp;<span style="color: rgb(4, 81, 165);">"cookieSalt"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">""</span>&nbsp;}</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"permissions"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"mkdir"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">true</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"putsaver"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">true</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"registerNotice"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">true</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"upload"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">true</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"websockets"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">true</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"writeErrors"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">true</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"loginlink"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">true</span></div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}</div><div>&nbsp;&nbsp;&nbsp;&nbsp;}</div><div>&nbsp;&nbsp;},</div></div></div></div></div></div></div>

The page at `/admin/authenticate/login.html` will generate the public key based on the username and password and use it to log into the server, but the server does not care what method is used to generate the public key. We could just as easily implement a password-protected private key instead of hashing the username and password. 

If the login fails, and the request has registerNotice set (by default this is only localhost requests), TiddlyServer will print a message to the terminal listing the username and generated publicKey, which you can copy and paste into your settings.json file as the `"base64string"` in the example above. 

The username is passed to TiddlyWiki data folder instances for each request.

The public key is an ed25519 public key generated by the libsodium library function `crypto_sign_seed_keypair`. 

The cookie salt is appended to the login cookie before it is sent in the Set-Cookie header. TiddlyServer checks the salt on every cookie to make sure it is correct for that user, so the user can be logged out of all devices if desired simply by changing the cookie salt. It must be a non-zero-length string, but otherwise it's value is completely meaningless.

If the cookie salt is changed to a string which was already used before for that user, any cookies set while that salt was active will become active again. Therefore it is recommended to use the current timestamp for the cookie salt whenever it is necessary to change it. All users may use the same cookie salt as long as they have never used it before. 

Running the command `node -e "console.log(Date.now())"` will print the current timestamp. 

## Section `bindInfo`

The bind info relates to the NodeJS server instances that TiddlyServer uses to recieve requests. 

<div style="color: rgb(0, 0, 0); font-family: Menlo, Monaco, &quot;Courier New&quot;, monospace; font-size: 12px; line-height: 18px; white-space: pre; overflow: auto"><div>&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">bindInfo:</span>&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">port:</span>&nbsp;<span style="color: rgb(9, 136, 90);">8080</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">bindAddress:</span>&nbsp;[<span style="color: rgb(163, 21, 21);">"127.0.0.1"</span>&nbsp;<span style="color: rgb(0, 128, 0);">/*&nbsp;"0.0.0.0"&nbsp;*/</span>&nbsp;<span style="color: rgb(0, 128, 0);">/*&nbsp;"192.168.0.0/16"&nbsp;*/</span>],</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">bindWildcard:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">enableIPv6:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">filterBindAddress:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">https:</span>&nbsp;<span style="color: rgb(163, 21, 21);">"./https.js"</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">localAddressPermissions:</span>&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(163, 21, 21);">"*"</span><span style="color: rgb(0, 16, 128);">:</span>&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">loginlink:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">mkdir:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">putsaver:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,&nbsp;</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">registerNotice:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">upload:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,&nbsp;</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">websockets:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">writeErrors:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span></div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}</div><div>&nbsp;&nbsp;&nbsp;&nbsp;},</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(0, 16, 128);">_bindLocalhost:</span>&nbsp;<span style="color: rgb(0, 0, 255);">false</span></div><div>&nbsp;&nbsp;}</div></div>

### port: number;

port to listen on, default is 8080 for http and 8443 for https

### bindAddress: string[];

An array of IP addresses to accept requests on. Can be any IP address
assigned to the machine. Default is "127.0.0.1".

If `bindWildcard` is true, each connection is checked individually to make sure it is connected to one of the specified IP addresses. If `bindWildcard` is false, the server listens on the specified IP addresses and accepts all connections from the operating system. If an IP address cannot be bound, the server skips it unless `--bindAddressRequired` is specified.

If `filterBindAddress` is true, IPv4 addresses may include a subnet mask,
(e.g. `/24`) which matches any interface IP address in that range. Prefix with a minus sign (-) 
to block requests incoming to that IP address or range.

### filterBindAddress: boolean;

Allow `bindAddress` items to include a subnet mask which will make it match a range of IP addresses instead of only one IP address. 

### bindWildcard: boolean;
	
Bind to the wildcard addresses `0.0.0.0` and `::` (if enabled) in that order.
The default is `true`. In many cases this is preferred, however 
Android does not support this for some reason. On Android, set this to
`false` and set host to `["0.0.0.0/0"]` to bind to all IPv4 addresses.

### enableIPv6: boolean;
 
Bind to the IPv6 wildcard as well if `bindWilcard` is true and allow requests
incoming to IPv6 addresses if not explicitly denied.


### localAddressPermissions: Hashmap

Permissions based on local address: "localhost", "*" (all others), "192.168.0.0/16", etc. 
This checks the server IP address each client actually connects to (socket.localAddress), 
not the bind address of the server instance that accepted the request, so it works with bindWildcard. The localhost key will be used for all localhost requests regardless of the actual IP address.

- `putsaver`: allow the putsaver to be used
- `writeErrors`: write error messages to the browser
- `upload`: allow uploads on the directory index page
- `mkdir`: allow create directory on directory index page
- `websockets`: allow websocket connections (default true);
- `registerNotice`: login attempts for a public/private key pair which has not been registered will be logged at debug level 2 with the full public key which can be copied into an authAccounts entry. 
- `loginlink`: 403 Access Denied error page will include a link to the login page.

Here is an example of what it could look like, with everything allowed. 

```json
{
  "*": {
    "putsaver": true,
    "writeErrors": true,
    "upload": true,
    "mkdir": true,
    "websockets": true,
    "registerNotice": true
  }
}
```

### _bindLocalhost: boolean;

Always bind a separate server instance to 127.0.0.1 regardless of any other settings 

## Section `directoryIndex`

A group of settings which apply to the directory index. 

The example here demonstrates the difference between `icons` and `mimetypes`. `icons` needs to have _all_ extensions specified, and `mimetypes` only needs _additional_ extensions specified. 

<div style="color: rgb(0, 0, 0); font-family: Menlo, Monaco, &quot;Courier New&quot;, monospace; font-size: 12px; line-height: 18px; white-space: pre; overflow: auto;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div>&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"directoryIndex"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"defaultType"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">"html"</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"icons"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"htmlfile"</span>:&nbsp;[<span style="color: rgb(163, 21, 21);">"html"</span>,&nbsp;<span style="color: rgb(163, 21, 21);">"htm"</span>,&nbsp;<span style="color: rgb(163, 21, 21);">"tw"</span>]</div><div>&nbsp;&nbsp;&nbsp;&nbsp;},</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"mimetypes"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"text/html"</span>:&nbsp;[<span style="color: rgb(163, 21, 21);">"tw"</span>]</div><div>&nbsp;&nbsp;&nbsp;&nbsp;},</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"mixFolders"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">false</span></div><div>&nbsp;&nbsp;},</div></div></div></div></div></div>

### defaultType: `html` | `json`

The global default directory index format. Default is `html`. 

### icons: Hashmap

Hashmap where key is the icon files in `/assets/icons/files` (without the extension) and value is an array of extensions to show the icon for in directory index. 

The default is `{ "htmlfile": ["htm", "html"] }`.

Unlike mimetypes, this replaces the default, so htmlfile must be specified as well. 

### mimetypes: 

Extra extensions to map to certain mime types when serving files. 

For example: `{ "text/html": [ "tw" ], "example/other": ["any"] }` adds the .tw and .any extensions. 

### mixFolders: boolean

Sort folders separately in directory index or mix them.

## Section `datafolder`

A record of strings which will be added to options.variables object of the TiddlyWiki server instance. 

<div style="color: rgb(0, 0, 0); font-family: Menlo, Monaco, &quot;Courier New&quot;, monospace; font-size: 12px; line-height: 18px; white-space: pre; overflow:auto;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div>&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"datafolder"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"root-tiddler"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">"$:/core/save/all-external-js&nbsp;or&nbsp;whatever&nbsp;all&nbsp;your&nbsp;wikis&nbsp;use"</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"other-tiddlywiki-server-variable"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">"anything&nbsp;tiddlywiki&nbsp;server&nbsp;understands"</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"incorrect-server-variable"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">"tiddlyserver&nbsp;doesn't&nbsp;check&nbsp;the&nbsp;datafolder&nbsp;object"</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"spread&nbsp;operator&nbsp;assignment"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">"it&nbsp;just&nbsp;...vars&nbsp;it&nbsp;into&nbsp;the&nbsp;tiddlywiki&nbsp;server&nbsp;variables"</span></div><div>&nbsp;&nbsp;},</div></div></div></div>

One security consideration is that if an object is specified instead of a string for any of the properties, then all data folders will be sharing that object. Changes to the object will be seen by all other data folder instances. 

No type checking is done on the values of the datafolder object. 

## Section `putsaver`

Setting this property to false disables the putsaver completely in case this feature is not desired. The properties are the same as the putsaver option element in the tree. This can be considered the top-level `putsaver` option element. 

<div style="color: rgb(0, 0, 0); font-family: Menlo, Monaco, &quot;Courier New&quot;, monospace; font-size: 12px; line-height: 18px; white-space: pre; overflow: auto;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div style="line-height: 18px;"><div>&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"putsaver"</span>:&nbsp;{</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"backupFolder"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">"../backups"</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"etag"</span>:&nbsp;<span style="color: rgb(163, 21, 21);">"optional"</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"etagAge"</span>:&nbsp;<span style="color: rgb(9, 136, 90);">3</span>,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: rgb(4, 81, 165);">"gzipBackups"</span>:&nbsp;<span style="color: rgb(0, 0, 255);">true</span></div><div>&nbsp;&nbsp;},</div></div></div></div></div>

### backupFolder: string

Backup directory to use for all single-file wikis, unless over-ridden by the tree. An empty string will disable backups for this folder.

### gzipBackups: boolean

Whether to gzip compress the backup file. The `.gz` extension will be added. Default is true. 

### etag: string

Whether to use etag checking.

- `"disabled"` - Ignore the Etag. 
- `"optional"` - Use it if sent by the client. This is the default. 
- `"required"` - Require an Etag to be present.

### etagAge: number

This sets the number of seconds after which a copy is considered stale. This feature is hard to explain, but it was implemented because users often found that the modification time on disc would change by about two or three seconds after the file was saved, causing subsequent saves to be rejected.

Since a single user is not going to make changes to the same copy on two computers and save them both within 5-10 seconds of each other, 8 seconds is probably a safe number to use. The default, however, is 3. 

If multiple users are editing the same file, you should probably be using Git or Dropbox to sync your changes instead of TiddlyServer. Or use a datafolder instead. 

If the file size has changed, it is always considered stale, regardless of this setting. 

## Section `logging`

### debugLevel: number

The debug level to use, the default is 0. Negative values are more verbose. This should be no higher than `2` for normal situations.

### logAccess: string | number

Write the access log to a file or . If no path is specified, the output is logged to console instead. 

### logError: string | number

Write the error log to a file. If no path is specified, the output is logged to console instead. 

### logColorsToFile: boolean

Whether to write the color bytes to the file. If the color bytes are written, they can be read back with cat and tail, but text editors will look rather junky. The default is false. 

### logToConsoleAlso: boolean

Whether the log items should still be written to the console even if they are written to a file. The default is true. 