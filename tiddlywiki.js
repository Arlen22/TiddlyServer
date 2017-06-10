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
function datafolder(obs) {
    return obs.mergeMap(res => {
        let { tag, type, statItem, statTW, end, isFullpath } = res;
        /**
         * reqpath  is the prefix for the folder in the folder tree
         * item     is the folder string in the category tree that reqpath led to
         * filepath is the path relative to them
         */
        let { state, item, filepath, reqpath } = tag;
        //TiddlyWiki requires a trailing slash for the root url
        if (isFullpath && !state.url.pathname.endsWith("/")) {
            state.res.writeHead(302, {
                'Location': state.url.pathname + "/"
            });
            state.res.end();
            return rx_1.Observable.empty();
        }
        let suffix = filepath.split('/').slice(0, end).join('/');
        let prefix = ["", reqpath, suffix].join('/').split('/');
        let prefixURI = state.url.pathname.split('/').slice(0, prefix.length).join('/');
        let folder = path.join(item, suffix);
        //console.log('%s %s', prefix, folder);
        loadTiddlyWiki(prefixURI, folder).then(handler => {
            handler(state.req, state.res);
        });
        return rx_1.Observable.empty();
    });
}
exports.datafolder = datafolder;
function loadTiddlyWiki(prefix, folder) {
    if (loadedFolders[prefix])
        return Promise.resolve(loadedFolders[prefix].handler);
    else
        return new Promise(resolve => {
            const $tw = require("tiddlywiki/boot/boot.js").TiddlyWiki();
            $tw.boot.argv = [folder];
            const execute = $tw.boot.executeNextStartupTask;
            $tw.boot.executeNextStartupTask = function () {
                const res = execute();
                if (res === false)
                    complete();
            };
            function complete() {
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
                loadedFolders[prefix] = {
                    $tw,
                    prefix,
                    folder,
                    server,
                    handler: server.requestHandler.bind(server)
                };
                resolve(loadedFolders[prefix].handler);
            }
            $tw.boot.boot();
            $tw.wiki.addTiddler({
                "text": "$protocol$//$host$" + prefix + "/",
                "title": "$:/config/tiddlyweb/host"
            });
        });
}
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlkZGx5d2lraS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRpZGRseXdpa2kudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxpQ0FBc0M7QUFFdEMsNkJBQTZCO0FBRTdCLElBQUksUUFBUSxHQUFpQixFQUFTLENBQUM7QUFFdkMsY0FBcUIsT0FBTztJQUN4QixPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQUc7UUFDaEMsUUFBUSxHQUFHLEdBQUcsQ0FBQztJQUNuQixDQUFDLENBQUMsQ0FBQTtBQUNOLENBQUM7QUFKRCxvQkFJQztBQUVELE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUV6QixvQkFBMkIsR0FBZ0Q7SUFDdkUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRztRQUNuQixJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsR0FBRyxHQUFHLENBQUM7UUFDM0Q7Ozs7V0FJRztRQUNILElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsR0FBRyxHQUFHLENBQUM7UUFFN0MsdURBQXVEO1FBQ3ZELEVBQUUsQ0FBQyxDQUFDLFVBQVUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFO2dCQUNyQixVQUFVLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsR0FBRzthQUN2QyxDQUFDLENBQUM7WUFDSCxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ2hCLE1BQU0sQ0FBQyxlQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDOUIsQ0FBQztRQUVELElBQUksTUFBTSxHQUFHLFFB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