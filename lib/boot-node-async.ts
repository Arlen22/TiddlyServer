import * as path from 'path';
import * as fs from 'fs';

import { Observable } from './rx';

export type obs_stat_result<T> = [NodeJS.ErrnoException, fs.Stats, T, string]
export const obs_stat = <T = undefined>(tag: T = undefined as any) =>
	(filepath: string) => new Observable<obs_stat_result<T>>(subs => {
		fs.stat(filepath, (err, data) => {
			subs.next([err, data, tag, filepath]);
			subs.complete();
		})
	})

export type obs_exists_result<T> = [boolean, T, string]
export const obs_exists = <T = undefined>(tag: T = undefined as any) =>
	(filepath: string) => new Observable<obs_exists_result<T>>(subs => {
		fs.stat(filepath, (err, data) => {
			subs.next([!err, tag, filepath]);
			subs.complete();
		})
	})

export type obs_readdir_result<T> = [NodeJS.ErrnoException, string[], T, string]
export const obs_readdir = <T>(tag: T = undefined as any) =>
	(filepath: string) => new Observable<obs_readdir_result<T>>(subs => {
		fs.readdir(filepath, (err, data) => {
			subs.next([err, data, tag, filepath]);
			subs.complete();
		})
	})

export type obs_readFile_result<T> = typeof obs_readFile_inner
export const obs_readFile = <T>(tag: T = undefined as any): obs_readFile_result<T> =>
	(filepath: string, encoding?: string) =>
		new Observable(subs => {
			const cb = (err, data) => {
				subs.next([err, data, tag, filepath]);
				subs.complete();
			}
			if (encoding)
				fs.readFile(filepath, encoding, cb);
			else
				fs.readFile(filepath, cb)
		}) as any;

declare function obs_readFile_inner<T>(filepath: string): Observable<[NodeJS.ErrnoException, Buffer, T, string]>;
declare function obs_readFile_inner<T>(filepath: string, encoding: string): Observable<[NodeJS.ErrnoException, string, T, string]>;

declare const $tw: {
	loadMetadataForFile: typeof loadMetadataForFile;
	loadTiddlersFromFile: typeof loadTiddlersFromFile;
	loadTiddlersFromPath: typeof loadTiddlersFromPath;
	loadTiddlersFromSpecification: typeof loadTiddlersFromSpecification;
	loadPluginFolder: typeof loadPluginFolder;
	findLibraryItem: typeof findLibraryItem;
	loadPlugin: typeof loadPlugin;
	getLibraryItemSearchPaths: typeof getLibraryItemSearchPaths;
	loadPlugins: typeof loadPlugins;
	loadWikiTiddlers: typeof loadWikiTiddlers;
	[K: string]: any;
};

function obs_tw_each(obj: any) {
	return new Observable(subs => {
		$tw.utils.each(obj, (item, index) => { subs.next([item, index]); });
		subs.complete();
	})
}

function loadTiddlersFromFile(filepath, fields) {
	var ext = path.extname(filepath),
		extensionInfo = $tw.utils.getFileExtensionInfo(ext),
		type = extensionInfo ? extensionInfo.type : null,
		typeInfo = type ? $tw.config.contentTypeInfo[type] : null;
	return obs_readFile()(filepath, typeInfo ? typeInfo.encoding : "utf8").concatMap(data => {
		var tiddlers = $tw.wiki.deserializeTiddlers(ext, data, fields);
		if (ext !== ".json" && tiddlers.length === 1) {
			return $tw.loadMetadataForFile(filepath).map(metadata => {
				tiddlers = [$tw.utils.extend({}, tiddlers[0], metadata)];
				return { filepath: filepath, type: type, tiddlers: tiddlers, hasMetaFile: true };
			});
		} else {
			return Observable.of({ filepath: filepath, type: type, tiddlers: tiddlers, hasMetaFile: false })
		}
	})
};

function loadMetadataForFile(filepath) {
	var metafilename = filepath + ".meta";
	return obs_exists()(metafilename).concatMap(([exists]) => {
		if (exists) return obs_readFile()(metafilename, "utf8");
		else return Observable.of([true]);
	}).map(([err, data]) => {
		if (err) return {};
		else return $tw.utils.parseFields(data) as {};
	});
};

$tw.boot.excludeRegExp = /^\.DS_Store$|^.*\.meta$|^\..*\.swp$|^\._.*$|^\.git$|^\.hg$|^\.lock-wscript$|^\.svn$|^\.wafpickle-.*$|^CVS$|^npm-debug\.log$/;

