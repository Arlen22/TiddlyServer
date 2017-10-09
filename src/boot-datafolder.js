const path = require('path');

__dirname = path.dirname(module.filename || process.execPath);

exports.DataFolder = function (prefix, folder, callback) {

	const $tw = require("./boot.js").TiddlyWiki(
		require("./bootprefix.js").bootprefix({
			packageInfo: require('./tiddlywiki-package.json')
		})
	);
	$tw.boot.argv = [folder];
	const execute = $tw.boot.executeNextStartupTask;
	//callback will be coming eventually, but this works for now
	$tw.boot.executeNextStartupTask = function () {
		const res = execute();
		//call setImmediate to make sure we are out of the boot try...catch below
		if (!res) setImmediate(() => callback(null, $tw));
		return true;
	}
	$tw.preloadTiddler({
		"text": "$protocol$//$host$" + prefix + "/",
		"title": "$:/config/tiddlyweb/host"
	});
/**
Specify the boot folder of the tiddlywiki instance to load. This is the actual path to the tiddlers that will be loaded 
into wiki as tiddlers. Therefore this is the path that will be served to the browser. It will not actually run on the server
since we load the server files from here. We only need to make sure that we use boot.js from the same version as included in 
the bundle. 
 */
	try {
		$tw.crypto = new $tw.utils.Crypto();
		//call boot startup directly so we can give it the boot folder
		$tw.boot.startup({
			bootPath: path.join(__dirname, '../tiddlywiki/boot')
		});
	} catch (err) {
		callback(err);
	}
}