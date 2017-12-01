import { StateObject, keys, ServerConfig, AccessPathResult, AccessPathTag, DebugLogger, ErrorLogger } from "./server-types";
import { Observable } from "../lib/rx";

import * as path from 'path';
import * as http from 'http';
//import { TiddlyWiki } from 'tiddlywiki';
import { EventEmitter } from "events";
import { parse } from "url";

var settings: ServerConfig = {} as any;

const debug = DebugLogger('DAT');
const error = ErrorLogger('DAT');

const loadedFolders: { [k: string]: FolderData | ([http.IncomingMessage, http.ServerResponse])[] } = {};
const otherSocketPaths: { [k: string]: WebSocket[] } = {};

export function init(eventer: EventEmitter) {
    eventer.on('settings', function (set: ServerConfig) {
        settings = set;
    })
    eventer.on('websocket-connection', function (client: WebSocket, request: http.IncomingMessage) {
        let reqURL = parse(request.url as string);// new URL(request.url as string);
        let datafolder = loadedFolders[reqURL.pathname as string] as FolderData;
        debug([reqURL.pathname as string, !!datafolder].join(' '));
        if (!datafolder) {
            if (!otherSocketPaths[reqURL.pathname as string])
                otherSocketPaths[reqURL.pathname as string] = [];
            let other = otherSocketPaths[reqURL.pathname as string]
            other.push(client);
            client.addEventListener('message', event => {
                other.forEach(e => {
                    if (e === client) return;
                    e.send(event.data);
                })
            });
            client.addEventListener('error', (event) => {
                debug('WS-ERROR %s %s', reqURL.pathname, event.type)
                other.splice(other.indexOf(client), 1);
                client.close();
            });
            client.addEventListener('close', (event) => {
                debug('WS-CLOSE %s %s %s', reqURL.pathname, event.code, event.reason);
                other.splice(other.indexOf(client), 1);
            });
            return;
        }
        datafolder.sockets.push(client);

        client.addEventListener('message', (event) => {
            datafolder.$tw.hooks.invokeHook('th-websocket-message', event.data, client);
        })
        client.addEventListener('error', (event) => {
            debug('WS-ERROR %s %s', reqURL.pathname, event.type)
            datafolder.sockets.splice(datafolder.sockets.indexOf(client), 1);
            client.close();
        })
        client.addEventListener('close', (event) => {
            debug('WS-CLOSE %s %s %s', reqURL.pathname, event.code, event.reason);
            datafolder.sockets.splice(datafolder.sockets.indexOf(client), 1);
        })
    })
}

type FolderData = {
    $tw: any, //$tw.global,
    prefix: string,
    folder: string,
    server: any, //$tw.core.modules.commands.server.Server,
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;
    sockets: WebSocket[];
};

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
        //
        //redirect ?reload=true requests to the same,to prevent it being 
        //reloaded multiple times for the same page load.

        if (isFullpath && !settings.useTW5path !== !state.url.pathname.endsWith("/")
            || state.url.query.reload === "true") {
            let redirect = prefixURI + (settings.useTW5path ? "/" : "");
            state.res.writeHead(302, {
                'Location': redirect
            });
            state.res.end();
            return Observable.empty();
        }
        //pretend to the handler like the path really has a trailing slash

        let req = new Object(state.req) as http.IncomingMessage;
        req.url += ((isFullpath && !settings.useTW5path) ? "/" : "");
        console.log(req.url);
        const load = loadedFolders[prefixURI];
        if (Array.isArray(load)) {
            load.push([req, state.res]);
        } else {
            load.handler(req, state.res);
        }
        return Observable.empty<StateObject>();
    })
}

function loadTiddlyWiki(prefix: string, folder: string) {

    console.time('twboot-' + folder);
    // const dynreq = "tiddlywiki";
    require("./boot-datafolder.js").DataFolder(prefix, folder, complete);

    function complete(err, $tw) {
        console.timeEnd('twboot-' + folder);
        if (err) {
            return doError(prefix, folder, err);
        }

        //we use $tw.modules.execute so that the module has its respective $tw variable.
        var serverCommand;
        try {
            serverCommand = $tw.modules.execute('$:/core/modules/commands/server.js').Command;
        } catch (e) {
            doError(prefix, folder, e);
            return;
        }
        var command = new serverCommand([], { wiki: $tw.wiki });
        var server = command.server;

        server.set({
            rootTiddler: "$:/core/save/all",
            renderType: "text/plain",
            serveType: "text/html",
            username: settings.username,
            password: "",
            pathprefix: prefix
        });
        //websocket requests coming in here will need to be handled 
        //with $tw.hooks.invokeHook('th-websocket-message', event);

        const requests = loadedFolders[prefix] as any[];
        const handler = server.requestHandler.bind(server);
        loadedFolders[prefix] = {
            $tw,
            prefix,
            folder,
            server,
            handler,
            sockets: []
        }
        $tw.hooks.addHook('th-websocket-broadcast', function (message, ignore) {
            let folder = loadedFolders[prefix] as FolderData;
            if (typeof message === 'object') message = JSON.stringify(message);
            else if (typeof message !== "string") message = message.toString();
            folder.sockets.forEach(client => {
                if (ignore.indexOf(client) > -1) return;
                client.send(message);
            })
        });
        //send the requests to the handler
        requests.forEach(e => {
            handler(e[0], e[1]);
        })
    }


};

function doError(prefix, folder, err) {
    error('error starting %s at %s: %s', prefix, folder, err.stack);
    const requests = loadedFolders[prefix] as any[];
    loadedFolders[prefix] = {
        handler: function (req: http.IncomingMessage, res: http.ServerResponse) {
            res.writeHead(500, "TW5 data folder failed");
            res.write("The Tiddlywiki data folder failed to load. The error has been logged to the terminal. " +
                " To try again, use ?reload=true after making any necessary corrections.");
            res.end();
        }
    } as any;
    requests.forEach(([req, res]) => {
        (loadedFolders[prefix] as { handler: any }).handler(req, res);
    })

}