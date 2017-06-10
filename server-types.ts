import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';

import { format } from "util";
import { Observable } from './lib/rx';
import { EventEmitter } from "events";
//import { StateObject } from "./index";

export interface test {

}

export type FolderEntryType = 'folder' | 'datafolder' | 'htmlfile' | 'other' | 'error';

export interface DirectoryEntry {
    name: string,
    type: FolderEntryType,
    path: string,
    mime?: string,
    icon?: string,
    size?: string
    //folder?: string,
}

export interface Directory {
    path: string,
    entries: DirectoryEntry[]
    type: string
}

export function keys<T>(o: T): (keyof T)[] {
    return Object.keys(o) as (keyof T)[];
}
export function padLeft(str: any, pad: number | string, padStr?: string): string {
    var item = str.toString();
    if (typeof padStr === 'undefined')
        padStr = ' ';
    if (typeof pad === 'number') {
        pad = new Array(pad + 1).join(padStr);
    }
    //pad: 000000 val: 6543210 => 654321
    return pad.substr(0, Math.max(pad.length - item.length, 0)) + item;
}
export function sortBySelector<T>(key: (e: T) => any) {
    return function (a: T, b: T) {
        var va = key(a);
        var vb = key(b);

        if (va > vb)
            return 1;
        else if (va < vb)
            return -1;
        else
            return 0;
    }

}
export function sortByKey(key: string) {
    return sortBySelector(e => e[key]);
}
export function DebugLogger(prefix) {
    return function (str: string, ...args: any[]) {
        let t = new Date();
        let date = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.debug(['  ', prefix, date, format.apply(null, arguments)].join(' '));
    };
}
export function ErrorLogger(prefix) {
    return function (str: string, ...args: any[]) {
        let t = new Date();
        let date = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.error([prefix, date, format.apply(null, arguments)].join(' '));
    };
}
export function sanitizeJSON(key, value) {
    // returning undefined omits the key from being serialized
    if (!key) { return value; } //This is the entire value to be serialized
    else if (key.substring(0, 1) === "$") return; //Remove angular tags
    else if (key.substring(0, 1) === "_") return; //Remove NoSQL tags, including _id
    else return value;
}

export function handleProgrammersException(logger, err, message) {

}

export const serveStatic: (path, state, stat: fs.Stats) => Observable<[
    boolean,
    {
        status: number,
        headers: {},
        message: string
    }
]> = (function () {
    interface Server {
        serveFile(pathname: string, status: number, headers: {}, req: http.IncomingMessage, res: http.ServerResponse): EventEmitter
        respond(...args): any;
        finish(...args): any;
    }
    const staticServer = require('./lib/node-static');
    const serve = new staticServer.Server({ mount: '/' }) as Server;
    const promise = new EventEmitter();
    return function (path, state, stat: fs.Stats) {
        const { req, res } = state;
        return Observable.create(subs => {
            serve.respond(null, 200, {
                'x-api-access-type': 'file'
            }, [path], stat, req, res, function (status, headers) {
                serve.finish(status, headers, req, res, promise, (err, res) => {
                    if (err) {
                        subs.next([true, err]);
                    } else {
                        subs.next([false, res]);
                    }
                    subs.complete();
                });
            });
        })
    }

})();

export class StateError extends Error {
    state: StateObject;
    constructor(state, message) {
        super(message);
        this.state = state;
    }
}

export class StateObject implements ThrowFunc<StateObject>{
    req: http.IncomingMessage;
    res: http.ServerResponse;
    startTime: [number, number];
    timestamp: string;

    body: string;
    json: any | undefined;

    url: url.Url;
    path: string[];

    maxid: number;

    where: string;
    query: any;
    errorThrown: Error;

    restrict: any;

    expressNext: ((err?) => void) | false;

    private debugLog: (str: string, ...args: any[]) => void;
    private errorLog: (str: string, ...args: any[]) => void;

    constructor(req, res, debugLog, errorLog) {
        this.req = req;
        this.res = res;
        this.debugLog = debugLog;
        this.errorLog = errorLog;
        this.startTime = process.hrtime();
        //parse the url and store in state
        this.url = url.parse(this.req.url, true)
        //parse the path for future use
        this.path = (this.url.pathname).split('/')

        let t = new Date();
        this.timestamp = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
    }
    debug(str: string, ...args: any[]) {
        this.debugLog(' [' +
            this.req.socket.remoteFamily + '-' +
            this.req.socket.remoteAddress + '] ' +
            format.apply(null, arguments)
        );
    }

