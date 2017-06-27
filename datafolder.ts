import { StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag, DebugLogger, ErrorLogger } from "./server-types";
import { Observable } from "./lib/rx";

import * as path from 'path';
import * as http from 'http';
//import { TiddlyWiki } from 'tiddlywiki';
import { EventEmitter } from "events";

const debug = DebugLogger('DAT');
const error = ErrorLogger('DAT');
var settings: ServerConfig = {} as any;

export function init(eventer: EventEmitter) {
    eventer.on('settings', function (set: ServerConfig) {
        settings = set;
    })
}

type FolderData = {
    $tw: any, //$tw.global,
    prefix: string,
    folder: string,
    server: any, //$tw.core.modules.commands.server.Server,
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;
};
const loadedFolders: { [k: string]: FolderData | ([http.IncomingMessage, http.ServerResponse])[] } = {};

function quickArrayCheck(obj: any): obj is Array<any> {
    return typeof obj.length === 'number';
}

export function datafolder(obs: Observable<AccessPathResult<AccessPathTag>>) {
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
        if (filepathPrefix) fullPrefix.push(filepathPrefix);
        //join the parts and split into an array
        fullPrefix = fullPrefix.join('/').split('/');
        //use the unaltered path in the url as the tiddlywiki prefix
        let prefixURI = state.url.pathname.split('/').slice(0, fullPrefix.length).join('/');
        //get the full path to the folder as specified in the tree
        let folder = path.join(item as string, filepathPrefix);
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
            return Observable.empty();
        }

        const load = loadedFolders[prefixURI];
        if (Array.isArray(load)) {
            load.push([state.req, state.res]);
        } else {
            load.handler(state.req, state.res);
        }

        return Observable.empty<StateObject>();
    })
}

function loadTiddlyWiki(prefix: string, folder: string) {
    debug('boot');
    console.time('twboot');
    const $tw = require("./tiddlywiki-compiled/boot/boot.js").TiddlyWiki();
    $tw.boot.argv = [folder];
    const execute = $tw.boot.executeNextStartupTask;
    $tw.boot.executeNextStartupTask = function () {
        const res = execute();
        if (!res) 
            complete();
        return true;
    }
    function complete() {
        debug('complete');
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
        const requests = loadedFolders[prefix] as any[];
        const handler = server.requestHandler.bind(server);
        loadedFolders[prefix] = {
            $tw,
            prefix,
            folder,
            server,
            handler
        }
        //send the requests to the handler
        requests.forEach(e => {
            handler(e[0], e[1]);
        })

    }
    try {
        $tw.boot.boot();
    } catch (err) {
        error('error starting %s at %s: %s', prefix, folder, err.stack);
        (loadedFolders[prefix] as any[]).forEach(([req, res]) => {
            StateObject.prototype.throw.apply({
                req, res, error
            }, [500, "Error booting Tiddlywiki data folder"]);
        })
        loadedFolders[prefix] = {
            handler: function (req: http.IncomingMessage, res: http.ServerResponse) {
                res.writeHead(500, "Tiddlywiki datafolder failed to load");
                res.write("The Tiddlywiki data folder failed to load. To try again, use ?reload=true " +
                    "after making any necessary corrections.");
                res.end();
            }
        } as any;
    }
};