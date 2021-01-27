
// export function tryParseJSON(str: string, errObj?: { error?: JsonError }): any;
// export function tryParseJSON(str: string, errObj?: ((e: JsonError) => T | void)): T;

import * as JSON5 from "json5";

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
export function sortBySelector<T extends { [k: string]: string }>(key: (e: T) => any) {
  return function (a: T, b: T) {
    var va = key(a);
    var vb = key(b);

    if (va > vb) return 1;
    else if (va < vb) return -1;
    else return 0;
  };
}
export function sortByKey(key: string) {
  return sortBySelector(e => e[key]);
}

export function safeJSON(key, value) {
  if (key === "__proto__" || key === "constructor") return undefined;
  else return value;
}