    /*log(str: string, ...args: any[]) {
        console.log(this.timestamp + ' [' +
            this.req.socket.remoteFamily + '-' +
            this.req.socket.remoteAddress + '] ' +
            format.apply(null, arguments)
        );
    }*/
    error(str: string, ...args: any[]) {
        this.errorLog(' [' +
            this.req.socket.remoteFamily + '-' +
            this.req.socket.remoteAddress + '] ' +
            format.apply(null, arguments)
        );
    }
    throw(statusCode: number, reason?, str?: string | {}, ...args: any[]): Observable<StateObject> {
        //throw<T>(statusCode: number, reason?, str?: string, ...args: any[]): Observable<T>
        //throw(statusCode: number, reason?, str?: string, ...args: any[]): Observable<any> {
        let headers = (typeof str === 'object') ? str : null;
        if (headers) str = args.shift();
        this.errorThrown = new StateError(null, format.bind(null, str || reason || 'status code ' + statusCode).apply(null, args));
        if (!this.res.headersSent) {
            this.res.writeHead(statusCode, reason && reason.toString(), headers);
            //don't write 204 reason
            if (statusCode !== 204 && reason) this.res.write(reason.toString());
        }
        this.res.end();
        //don't log anything if we only have a status code
        if (str || reason) this.error('state error ' + this.errorThrown.message);
        return Observable.empty<StateObject>();
    }
    endJSON(data) {
        this.res.write(JSON.stringify(data));
        this.res.end();
    }

}

export class StateObjectServer extends StateObject {
    expressNext: false = false;
}

export class StateObjectExpress extends StateObject implements ThrowFunc<StateObjectExpress> {
    expressNext: (err?) => void;

    constructor(req, res, next, debugLog, errorLog) {
        super(req, res, debugLog, errorLog);
        this.expressNext = next;
    }

    throw(statusCode: number, reason?: any, str?: string, ...args: any[]): Observable<StateObjectExpress> {
        this.errorThrown = new StateError(null, format.bind(null, str || reason || 'status code ' + statusCode).apply(null, args));
        this.expressNext(this.errorThrown);
        return Observable.empty<StateObject>();
    }


}




export interface ThrowFunc<T> {
    throw(statusCode: number, reason?, str?: string, ...args: any[]): Observable<T>;
}

export interface ServerConfig {
    tree: any;
    watch: string[];
    types: { [K: string]: string[] }
    //"devEnv": string;
    //"staticPath": string;
    "username": string;
    "password": string;

}

export interface AccessPathResult<T> {
    isFullpath: boolean,
    type: string | NodeJS.ErrnoException,
    tag: T,
    end: number,
    statItem: fs.Stats,
    statTW?: fs.Stats
};
export interface AccessPathTag {
    state: StateObject,
    item: string | {},
    reqpath: string,
    filepath: string
};

export function createHashmapString<T>(keys: string[], values: T[]): { [id: string]: T } {
    if (keys.length !== values.length)
        throw 'keys and values must be the same length';
    var obj: { [id: string]: T } = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    })
    return obj;
}
export function createHashmapNumber<T>(keys: number[], values: T[]): { [id: number]: T } {
    if (keys.length !== values.length)
        throw 'keys and values must be the same length';
    var obj: { [id: number]: T } = {};
    keys.forEach((e, i) => {
        obj[e] = values[i];
    })
    return obj;
}



const ERRORS = {
    'PROGRAMMER_EXCEPTION': 'A programmer exception occurred: %s'
}

export function getError(code: 'PRIMARY_KEYS_REQUIRED'): any;
export function getError(code: 'OLD_REVISION'): any;
export function getError(code: 'KEYS_REQUIRED', keyList: string): any;
export function getError(code: 'ROW_NOT_FOUND', table: string, id: string): any;
export function getError(code: 'PROGRAMMER_EXCEPTION', message: string): any;
export function getError(code: string, ...args: string[]): any;
export function getError(...args: string[]) {
    let code = args.shift();
    if (ERRORS[code]) args.unshift(ERRORS[code])
    //else args.unshift(code);
    return { code: code, message: format.apply(null, args) };
}


