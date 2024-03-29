
// export function tryParseJSON(str: string, errObj?: { error?: JsonError }): any;
// export function tryParseJSON(str: string, errObj?: ((e: JsonError) => T | void)): T;

import * as JSON5 from "json5";
import { DirectoryIndexEntry, DirectoryIndexListing, DirectoryIndexOptions } from "./server-types";

/**
 * Calls the onerror handler if there is a JSON error. Returns whatever the error handler
 * returns. If there is no error handler, undefined is returned.
 * The string "undefined" is not a valid JSON document.
 */
export function tryParseJSON<T = any>(str: string, onerror: (e: JsonError) => never): T;
export function tryParseJSON<T = any>(str: string, onerror: (e: JsonError) => T): T;
export function tryParseJSON<T = any>(str: string, onerror: (e: JsonError) => void): T | undefined;
export function tryParseJSON<T = any>(str: string, onerror?: undefined): T | undefined;
export function tryParseJSON<T = any>(str: string, onerror?: (e: JsonError) => T): T | undefined {
  function findJSONError(message: string, json: string) {
    console.log(message);
    const res: string[] = [];
    const match = /at (\d+):(\d+)/gi.exec(message);
    if (!match) return "";
    const position = [+match[1], +match[2]];
    const lines = json.split("\n");
    res.push(...lines.slice(0, position[0]));
    res.push(new Array(position[1]).join("-") + "^  " + message);
    res.push(...lines.slice(position[0]));
    return res.join("\n");
  }
  str = str.replace(/\t/gi, "    ").replace(/\r\n/gi, "\n");
  try {
    return JSON5.parse(str, safeJSON);
  } catch (e) {
    let err = new JsonError(findJSONError(e.message, str), e);
    if (onerror) return onerror(err);
  }
}
export interface JsonErrorContainer {
  error?: JsonError;
}
export class JsonError {
  public filePath: string = "";
  constructor(
    /** The full JSON string showing the position of the error */
    public errorPosition: string,
    /** The original error return by JSON.parse */
    public originalError: Error
  ) { }
}


export function keys<T>(o: T): (keyof T)[] {
  return Object.keys(o) as (keyof T)[];
}
export function padLeft(str: any, pad: number | string, padStr?: string): string {
  var item = str.toString();
  if (typeof padStr === "undefined") padStr = " ";
  if (typeof pad === "number") {
    pad = new Array(pad + 1).join(padStr);
  }
  //pad: 000000 val: 6543210 => 654321
  return pad.substr(0, Math.max(pad.length - item.length, 0)) + item;
}
export function sortBySelector<T, R extends any[]>(key: (e: T, ...opts: R) => any, ...opts: R) {
  return function (a: T, b: T) {
    var va = key(a, ...opts);
    var vb = key(b, ...opts);

    if (va > vb) return 1;
    else if (va < vb) return -1;
    else return 0;
  };
}
export function sortBySelectorArray<T, R extends any[]>(key: (e: T, ...opts: R) => any, ...opts: R) {
  return function (a: T, b: T) {
    var va = key(a, ...opts);
    var vb = key(b, ...opts);

    if (va > vb) return 1;
    else if (va < vb) return -1;
    else return 0;
  };
}
export function sortByKey<T extends {}>(key: any) {
  return sortBySelector<T, []>(e => e[key]);
}

export function safeJSON(key, value) {
  if (key === "__proto__" || key === "constructor") return undefined;
  else return value;
}

export function first<T>(item: T | T[]): T | undefined {
  return Array.isArray(item) ? (item.length ? item[0] : undefined) : item;
}
export function firstArray<T>(item: T | T[]): T[] {
  return Array.isArray(item) ? item : item === undefined ? [] : [item];
}
export function contains<T extends string>(arr: T[], test: string): test is T {
  return arr.indexOf(test as any) !== -1;
}