function loadTiddlersFromPath(filepath, excludeRegExp?) {
	excludeRegExp = excludeRegExp || $tw.boot.excludeRegExp;
	return obs_stat()(filepath).concatMap(([err, stat]) => {
		if (stat.isDirectory()) {
			return obs_readdir()(filepath).concatMap(([err, files]) => {
				if (files.indexOf("tiddlywiki.files") !== -1)
					return $tw.loadTiddlersFromSpecification(filepath, excludeRegExp);
				else return Observable.from(files).mergeMap(file => {
					if (!excludeRegExp.test(file) && file !== "plugin.info") {
						return $tw.loadTiddlersFromPath(filepath + path.sep + file, excludeRegExp);
					} else {
						return Observable.empty<never>();
					}
				});
			})
		} else if (stat.isFile()) {
			return $tw.loadTiddlersFromFile(filepath, { title: filepath });
		} else {
			return Observable.empty();
		}
	})
};

function loadTiddlersFromSpecification(filepath, excludeRegExp): Observable<{}> {
	var tiddlers = [];
	// Read the specification
	return obs_readFile()(filepath + path.sep + "tiddlywiki.files", "utf8").map(([err, data]) => {
		var filesInfo = JSON.parse(data);

		return Observable.merge(
			// Process the listed tiddlers
			obs_tw_each(filesInfo.tiddlers).mergeMap(([tidInfo]: [any]) => {
				if (tidInfo.prefix && tidInfo.suffix) {
					tidInfo.fields.text = { prefix: tidInfo.prefix, suffix: tidInfo.suffix };
				} else if (tidInfo.prefix) {
					tidInfo.fields.text = { prefix: tidInfo.prefix };
				} else if (tidInfo.suffix) {
					tidInfo.fields.text = { suffix: tidInfo.suffix };
				}
				return processFile(tidInfo.file, tidInfo.isTiddlerFile, tidInfo.fields);

			}),
			// Process any listed directories
			obs_tw_each(filesInfo.directories).mergeMap(([dirSpec]: [any]) => {
				// Read literal directories directly
				if (typeof dirSpec === "string") {
					var pathname = path.resolve(filepath, dirSpec);
					return obs_stat()(pathname).mergeMap(([err, stat]) => {
						if (!err && stat.isDirectory())
							return $tw.loadTiddlersFromPath(pathname, excludeRegExp)
						else
							return Observable.empty();
					})
				} else {
					// Process directory specifier
					var dirPath = path.resolve(filepath, dirSpec.path);
					return obs_readdir()(dirPath).map(([err, files]) => {
						var fileRegExp = new RegExp(dirSpec.filesRegExp || "^.*$"),
							metaRegExp = /^.*\.meta$/;
						return Observable.from(files).mergeMap(filename => {
							if (filename !== "tiddlywiki.files" && !metaRegExp.test(filename) && fileRegExp.test(filename)) {
								return processFile(dirPath + path.sep + filename, dirSpec.isTiddlerFile, dirSpec.fields);
							} else {
								return Observable.empty();
							}
						})
					})
				}
			})
		)
	})
	// Helper to process a file
	function processFile(filename, isTiddlerFile, fields): Observable<any> {
		var extInfo = $tw.config.fileExtensionInfo[path.extname(filename)],
			type = (extInfo || {}).type || fields.type || "text/plain",
			typeInfo = $tw.config.contentTypeInfo[type] || {},
			pathname = path.resolve(filepath, filename);
		return Observable.zip(
			obs_readFile()(pathname, typeInfo.encoding || "utf8"),
			$tw.loadMetadataForFile(pathname)
		).mergeMap(([text, metadata]) => {
			var fileTiddlers;
			if (isTiddlerFile) {
				fileTiddlers = $tw.wiki.deserializeTiddlers(path.extname(pathname), text, metadata) || [];
			} else {
				fileTiddlers = [$tw.utils.extend({ text: text }, metadata)];
			}
			var combinedFields = $tw.utils.extend({}, fields, metadata);
			return obs_tw_each(fileTiddlers).mergeMap(tiddler => {
				return obs_tw_each(combinedFields).mergeMap(([fieldInfo, name]: any) => {
					if (typeof fieldInfo === "string" || $tw.utils.isArray(fieldInfo)) {
						tiddler[name] = fieldInfo;
						//this will signal immediate completion
						return Observable.empty();
					} else {
						var value = tiddler[name];
						//holds an arraylike or observable with exactly one item
						var newValue: any = (() => {
							switch (fieldInfo.source) {
								case "filename":
									return [path.basename(filename)];
								case "filename-uri-decoded":
									return [decodeURIComponent(path.basename(filename))];
								case "basename":
									return [path.basename(filename, path.extname(filename))];
								case "basename-uri-decoded":
									return [decodeURIComponent(path.basename(filename, path.extname(filename)))];
								case "extname":
									return [path.extname(filename)];
								case "created":
									return obs_stat()(pathname).map(([err, stat]) => new Date(stat.birthtime));
								case "modified":
									return obs_stat()(pathname).map(([err, stat]) => new Date(stat.mtime));
							}
						})();
						//here we ignore elements to capture observable completion
						return Observable.from(newValue).do(value => {
							if (fieldInfo.prefix) {
								value = fieldInfo.prefix + value;
							}
							if (fieldInfo.suffix) {
								value = value + fieldInfo.suffix;
							}
							tiddler[name] = value;
						}).ignoreElements();
					}

				}).reduce((n) => n, tiddler); //we reduce this so the tiddler is eventually returned
			}).reduce<any, { tiddlers: any[] }>((n, e) => {
				n.tiddlers.push(e);
				return n;
			}, { tiddlers: [] })
		})
	};


}

