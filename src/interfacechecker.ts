
import { ServerConfig, ServerConfig_AccessOptions, ServerConfig_AuthAccountsValue, Config } from "./server-config";

export function checkInterface() {

}
class CheckInterface {

  errorLog: string[][] = [];

  constructor() {
    // this.assignExpected("", this.checkString);
    this.assignExpected("expected string value", this.checkString);
    this.assignExpected("expected number value", this.checkNumber);
    this.assignExpected("expected boolean value", this.checkBoolean);
    this.assignExpected("expected boolean true", this.checkBooleanTrue);
    this.assignExpected("expected boolean false", this.checkBooleanFalse);
    this.assignExpected("expected null value", this.checkNull);
  }

  assignExpected<T>(message: string, func: T): T {
    (func as T & { expected: string }).expected = message;
    return func;
  }
  currentKeyArray: (string | number | symbol)[] = [];
  responseStringError = (err: string) => JSON.stringify(this.currentKeyArray) + " " + err + "\n";

  union<A, B>(af: (a) => a is A, bf: (b) => b is B): (a) => a is A | B;
  union<A, B, C>(af: (a) => a is A, bf: (b) => b is B, cf: (c) => c is C): (a) => a is A | B | C;
  union(af, bf, cf?) {
    return this.assignExpected([af, bf, cf].map(e => e && e.expected).join(', '), (item) => {
      // this.currentKeyArray.push(i);
      let errs: (string | false)[] = [];
      let res: boolean | string;
      if ((res = af(item, true)) === true) return true;
      errs.push(res);
      if ((res = bf(item, true)) === true) return true;
      errs.push(res);
      if (!!cf && (res = cf(item, true)) === true) return true;
      if (!!cf) errs.push(res);
      if (errs.length && errs.some(e => typeof e === "string")) {
        console.log(JSON.stringify(this.currentKeyArray) + " OR \n" + errs.map((e, i) =>
          this.checkObjectError((typeof e === "string") ? e : (e + "\n"))
        ).join("\n"));
      }
      return typeof res === "string" ? false : res;
    });
  }
  checkObjectError(str: string) {
    return str.split("\n").filter(e => !!e.trim()).map((l, j) => (j > 0 ? "   " : " - ") + l).join('\n')
  }
  // checkNever = (a): a is never => typeof a === "undefined";
  checkNull = (a): a is null => a === null;
  checkString = (a): a is string => typeof a === "string";
  checkStringEnum = <T extends string>(...values: T[]) => this.assignExpected(
    "expected one string of " + JSON.stringify(values),
    (a): a is T => typeof a === "string" && values.indexOf(a as T) !== -1)
  checkBoolean = (a): a is boolean => typeof a === "boolean";
  checkBooleanTrue = (a): a is true => typeof a === "boolean" && a === true;
  checkBooleanFalse = (a): a is false => typeof a === "boolean" && a === false;
  checkNumber = (a): a is number => typeof a === "number";
  checkNumberEnum = <T extends number>(...values: T[]) => this.assignExpected(
    "expected one number of " + JSON.stringify(values),
    (a): a is T => typeof a === "number" && values.indexOf(a as T) !== -1)

  // checkArrayValue: ()
  checkArray<T>(checker: ((b, stringError: boolean) => b is T)) {
    let sourceLine = new Error("checkArray origin");
    return this.assignExpected(
      "expected an array that " + (checker as any).expected,
      (a): a is T[] => typeof a === "object" && Array.isArray(a) && (a.filter((b, i) => {
        let res = this.checkArrayValue<number, T>(i, checker, b);
        return res;
      }).length === a.length)
    );
  }

  checkRecord<K extends string | number | symbol, T>(
    keychecker: ((b) => b is K),
    checker: ((b, stringError: boolean) => b is T)
  ) {
    let sourceLine = new Error("checkRecord origin");
    return this.assignExpected("expected a record that " + (checker as any).expected, (a): a is Record<K, T> => {
      const keys = Object.keys(a);
      return typeof a === "object" && (keys.filter(k => {
        let res = keychecker(k) && this.checkArrayValue<K, T>(k, checker, a[k]);
        return res;
      }).length === keys.length);
    });
  }
  private checkArrayValue<K extends string | number | symbol, T>(k: K, checker: (b: any, stringError: boolean) => b is T, b: any) {
    this.currentKeyArray.push(k);
    let res = checker(b, true);
    if (typeof res === "string")
      console.log(JSON.stringify(this.currentKeyArray) + " " + this.checkObjectError(res));
    else if (!res)
      console.log(JSON.stringify(this.currentKeyArray) + " " + typeof b);
    this.currentKeyArray.pop();
    return res;
  }

