import { PublicKeyCache } from "./publicKeyCache";
import {
  SplitCookieWithUserName,
  SplitCookieWithModifiedUserName
} from "./types";
import { crypto_sign_verify_detached, from_base64 } from "libsodium-wrappers";
import * as http from "http";
import { SettingsReader } from "./settingsReader";

const TIDDLY_SERVER_AUTH_COOKIE: string = "TiddlyServerAuth";
const isoDateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

export const checkCookieAuth = (request: http.IncomingMessage) => {
  if (!request.headers.cookie) return false;
  const cookies: { [k: string]: string } = {};

  const requestCookie = request.headers.cookie as string;
  requestCookie.split(";").forEach((cookie: string) => {
    const parts: string[] = cookie.split("=");
    if (!parts || !Array.isArray(parts) || parts.length < 2) return;
    const userName = parts.shift()?.trim() || "";
    cookies[userName] = decodeURI(parts.join("="));
  });

  let auth = cookies[TIDDLY_SERVER_AUTH_COOKIE];
  if (!auth) return false;
  let cookieData = parseAuthCookie(auth, true);
  // We have to make sure the suffix is truthy
  if (!cookieData || cookieData.length !== 6 || !cookieData[5]) return false;
  return validateCookie(cookieData, false);
};

export const validateCookie = (
  cookieData: SplitCookieWithUserName | SplitCookieWithModifiedUserName,
  logRegisterNotice?: string | false
) => {
  const settings = SettingsReader.getInstance().getServerSettings();
  const authCookieAge = settings?.authCookieAge || 0;
  let publicKeyCache = PublicKeyCache.getCache();
  let [username, type, timestamp, hash, sig, suffix] = cookieData;

  const key: string = hash + username;
  if (type === "pw") return false;
  //passwords are currently not implemented
  else if (type === "key" && !publicKeyCache.keyExists(key)) {
    if (logRegisterNotice) console.log(logRegisterNotice);
    return false;
  }

  let pubkey = publicKeyCache.getVal(key);
  if (pubkey) {
    //don't check suffix unless it is provided, other code checks whether it is provided or not
    //check it after the signiture to prevent brute-force suffix checking
    const valid =
      crypto_sign_verify_detached(
        from_base64(sig),
        username + timestamp + hash,
        from_base64(pubkey[1])
      ) &&
      //cookieData.length should be 5 if there is no suffix, don't ignore falsy suffix
      //the calling code must determine whether the subject is needed
      (cookieData.length === 5 || suffix === pubkey[2]) &&
      isoDateRegex.test(timestamp) &&
      Date.now() - new Date(timestamp).valueOf() < authCookieAge * 1000;
    return valid ? [pubkey[0], username, pubkey[2]] : false;
  }
  return false;
};

/*
  [userName, 'key' | 'pw', date, publicKey, cookie, salt]
*/
export const parseAuthCookie = (
  cookie: string,
  suffix: boolean
): SplitCookieWithUserName | SplitCookieWithModifiedUserName => {
  let splitCookie = cookie.split("|");
  const length = splitCookie.length;
  if (length > (suffix ? 6 : 5)) {
    // Concat the username with the auth-type (key or pw), e.g. "morty|pw""
    const nameAndAuthType: string = splitCookie.slice(0, length - 4).join("|");
    const rest: string[] = splitCookie.slice(length - 4);
    return [nameAndAuthType, ...rest] as SplitCookieWithModifiedUserName;
  }
  return splitCookie as SplitCookieWithUserName;
};

export const getSetCookie = (
  name: string,
  value: string,
  secure: boolean,
  age: number
) => {
  // let flags = ["Secure", "HttpOnly", "Max-Age=2592000", "SameSite=Strict"];
  let flags = {
    Secure: secure,
    HttpOnly: true,
    "Max-Age": age.toString(),
    SameSite: "Strict",
    Path: "/"
  };

  return [
    name + "=" + value,
    ...Object.keys(flags)
      .filter(k => !!flags[k])
      .map(k => k + (typeof flags[k] === "string" ? "=" + flags[k] : ""))
  ].join("; ");
};
