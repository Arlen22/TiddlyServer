export type AuthCookie = [string, 'pw' | 'key', string, string, string, string]
// Array index type aliases for better readability
type UserName = string
type KeyOrPw = 'key' | 'pw' | ''
type Date = string
type PublicKey = string
type Cookie = string
type Salt = string | undefined
/** This is always 6 long, but the last may be empty */
export type SplitCookieWithUserName = readonly [UserName, KeyOrPw, Date, PublicKey, Cookie, Salt]
export enum RequestMethod {
  GET = 'GET',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  POST = 'POST',
  PUT = 'PUT',
}

export enum StateItemType {
  DataFolder = 'datafolder',
  File = 'file',
  Folder = 'folder',
}

export enum HttpResponse {
  BadRequest = 400,
  Forbidden = 403,
  InternalServerError = 500,
  MethodNotAllowed = 405,
  NotFound = 404,
  Ok = 200,
  TooManyRequests = 429,
  NoContent = 204,
}
