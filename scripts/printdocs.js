let doc = {
  datafolder: "Whether clients may access data folders, which gives them full access to the system as the user that owns the server process because data folders can be easily modified to execute code on the server. This returns a 403 Access Denied if a data folder is detected. It does not serve the files inside the data folder as a regular folder. For that you need to use the noDataFolder attribute on the folder in the tree.",
  loginlink: "Whether to include a link to the login page when returning auth errors",
  mkdir: "Whether clients may create new directories and datafolders inside existing directories served by TiddlyWiki",
  putsaver: "Whether clients may use the put saver, allowing any file served within the tree (not assets) to be overwritten, not just TiddlyWiki files. The put saver cannot save to data folders regardless of this setting.",
  registerNotice: "Whether login attempts for a public/private key pair which has not been registered will be logged at debug level 2 with the full public key which can be copied into an authAccounts entry. Turn this off if you get spammed with login attempts.",
  transfer: "Allows clients to use a custom TiddlyServer feature which relays a connection between two clients. ",
  upload: "Whether clients may upload files to directories (not data folders).",
  websockets: "Whether clients may open websocket connections.",
  writeErrors: "Whether to write status 500 errors to the browser, possibly including stack traces."
};
let keys = Object.keys(doc).sort();
keys.forEach(k => {
  console.log("- `%s`: %s", k, doc[k]);
})