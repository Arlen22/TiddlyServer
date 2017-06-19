import { StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag } from "./server-types";
import { Observable } from "./lib/rx";

import * as path from 'path';
import * as http from 'http';
//import { TiddlyWiki } from 'tiddlywiki';
import { EventEmitter } from "events";

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
        let { state, item, filepath, reqpath } = tag;

        //TiddlyWiki requires a trailing slash for the root url


        let suffix = filepath.split('/').slice(0, end).join('/');
        let prefix = ["", reqpath, suffix].join('/').split('/');
        let prefixURI = state.url.pathname.split('/').slice(0, prefix.length).join('/');
        let folder = path.join(item as string, suffix);

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

    console.time('twboot');
    const $tw = require("tiddlywiki").TiddlyWiki();
    $tw.boot.argv = [folder];
    const execute = $tw.boot.executeNextStartupTask;
    $tw.boot.executeNextStartupTask = function(){
        const res = execute();
        if(!res) complete();
        return true;
    }
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
    $tw.boot.boot();
    $tw.wiki.addTiddler({
        "text": "$protocol$//$host$" + prefix + "/",
        "title": "$:/config/tiddlyweb/host"
    });
    // }
};