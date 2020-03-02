export type AuthCookie = [string, "pw" | "key", string, string, string, string];
export type AuthCookieSet = [string, "pw" | "key", string, string, string];
export type ThreeStringArray = [string, string, string];

// Array index type aliases for better readability
type UserName = string;
type UserNameWithPw = string;
type KeyOrPw = "key" | "pw";
type Date = string;
type PublicKey = string;
type Cookie = string;
type Salt = string;
export type SplitCookieWithUserName = [
  UserName,
  KeyOrPw,
  Date,
  PublicKey,
  Cookie,
  Salt
];
export type SplitCookieWithModifiedUserName = [
  UserNameWithPw,
  Date,
  PublicKey,
  Cookie,
  Salt
];

export interface TiddlyServerResponses {
  "POST /admin/authenticate/initPin": { initPin: string };
  "POST /admin/authenticate/initShared/{shared}": { initPin: string };
  "POST /admin/authenticate/login": undefined;
  "POST /admin/authenticate/logout": undefined;
  "POST /admin/authenticate/transfer": any;
}
