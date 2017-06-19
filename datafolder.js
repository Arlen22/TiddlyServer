"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("./lib/rx");
const path = require("path");
var settings = {};
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
        let { state, item, filepath, reqpath } = tag;
        //TiddlyWiki requires a trailing slash for the root url
        let suffix = filepath.split('/').slice(0, end).join('/');
        let prefix = ["", reqpath, suffix].join('/').split('/');
        let prefixURI = state.url.pathname.split('/').slice(0, prefix.length).join('/');
        let folder = path.join(item, suffix);
        if (!loadedFolders[prefixURI] || state.url.query.reload === "true") {
            loadedFolders[prefixURI] = [];
            loadTiddlyWiki(prefixURI, folder);
        }
        //require a trailing slash for data folders, and redirect ?reload=true requests to the same,
        //to prevent it being reloaded multiple times for the same page load.
        if (isFullpath && !state.url.pathname.endsWith("/") || state.url.query.reload === "true") {
            state.res.writeHead(302, {
                'Location': encodeURI(prefixURI) + "/"
            });
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
    $tw.boot.boot();
    $tw.wiki.addTiddler({
        "text": "$protocol$//$host$" + prefix + "/",
        "title": "$:/config/tiddlyweb/host"
    });
    // }
}
;