function loadPluginFolder(filepath, excludeRegExp?) {
	excludeRegExp = excludeRegExp || $tw.boot.excludeRegExp;
	var infoPath = filepath + path.sep + "plugin.info";
	return obs_stat()(filepath).mergeMap(([err, stat]) => {
		if (err || !stat.isDirectory()) return Observable.empty();

		return obs_readFile()(infoPath, "utf8").mergeMap(([err, data]) => {
			if (err) {
				console.log("Warning: missing plugin.info file in " + filepath);
				return Observable.empty();
			}
			var pluginInfo = JSON.parse(data);
			return $tw.loadTiddlersFromPath(filepath, excludeRegExp).map(pluginFiles => {
				// Save the plugin tiddlers into the plugin info
				pluginInfo.tiddlers = pluginInfo.tiddlers || Object.create(null);
				for (var f = 0; f < pluginFiles.length; f++) {
					var tiddlers = pluginFiles[f].tiddlers;
					for (var t = 0; t < tiddlers.length; t++) {
						var tiddler = tiddlers[t];
						if (tiddler.title) {
							pluginInfo.tiddlers[tiddler.title] = tiddler;
						}
					}
				}
				// Give the plugin the same version number as the core if it doesn't have one
				if (!("version" in pluginInfo)) {
					pluginInfo.version = $tw.packageInfo.version;
				}
				// Use "plugin" as the plugin-type if we don't have one
				if (!("plugin-type" in pluginInfo)) {
					pluginInfo["plugin-type"] = "plugin";
				}
				pluginInfo.dependents = pluginInfo.dependents || [];
				pluginInfo.type = "application/json";
				// Set plugin text
				pluginInfo.text = JSON.stringify({ tiddlers: pluginInfo.tiddlers }, null, 4);
				delete pluginInfo.tiddlers;
				// Deserialise array fields (currently required for the dependents field)
				for (var field in pluginInfo) {
					if ($tw.utils.isArray(pluginInfo[field])) {
						pluginInfo[field] = $tw.utils.stringifyList(pluginInfo[field]);
					}
				}
				return pluginInfo;
			})
		})
	})
};

function findLibraryItem(name: string, paths: string[]) {
	return Observable.from(paths)
		.map(e => path.resolve(e, "./" + name))
		.concatMap(pluginPath => obs_stat()(pluginPath))
		.first(([err, stat]) => !err && stat.isDirectory())
		.map(([err, stat, tag, pluginPath]) => pluginPath);
};

function loadPlugin(name, paths) {
	return $tw.findLibraryItem(name, paths)
		.mergeMap(pluginPath => $tw.loadPluginFolder(pluginPath))
		.do(pluginInfo => $tw.wiki.addTiddler(pluginInfo))
		.ignoreElements();
};

function getLibraryItemSearchPaths(libraryPath, envVar) {
	var pluginPaths = [path.resolve($tw.boot.corePath, libraryPath)],
		env = process.env[envVar];
	if (env) {
		env.split(path.delimiter).map(function (item) {
			if (item) {
				pluginPaths.push(item)
			}
		});
	}
	return pluginPaths;
};
function loadPlugins(plugins, libraryPath, envVar) {
	var pluginPaths = $tw.getLibraryItemSearchPaths(libraryPath, envVar);
	if (plugins)
		return Observable.from(plugins).mergeMap(plugin => $tw.loadPlugin(plugin, pluginPaths));
	else
		return Observable.empty();
}

