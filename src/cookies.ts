import { PublicKeyCache } from "./publicKeyCache";
import { SplitCookieWithUserName } from "./types";
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
  cookieData: SplitCookieWithUserName,
  logRegisterNotice?: string | false
) => {
  const settings = SettingsReader.getInstance().getServerSettings();
  const authCookieAge = settings?.authCookieAge || 0;
  let publicKeyCache = PublicKeyCache.getCache();
  let [username, type, timestamp, hash, sig, suffix] = cookieData;

  const key: string = hash + username;
  if (type !== "key") {
    // currently only key is implemented
    return false;
  } else if (!publicKeyCache.keyExists(key)) {
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
        username + type + timestamp + hash,
        from_base64(pubkey[1])
      ) &&
      //suffix should undefined or valid, not an empty string
      //the calling code must determine whether the subject is needed
      (suffix === undefined || suffix === pubkey[2]) &&
      isoDateRegex.test(timestamp) &&
      Date.now() - new Date(timestamp).valueOf() < authCookieAge * 1000;
    return valid ? [pubkey[0], username, pubkey[2]] : false;
  }
  return false;
};

/*
  [userName, 'key' | 'pw', date, publicKey, cookie, salt]
*/
export const parseAuthCookie = (cookie: string, suffix: boolean) => {
  let splitCookie = cookie.split("|");
  const length = splitCookie.length;
  const expectLength = suffix ? 6 : 5;
  if (length > expectLength) {
    // This is a workaround in case the username happens to contain a pipe
    // other code still checks the signature of the cookie, so it's all good
    const nameLength = splitCookie.length - expectLength - 1;
    const name: string = splitCookie.slice(0, nameLength).join("|");
    const rest = splitCookie.slice(nameLength);
    return ([name, ...rest] as unknown) as SplitCookieWithUserName;
  } else if (length === expectLength) {
    return (splitCookie as unknown) as SplitCookieWithUserName;
  } else {
    return false;
  }
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
    Path: "/",
  };

  return [
    name + "=" + value,
    ...Object.keys(flags)
      .filter(k => !!flags[k])
      .map(k => k + (typeof flags[k] === "string" ? "=" + flags[k] : "")),
  ].join("; ");
};