  checkObject<T extends {}>(
    checkermap: { [KEY in keyof T]-?: ((b) => b is T[KEY]) },
    optionalcheckermap?: undefined,
    /** if these keys do not pass, the item is assumed to be unrelated */
    unionKeys?: (keyof T)[]
  ): (a) => a is T;
  checkObject<T extends {}, REQUIRED extends keyof T>(
    checkermap: { [KEY in REQUIRED]-?: ((b) => b is T[KEY]) },
    optionalcheckermap: { [KEY in Exclude<keyof T, REQUIRED>]-?: ((b) => b is T[KEY]) },
    /** if these keys do not pass, the item is assumed to be unrelated */
    unionKeys?: (keyof T)[]
  ): (a) => a is T;
  checkObject<T extends {}, REQUIRED extends keyof T>(
    checkermap: { [KEY in REQUIRED]-?: ((b) => b is T[KEY]) },
    optionalcheckermap: { [KEY in keyof T]?: ((b) => b is T[KEY]) } = {},
    /** if these keys do not pass, the item is assumed to be unrelated */
    unionKeys?: (string)[]
  ) {
    // type t = Exclude
    const required = Object.keys(checkermap);
    const optional = Object.keys(optionalcheckermap);
    // let sourceLine = new Error("checkObject origin");
    let expectedMessage = "expected an object with keys " + [
      ...Object.keys(checkermap).map(e => JSON.stringify(e)),
      ...Object.keys(optionalcheckermap).map(e => JSON.stringify(e) + "?")
    ].join(',');

    if (unionKeys) unionKeys.forEach(k => {
      if (required.indexOf(k) === -1)
        throw new Error("unionKey not found in checkermap " + k);
    });

    return this.assignExpected(
      expectedMessage,
      (a, stringError: boolean = false): a is T => {
        if (typeof a !== "object") return false;
        const keys = Object.keys(a);
        // const required = Object.keys(checkermap);
        const checkOrder: string[] = [...required];
        // const optional = Object.keys(optionalcheckermap);
        optional.forEach(k => { if (checkOrder.indexOf(k) === -1) checkOrder.push(k); });
        let badkey = false;
        //check if any union keys don't validate
        let wrongunionkey = unionKeys && !(unionKeys.filter(k =>
          //union keys are already in the checkermap
          //so we only need to make sure the object has the key before checking it
          keys.indexOf(k) !== -1 && checkermap[k](a[k])
        ).length === unionKeys.length);

        if (wrongunionkey) {
          //don't log anything because something else is probably taking care of it
          return null as unknown as false;
        }

        let responseString = "";
        //make sure every key is either in required or optional
        //and every key in required is actually present
        const log: string[] = [];
        this.errorLog.push(log);
        let res = (required.filter(k => {
          let res = keys.indexOf(k) !== -1;
          if (!res) badkey = true;
          return res;
        }).length === required.length) && (keys.filter((k): boolean => {
          this.currentKeyArray.push(k);
          const keylog: string[] = [];
          this.errorLog.push(keylog);
          let res: boolean;
          if (checkermap[k]) {
            res = checkermap[k](a[k]);
            if (!res && checkermap[k].expected)
              keylog.push(this.responseStringError(checkermap[k].expected));
            if (!res && unionKeys && unionKeys.indexOf(k) !== -1) {
              wrongunionkey = true;
            }
          } else if (optionalcheckermap[k]) {
            res = optionalcheckermap[k](a[k]);
            if (!res && optionalcheckermap[k].expected)
              keylog.push(this.responseStringError(optionalcheckermap[k].expected));
          } else {
            res = false;
            keylog.push(this.responseStringError("property is unexpected"));
            badkey = true;
          }
          log.push(...keylog);
          this.currentKeyArray.pop();
          return res;
        }).length === keys.length);
        if (badkey) log.unshift(this.responseStringError(expectedMessage + " but got " + JSON.stringify(Object.keys(a))));
        if (!stringError && responseString) console.log(log.join('\n'));
        return (!res && stringError && !wrongunionkey) ? log.join('\n') as never : res;
      });
  }

}
let checker = new CheckInterface();
let { checkBoolean, checkString, checkStringEnum, checkNumber, checkNumberEnum, checkBooleanFalse, checkNull } = checker;
const checkAccessPerms = checker.checkObject<ServerConfig_AccessOptions>({
  mkdir: checkBoolean,
  upload: checkBoolean,
  websockets: checkBoolean,
  writeErrors: checkBoolean,
  registerNotice: checkBoolean
});
const checkOptions = checker.union(
  checker.checkObject<Config.Options_Auth>({
    $element: checkStringEnum("auth"),
    authError: checkNumberEnum(403, 404),
    authList: checker.union(checker.checkArray(checkString), checkNull)
  }, undefined, ["$element"]),
  checker.checkObject<Config.Options_Backups>({
    $element: checkStringEnum("backups"),
    backupFolder: checkString,
    etagAge: checkNumber,
    gzip: checkBoolean
  }, undefined, ["$element"]),
  checker.checkObject<Config.Options_Index>({
    $element: checkStringEnum("index"),
    defaultType: checker.union(checkStringEnum("html", "json"), checkNumberEnum(404, 403)),
    indexExts: checker.checkArray(checkString),
    indexFile: checker.checkArray(checkString)
  }, undefined, ["$element"])
);
const GroupChild = checker.union(
  checker.checkObject<Config.PathElement>({
    $element: checkStringEnum("folder"),
    $options: checker.checkArray(checkOptions),
    key: checkString,
    noTrailingSlash: checkBoolean,
    path: checkString
  }, undefined, ["$element"]),
  checker.checkObject<Config.GroupElement>({
    $element: checkStringEnum("group"),
    $children: checker.checkArray(checker.assignExpected("expected GroupChild", (b): b is Config.GroupElement["$children"][0] => GroupChild(b))),
    $options: checker.checkArray(checkOptions),
    key: checkString,
    indexPath: checker.union(checkString, checkBooleanFalse),
  }, undefined, ["$element"])
);
export const checkServerConfig = checker.checkObject<ServerConfig>({
  $schema: checkString,
  __assetsDir: checkString,
  __dirname: checkString,
  __filename: checkString,
  _datafoldertarget: checkString,
  _devmode: checkBoolean,
  authCookieAge: checkNumber,
  tree: checker.checkArray(checker.checkObject<Config.HostElement>({
    $element: checkStringEnum<"host">("host"),
    $mount: GroupChild
  })),
  authAccounts: checker.checkRecord(checkString, checker.checkObject<ServerConfig_AuthAccountsValue>({
    clientKeys: checker.checkRecord(checkString, checker.checkObject<ServerConfig["authAccounts"][""]["clientKeys"][""]>({
      publicKey: checkString,
      userSalt: checkString
    })),
    permissions: checkAccessPerms
  })),
  bindInfo: checker.checkObject<ServerConfig["bindInfo"]>({
    _bindLocalhost: checkBoolean,
    bindAddress: checker.checkArray(checkString),
    bindWildcard: checkBoolean,
    enableIPv6: checkBoolean,
    filterBindAddress: checkBoolean,
    https: checkBoolean,
    localAddressPermissions: checker.checkRecord(checkString, checkAccessPerms),
    port: checkNumber
  }),
  directoryIndex: checker.checkObject<ServerConfig["directoryIndex"]>({
    defaultType: checkStringEnum("html", "json"),
    icons: checker.checkRecord(checkString, checker.checkArray(checkString)),
    mimetypes: checker.checkRecord(checkString, checker.checkArray(checkString)),
    mixFolders: checkBoolean,
    types: checker.checkRecord(checkString, checkString)
  }),
  logging: checker.checkObject<ServerConfig["logging"]>({
    debugLevel: checkNumber,
    logAccess: checker.union(checkString, checkBooleanFalse),
    logColorsToFile: checkBoolean,
    logError: checkString,
    logToConsoleAlso: checkBoolean
  }),
  putsaver: checker.checkObject<ServerConfig["putsaver"]>({
    backupDirectory: checkString,
    etag: checkStringEnum("", "required", "disabled"),
    etagWindow: checkNumber
  }),
  EXPERIMENTAL_clientside_datafolders: checker.checkObject<ServerConfig["EXPERIMENTAL_clientside_datafolders"]>({
    alwaysRefreshCache: checkBoolean,
    enabled: checkBoolean,
    maxAge_tw_plugins: checkNumber
  })
});
