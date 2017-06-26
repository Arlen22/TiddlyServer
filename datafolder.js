"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
const rx_1 = require("./lib/rx");
const path = require("path");
var settings = {};
const debug = server_types_1.DebugLogger('DAT');
const error = server_types_1.ErrorLogger('DAT');
function init(eventer) {
    eventer.on('settings', function (set) {
        settings = set;
    });
}
exports.init = init;
const loadedFolders = {};
function quickArrayCheck(obj) {
    return typeof obj.length === 'number';
}
function datafolder(obs) {
    //warm the cache
    //require("tiddlywiki/boot/boot.js").TiddlyWiki();
    return obs.mergeMap(res => {
        let { tag, type, statItem, statTW, end, isFullpath } = res;
        /**
         * reqpath  is the prefix for the folder in the folder tree
         * item     is the folder string in the category tree that reqpath led to
         * filepath is the path relative to them
         */
        let { state, item, filepath, treepath } = tag;
        //get the actual path to the folder from filepath
        let filepathPrefix = filepath.split('/').slice(0, end).join('/');
        //get the tree path, and add the file path if there is one
        let fullPrefix = ["", treepath];
        if (filepathPrefix)
            fullPrefix.push(filepathPrefix);
        //join the parts and split into an array
        fullPrefix = fullPrefix.join('/').split('/');
        //use the unaltered path in the url as the tiddlywiki prefix
        let prefixURI = state.url.pathname.split('/').slice(0, fullPrefix.length).join('/');
        //get the full path to the folder as specified in the tree
        let folder = path.join(item, filepathPrefix);
        //initialize the tiddlywiki instance
        if (!loadedFolders[prefixURI] || state.url.query.reload === "true") {
            loadedFolders[prefixURI] = [];
            loadTiddlyWiki(prefixURI, folder);
        }
        //Tiddlywiki requires a trailing slash for data folders, and
        //redirect ?reload=true requests to the same,to prevent it being 
        //reloaded multiple times for the same page load.
        if (isFullpath && !state.url.pathname.endsWith("/") || state.url.query.reload === "true") {
            state.res.writeHead(302, { 'Location': encodeURI(prefixURI) + "/" });
            state.res.end();
            return rx_1.Observable.empty();
        }
        const load = loadedFolders[prefixURI];
        if (Array.isArray(load)) {
            load.push([state.req, state.res]);
        }
        else {
            load.handler(state.req, state.res);
        }
        return rx_1.Observable.empty();
    });
}
exports.datafolder = datafolder;
function loadTiddlyWiki(prefix, folder) {
    console.time('twboot');
    const $tw = require("tiddlywiki").TiddlyWiki();
    $tw.boot.argv = [folder];
    const execute = $tw.boot.executeNextStartupTask;
    $tw.boot.executeNextStartupTask = function () {
        const res = execute();
        if (!res)
            complete();
        return true;
    };
    function complete() {
        console.log('complete');
        console.timeEnd('twboot');
        $tw.wiki.addTiddler({
            "text": "$protocol$//$host$" + prefix + "/",
            "title": "$:/config/tiddlyweb/host"
        });
        //we use $tw.modules.execute so that the module has its respective $tw variable.
        var serverCommand = $tw.modules.execute('$:/core/modules/commands/server.js').Command;
        var command = new serverCommand([], { wiki: $tw.wiki });
        var server = command.server;
        server.set({
            rootTiddler: "$:/core/save/all",
            renderType: "text/plain",
            serveType: "text/html",
            username: "",
            password: "",
            pathprefix: prefix
        });
        const requests = loadedFolders[prefix];
        const handler = server.requestHandler.bind(server);
        loadedFolders[prefix] = {
            $tw,
            prefix,
            folder,
            server,
            handler
        };
        //send the requests to the handler
        requests.forEach(e => {
            handler(e[0], e[1]);
        });
    }
    try {
        $tw.boot.boot();
    }
    catch (err) {
        error('error starting %s at %s: %s', prefix, folder, err);
        loadedFolders[prefix].forEach(([req, res]) => {
            server_types_1.StateObject.prototype.throw.apply({
                req, res, error
            }, [500, "Error booting Tiddlywiki data folder"]);
        });
        loadedFolders[prefix] = {
            handler: function (req, res) {
                res.writeHead(500, "Tiddlywiki datafolder failed to load");
                res.write("The Tiddlywiki data folder failed to load. To try again, use ?reload=true " +
                    "after making any necessary corrections.");
                res.end();
            }
        };
    }
}
;