function loadWikiTiddlers(wikiPath, options?) {
	options = options || {};
	var parentPaths = options.parentPaths || [],
		wikiInfoPath = path.resolve(wikiPath, $tw.config.wikiInfo),
		wikiInfo,
		pluginFields;

	return obs_readFile()(wikiInfoPath, "utf8").mergeMap(([err, wikiInfoText]) => {
		var wikiInfo = JSON.parse(wikiInfoPath);

		// Load the wiki files, registering them as writable
		var resolvedWikiPath = path.resolve(wikiPath, $tw.config.wikiTiddlersSubDir);
		// Save the original tiddler file locations if requested
		var config = wikiInfo.config || {};
		if (config["retain-original-tiddler-path"]) {
			var output = {}, relativePath;
			for (var title in $tw.boot.files) {
				relativePath = path.relative(resolvedWikiPath, $tw.boot.files[title].filepath);
				output[title] =
					path.sep === path.posix.sep ?
						relativePath :
						relativePath.split(path.sep).join(path.posix.sep);
			}
			$tw.wiki.addTiddler({ title: "$:/config/OriginalTiddlerPaths", type: "application/json", text: JSON.stringify(output) });
		}
		// Save the path to the tiddlers folder for the filesystemadaptor
		$tw.boot.wikiTiddlersPath = path.resolve($tw.boot.wikiPath, config["default-tiddler-location"] || $tw.config.wikiTiddlersSubDir);

		parentPaths = parentPaths.slice(0);
		parentPaths.push(wikiPath);
		var loadIncludesObs = obs_tw_each(wikiInfo.includeWikis || []).map(([info]) => {
			if (typeof info === "string") {
				info = { path: info };
			}
			var resolvedIncludedWikiPath = path.resolve(wikiPath, info.path);
			if (parentPaths.indexOf(resolvedIncludedWikiPath) === -1) {
				return $tw.loadWikiTiddlers(resolvedIncludedWikiPath, {
					parentPaths: parentPaths,
					readOnly: info["read-only"]
				}).map(subWikiInfo => {
					// Merge the build targets
					wikiInfo.build = $tw.utils.extend([], subWikiInfo.build, wikiInfo.build);
				})
			} else {
				$tw.utils.error("Cannot recursively include wiki " + resolvedIncludedWikiPath);
			}
		})



		var loadWiki = $tw.loadTiddlersFromPath(resolvedWikiPath).do((tiddlerFile) => {
			if (!options.readOnly && tiddlerFile.filepath) {
				$tw.utils.each(tiddlerFile.tiddlers, function (tiddler) {
					$tw.boot.files[tiddler.title] = {
						filepath: tiddlerFile.filepath,
						type: tiddlerFile.type,
						hasMetaFile: tiddlerFile.hasMetaFile
					};
				});
			}
			$tw.wiki.addTiddlers(tiddlerFile.tiddlers);
		}).ignoreElements();
		// Load any plugins within the wiki folder
		var loadWikiPlugins = Observable.of(
			path.resolve(wikiPath, $tw.config.wikiPluginsSubDir),
			path.resolve(wikiPath, $tw.config.wikiThemesSubDir),
			path.resolve(wikiPath, $tw.config.wikiLanguagesSubDir)
		).mergeMap(wpp =>
			obs_readdir()(wpp)
		).mergeMap(([err, pluginFolders, tag, wikiPluginsPath]) => {
			if (err) return Observable.empty();
			return Observable.from(pluginFolders).mergeMap(folder => {
				return $tw.loadPluginFolder(path.resolve(wikiPluginsPath, "./" + folder))
			}).do(pluginFields => {
				$tw.wiki.addTiddler(pluginFields);
			}).ignoreElements();
		});
		return Observable.merge(
			// Load includeWikis
			loadIncludesObs,
			// Load any plugins, themes and languages listed in the wiki info file
			$tw.loadPlugins(wikiInfo.plugins, $tw.config.pluginsPath, $tw.config.pluginsEnvVar),
			$tw.loadPlugins(wikiInfo.themes, $tw.config.themesPath, $tw.config.themesEnvVar),
			$tw.loadPlugins(wikiInfo.languages, $tw.config.languagesPath, $tw.config.languagesEnvVar),
			// Load the wiki folder
			loadWikiPlugins
		).reduce(n => n, wikiInfo);
	})
};

function loadTiddlersNode() {

	// Load the boot tiddlers
	$tw.loadTiddlersFromPath($tw.boot.bootPath)
		.subscribe(tiddlerFile => $tw.wiki.addTiddlers(tiddlerFile.tiddlers));
	// Load the core tiddlers
	$tw.loadPluginFolder($tw.boot.corePath)
		.subscribe(pluginFolder => $tw.wiki.addTiddler(pluginFolder));
	// Load the tiddlers from the wiki directory
	if ($tw.boot.wikiPath) {
		$tw.loadWikiTiddlers($tw.boot.wikiPath)
			.subscribe(wikiInfo => $tw.boot.wikiInfo = wikiInfo);
	}
};