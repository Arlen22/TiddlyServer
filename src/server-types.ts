import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';

import { format } from "util";
import { Observable, Subscriber } from '../lib/rx';
import { EventEmitter } from "events";
//import { StateObject } from "./index";

export type Hashmap<T> = { [K: string]: T };

export type FolderEntryType = 'folder' | 'datafolder' | 'htmlfile' | 'other' | 'error';

export interface DirectoryEntry {
    name: string,
    type: string,
    path: string,
    size: string
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

const DEBUGLEVEL = -1;
/**
 *  4 - Errors that require the process to exit for restart
 *  3 - Major errors that are handled and do not require a server restart
 *  2 - Warnings or errors that do not alter the program flow but need to be marked (minimum for status 500)
 *  1 - Info - Most startup messages
 *  0 - Normal debug messages and all software and request-side error messages
 * -1 - Detailed debug messages from high level apis
 * -2 - Response status messages and error response data
 * -3 - Request and response data for all messages (verbose)
 * -4 - Protocol details and full data dump (such as encryption steps and keys)
 */
declare function DebugLog(level: number, str: string, ...args: any[]);
declare function DebugLog(str: string, ...args: any[]);

export function DebugLogger(prefix: string): typeof DebugLog {
    //if(prefix.startsWith("V:")) return function(){};
    return function (...args: any[]) {
        //this sets the default log level for the message
        var msgLevel = 0;
        if (typeof args[0] === "number") {
            if (DEBUGLEVEL > args[0]) return;
            else msgLevel = args.shift();
        } else {
            if (DEBUGLEVEL > msgLevel) return;
        }
        let t = new Date();
        let date = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        console.log([' ', (msgLevel >= 3 ? (colors.BgRed + colors.FgWhite) : colors.FgRed) + prefix,
            colors.FgCyan, date, colors.Reset, format.apply(null, args)].join(' ').split('\n').map((e, i) => {
                if (i > 0) {
                    return new Array(28 + prefix.length).join(' ') + e;
                } else {
                    return e;
                }
            }).join('\n'));

    } as typeof DebugLog;
}

export function sanitizeJSON(key: string, value: any) {
    // returning undefined omits the key from being serialized
    if (!key) { return value; } //This is the entire value to be serialized
    else if (key.substring(0, 1) === "$") return; //Remove angular tags
    else if (key.substring(0, 1) === "_") return; //Remove NoSQL tags
    else return value;
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
    const staticServer = require('../lib/node-static');
    const serve = new staticServer.Server({
        mount: '/'
        // gzipTransfer: true, 
        // gzip:/^(text\/html|application\/javascript|text\/css|application\/json)$/gi 
    }) as Server;
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


// export function obs<S>(state?: S) {
//     return Observable.bindCallback(fs.stat, (err, stat): NodeCallback<fs.Stats, S> => [err, stat, state] as any);
// }

export const obs_stat = <T>(state?: T) => Observable.bindCallback(
    fs.stat, (err, stat): NodeCallback<fs.Stats, T> => [err, stat, state] as any);

export const obs_readdir = <T>(state?: T) => Observable.bindCallback(
    fs.readdir, (err, files): NodeCallback<string[], T> => [err, files, state] as any);

export const obs_readFile = <T>(state?: T) => Observable.bindCallback(
    fs.readFile, (err, data): NodeCallback<string | Buffer, T> => [err, data, state] as any);

export const obs_writeFile = <T>(state?: T) => Observable.bindCallback(
    fs.writeFile, (err, data): NodeCallback<string | Buffer, T> => [err, data, state] as any);


export class StateError extends Error {
    state: StateObject;
    constructor(state: StateObject, message: string) {
        super(message);
        this.state = state;
    }
}
export type StatPathResult = {
    stat: fs.Stats,
    statpath: string,
    infostat?: fs.Stats,
    index: number,
    /**
     * error, folder, datafolder, file
     * 
     * @type {string}
     */
    itemtype: string,
    /**
     * either the path does not exist or it is a data folder
     * 
     * @type {boolean}
     */
    endStat: boolean
}

export type LoggerFunc = (str: string, ...args: any[]) => void;

export class StateObject {

    static errorRoute(status: number, reason?: string) {
        return (obs: Observable<any>): any => {
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

    statPath: StatPathResult;

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

    constructor(
        public req: http.IncomingMessage,
        public res: http.ServerResponse,
        private debugLog: LoggerFunc,
        private eventer: EventEmitter,
        public readonly isLocalHost: boolean = false
    ) {
        this.startTime = process.hrtime();
        //parse the url and store in state.
        //a server request will definitely have the required fields in the object
        this.url = url.parse(this.req.url as string, true) as any
        //parse the path for future use
        this.path = (this.url.pathname as string).split('/')

        let t = new Date();
        this.timestamp = format('%s-%s-%s %s:%s:%s', t.getFullYear(), padLeft(t.getMonth() + 1, '00'), padLeft(t.getDate(), '00'),
            padLeft(t.getHours(), '00'), padLeft(t.getMinutes(), '00'), padLeft(t.getSeconds(), '00'));
        this.res.on('finish', () => {
            if(this.hasCriticalLogs) this.error();
            if(this.errorThrown) this.eventer.emit('stateError', this);
        })

    }
    debug(str: string, ...args: any[]) {
        this.debugLog('[' +
            this.req.socket.remoteFamily + '-' + colors.FgMagenta +
            this.req.socket.remoteAddress + colors.Reset + '] ' +
            format.apply(null, arguments)
        );
    }

    loglevel: number = DEBUGLEVEL;
    doneMessage: string[];
    hasCriticalLogs: boolean = false;
    /**
     *  4 - Errors that require the process to exit for restart
     *  3 - Major errors that are handled and do not require a server restart
     *  2 - Warnings or errors that do not alter the program flow but need to be marked (minimum for status 500)
     *  1 - Info - Most startup messages
     *  0 - Normal debug messages and all software and request-side error messages
     * -1 - Detailed debug messages from high level apis
     * -2 - Response status messages and error response data
     * -3 - Request and response data for all messages (verbose)
     * -4 - Protocol details and full data dump (such as encryption steps and keys)
     */
    log(level: number, ...args: any[]) {
        if (level < this.loglevel) return this;
        if(level > 1) this.hasCriticalLogs = true;
        this.doneMessage.push(format.apply(null, args));
        return this;
    }
    error() {
        this.errorThrown = new Error(this.doneMessage.join('\n'));
        return this;
    }
    throw<T = StateObject>(statusCode: number, reason?: string, headers?: Hashmap<string>): Observable<T> {
        if (!this.res.headersSent) {
            this.res.writeHead(statusCode, reason && reason.toString(), headers);
            //don't write 204 reason
            if (statusCode !== 204 && reason) this.res.write(reason.toString());
        }
        this.res.end();
        return Observable.empty<never>();
    }
    endJSON(data: any) {
        this.res.write(JSON.stringify(data));
        this.res.end();
    }
    redirect(redirect: string){
        this.res.writeHead(302, {
            'Location': redirect
        });
        this.res.end();
    }
}

export interface ThrowFunc<T> {
    throw(statusCode: number, reason?: string, str?: string, ...args: any[]): Observable<T>;
}

export interface ServerConfig {
    _disableLocalHost: boolean;
    tree: any,
    types: {
        htmlfile: string[];
        [K: string]: string[]
    }
    username?: string,
    password?: string,
    host: string,
    port: number | 8080,
    backupDirectory?: string,
    etag: "required" | "disabled" | "", //otherwise if present
    etagWindow: number,
    useTW5path: boolean
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
export interface PathResolverResult {
    //the tree string returned from the path resolver
    item: string | TreeObject;
    // client request url path
    reqpath: string[];
    // tree part of request url
    treepathPortion: string[];
    // file part of request url
    filepathPortion: string[];
    // item + filepath if item is a string
    fullfilepath: string;
    state: StateObject;
}
export type TreeObject = { [K: string]: string | TreeObject };
export type TreePathResultObject<T, U, V> = { item: T, end: U, folderPathFound: V }
export type TreePathResult =
	TreePathResultObject<TreeObject, number, false>
	| TreePathResultObject<string, number, false>
	| TreePathResultObject<string, number, true>;
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

export function obsTruthy<T>(a: T | undefined | null | false | "" | 0 | void): a is T {
    return !!a;
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

