import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';

import { format } from "util";
import { Observable, Subscriber } from './lib/rx';
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
export function sortBySelector<T extends { [k: string]: string }>(key: (e: T) => any) {
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
export namespace colors {
    export const Reset = "\x1b[0m"
    export const Bright = "\x1b[1m"
    export const Dim = "\x1b[2m"
    export const Underscore = "\x1b[4m"
    export const Blink = "\x1b[5m"
    export const Reverse = "\x1b[7m"
    export const Hidden = "\x1b[8m"

    export const FgBlack = "\x1b[30m"
    export const FgRed = "\x1b[31m"
    export const FgGreen = "\x1b[32m"
    export const FgYellow = "\x1b[33m"
    export const FgBlue = "\x1b[34m"
    export const FgMagenta = "\x1b[35m"
    export const FgCyan = "\x1b[36m"
    export const FgWhite = "\x1b[37m"

    export const BgBlack = "\x1b[40m"
    export const BgRed = "\x1b[41m"
    export const BgGreen = "\x1b[42m"
    export const BgYellow = "\x1b[43m"
    export const BgBlue = "\x1b[44m"
    export const BgMagenta = "\x1b[45m"
    export const BgCyan = "\x1b[46m"
    export const BgWhite = "\x1b[47m"
}
export function DebugLogger(prefix: string) {
    return function (str: string, ...args: any[]) {
        let t = new Date();
        let date = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.log([colors.FgGreen + prefix, date + colors.Reset, format.apply(null, arguments)].join(' '));
    };
}
export function ErrorLogger(prefix: string) {
    return function (str: string, ...args: any[]) {
        let t = new Date();
        let date = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.error([colors.FgRed + prefix, colors.FgYellow + date + colors.Reset, format.apply(null, arguments)].join(' '));
    };
}
export function sanitizeJSON(key: string, value: any) {
    // returning undefined omits the key from being serialized
    if (!key) { return value; } //This is the entire value to be serialized
    else if (key.substring(0, 1) === "$") return; //Remove angular tags
    else if (key.substring(0, 1) === "_") return; //Remove NoSQL tags, including _id
    else return value;
}

export function handleProgrammersException(logger: any, err: any, message: any) {

}

export interface ServeStaticResult {
    status: number,
    headers: {},
    message: string
}

export const serveStatic: (path: string, state: StateObject, stat: fs.Stats) => Observable<[
    boolean, ServeStaticResult
]> = (function () {
    interface Server {
        serveFile(pathname: string, status: number, headers: {}, req: http.IncomingMessage, res: http.ServerResponse): EventEmitter
        respond(...args: any[]): any;
        finish(...args: any[]): any;
    }
    const staticServer = require('./lib/node-static');
    const serve = new staticServer.Server({ mount: '/' }) as Server;
    const promise = new EventEmitter();
    return function (path: string, state: StateObject, stat: fs.Stats) {
        const { req, res } = state;
        return Observable.create((subs: Subscriber<[boolean, ServeStaticResult]>) => {
            serve.respond(null, 200, {
                'x-api-access-type': 'file'
            }, [path], stat, req, res, function (status: number, headers: any) {
                serve.finish(status, headers, req, res, promise, (err: ServeStaticResult, res: ServeStaticResult) => {
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

type NodeCallback<T, S> = [NodeJS.ErrnoException, T, S];

export const obs_stat = <T>(state: T) => Observable.bindCallback(
    fs.stat, (err, stat): NodeCallback<fs.Stats, T> => [err, stat, state]);

export const obs_readdir = <T>(state: T) => Observable.bindCallback(
    fs.readdir, (err, files): NodeCallback<string[], T> => [err, files, state]);

export const obs_readFile = <T>(state: T) => Observable.bindCallback(
    fs.readFile, (err, data): NodeCallback<string | Buffer, T> => [err, data, state]);

export const obs_writeFile = <T>(state: T) => Observable.bindCallback(
    fs.writeFile, (err, data): NodeCallback<string | Buffer, T> => [err, data, state]);


export class StateError extends Error {
    state: StateObject;
    constructor(state: StateObject, message: string) {
        super(message);
        this.state = state;
    }
}

export type LoggerFunc = (str: string, ...args: any[]) => void;

export class StateObject implements ThrowFunc<StateObject>{

    static errorRoute(status: number, reason?: string) {
        return (obs: Observable<any>) => {
            return obs.mergeMap((state: StateObject) => {
                return state.throw(status, reason);
            })
        }
    }

    // req: http.IncomingMessage;
    // res: http.ServerResponse;
    startTime: [number, number];
    timestamp: string;

    body: string;
    json: any | undefined;

    url: {
        href: string;
        protocol: string;
        auth?: string;
        host: string;
        hostname: string;
        port?: string;
        pathname: string;
        path: string;
        search?: string;
        query?: string | any;
        slashes?: boolean;
        hash?: string;
    };
    path: string[];

    maxid: number;

    where: string;
    query: any;
    errorThrown: Error;

    restrict: any;

    expressNext: ((err?: any) => void) | false;



    // private debugLog: LoggerFunc;
    // private errorLog: LoggerFunc;

    constructor(
        public req: http.IncomingMessage,
        public res: http.ServerResponse,
        private debugLog: LoggerFunc,
        private errorLog: LoggerFunc
    ) {
        // this.req = req;
        // this.res = res;
        // this.debugLog = debugLog;
        // this.errorLog = errorLog;
        this.startTime = process.hrtime();
        //parse the url and store in state.
        //a server request will definitely have the required fields in the object
        this.url = url.parse(this.req.url as string, true) as any
        //parse the path for future use
        this.path = (this.url.pathname as string).split('/')

        let t = new Date();
        this.timestamp = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
    }
    debug(str: string, ...args: any[]) {
        this.debugLog('[' +
            this.req.socket.remoteFamily + '-' + colors.FgMagenta +
            this.req.socket.remoteAddress + colors.Reset + '] ' +
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
        this.errorLog('[' +
            this.req.socket.remoteFamily + '-' + colors.FgMagenta +
            this.req.socket.remoteAddress + colors.Reset + '] ' +
            format.apply(null, arguments)
        );
    }
    throw<T>(statusCode: number, reason?: string, str?: string | {}, ...args: any[]): Observable<T>;
    throw(statusCode: number, reason?: string, str?: string | {}, ...args: any[]): Observable<StateObject> {
        //throw<T>(statusCode: number, reason?, str?: string, ...args: any[]): Observable<T>
        //throw(statusCode: number, reason?, str?: string, ...args: any[]): Observable<any> {
        let headers = (typeof str === 'object') ? str : null;
        if (headers) str = args.shift();
        this.errorThrown = new StateError(this, format.bind(null, str || reason || 'status code ' + statusCode).apply(null, args));
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
    endJSON(data: any) {
        this.res.write(JSON.stringify(data));
        this.res.end();
    }

}

export interface ThrowFunc<T> {
    throw(statusCode: number, reason?: string, str?: string, ...args: any[]): Observable<T>;
}

export interface ServerConfig {
    tree: any,
    //watch: string[], //not implemented
    types: {
        htmlfile: string[];
        [K: string]: string[]
    }
    username?: string,
    password?: string,
    host?: string,
    port?: number | 8080,
    backupDirectory?: string
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
    treepath: string,
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
    let code = args.shift() as keyof typeof ERRORS;
    if (ERRORS[code]) args.unshift(ERRORS[code])
    //else args.unshift(code);
    return { code: code, message: format.apply(null, args) };
}


