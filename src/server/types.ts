import { factoryFileSystemLoader } from './data-folder-loader';

export type AuthCookie = [string, "pw" | "key", string, string, string, string];
export type AuthCookieSet = [string, "pw" | "key", string, string, string];
export type ThreeStringArray = [string, string, string];

// Array index type aliases for better readability
type UserName = string;
type UserNameWithPw = string;
type KeyOrPw = "key" | "pw" | "";
type Date = string;
type PublicKey = string;
type Cookie = string;
type Salt = string | undefined;
/** This is always 6 long, but the last may be empty */
export type SplitCookieWithUserName = readonly [UserName, KeyOrPw, Date, PublicKey, Cookie, Salt];

export interface TiddlyServerResponses {
  "POST /admin/authenticate/initPin": { initPin: string };
  "POST /admin/authenticate/initShared/{shared}": { initPin: string };
  "POST /admin/authenticate/login": undefined;
  "POST /admin/authenticate/logout": undefined;
  "POST /admin/authenticate/transfer": any;
}

export type Wiki = {
  wikiPath: string
  wikiTiddlersPath: string
  files: any
} | { [x: string]: Function };

export declare class FileSystemLoaderOuter {
  wiki: Wiki;
  boot: any;
  extraPlugins: any[];
  constructor(wiki: Wiki, boot: any, extraPlugins: any[]);
  loadTiddlersNode();
}
export interface TiddlyWikiGlobal {
  utils: any
  node: boolean
  browser: boolean
  config: any
  boot: { corePath: string, bootPath: string, excludeRegExp: RegExp }
  packageInfo: typeof import("tiddlywiki-production-server/package.json")
  loadTiddlersNode: () => void
  FileSystemLoader: ReturnType<typeof factoryFileSystemLoader>
  wiki: any;
  Wiki: any;
}