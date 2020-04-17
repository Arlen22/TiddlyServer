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
