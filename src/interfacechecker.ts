
import { ServerConfig, ServerConfig_AccessOptions, ServerConfig_AuthAccountsValue, Config, ServerConfig_TiddlyServer } from "./server-config";

function as<T>(obj: T) {
  return obj;
}

export function checkInterface() {

}
class UnionError {
  constructor(
    public expected: string,
    public union_result: any[]
  ) {

  }
}
// type CheckInterfaceFunction = { expected: string } & (<T>(a: any, stringError: boolean) => any);
type ICheckInterfaceFunction<A> = { expected: string } & ((a: any) => a is A)
interface ICheckInterface {
  currentKeyArray: (string | number | symbol)[];
  union<A, B>(
    af: ICheckInterfaceFunction<A>,
    bf: ICheckInterfaceFunction<B>
  ): ICheckInterfaceFunction<A | B>;
  union<A, B, C>(
    af: ICheckInterfaceFunction<A>,
    bf: ICheckInterfaceFunction<B>,
    cf: ICheckInterfaceFunction<C>
  ): ICheckInterfaceFunction<A | B | C>;
  checkNull: ICheckInterfaceFunction<null>;
  checkString: ICheckInterfaceFunction<string>;
  checkStringEnum: <T extends string>(...values: T[]) => ICheckInterfaceFunction<T>;
  checkStringNotEmpty: ICheckInterfaceFunction<string>
  checkBoolean: ICheckInterfaceFunction<boolean>;
  checkBooleanTrue: ICheckInterfaceFunction<true>;
  checkBooleanFalse: ICheckInterfaceFunction<false>;
  checkNumber: ICheckInterfaceFunction<number>;
  checkNumberEnum: <T extends number>(...values: T[]) => ICheckInterfaceFunction<T>;
  checkArray: <T>(checker: ICheckInterfaceFunction<T>) => ICheckInterfaceFunction<T[]>;
  checkRecord<K extends string | number | symbol, T>(
    keychecker: ICheckInterfaceFunction<K>,
    checker: ICheckInterfaceFunction<T>
  )
  checkObject<T extends {}, REQUIRED extends keyof T = keyof T>(
    checkermap: { [KEY in REQUIRED]-?: ((b) => b is T[KEY]) },
    optionalcheckermap?: { [KEY in Exclude<keyof T, keyof typeof checkermap>]?: ((b) => b is T[KEY]) },
    /** if these keys do not pass, the item is assumed to be unrelated */
    unionKeys?: (string)[]
  )
}
type RequiredCheckermap<T, REQUIRED extends keyof T> = { [KEY in REQUIRED]-?: ICheckInterfaceFunction<T[KEY]> };
type OptionalCheckermap<T, REQUIRED> = { [KEY in Exclude<keyof T, REQUIRED>]?: ICheckInterfaceFunction<T[KEY]> };
class CheckInterface implements ICheckInterface {

  errorLog: string[][] = [];

  constructor() {

  }

  assignProperties<T>(message: string, func: (a: any) => a is T): ICheckInterfaceFunction<T> {
    (func as typeof func & { expected: string }).expected = message;
    return func as any;
  }
  currentKeyArray: (string | number | symbol)[] = [];
  get currentKey() { return this.currentKeyArray[this.currentKeyArray.length - 1]; }
  responseStringError = (err: string) => JSON.stringify(this.currentKeyArray) + " " + err + "\n";

  union<A, B>(
    af: ICheckInterfaceFunction<A>,
    bf: ICheckInterfaceFunction<B>
  ): ICheckInterfaceFunction<A | B>;
  union<A, B, C>(
    af: ICheckInterfaceFunction<A>,
    bf: ICheckInterfaceFunction<B>,
    cf: ICheckInterfaceFunction<C>
  ): ICheckInterfaceFunction<A | B | C>;
  union(af, bf, cf?) {
    const expectedMessage = [af, bf, cf].map(e => e && e.expected).join(', ');
    return this.assignProperties(expectedMessage, ((item) => {

      let errs: (string | false)[] = [];
      let res: boolean | string;
      if ((res = af(item, true)) === true) return true;
      errs.push(res);
      if ((res = bf(item, true)) === true) return true;
      errs.push(res);
      if (!!cf && (res = cf(item, true)) === true) return true;
      if (!!cf) errs.push(res);

      return new UnionError(expectedMessage, errs) as never;
    }) as ReturnType<ICheckInterface["union"]>);
  }
  checkObjectError(str: string) {
    return str.split("\n").filter(e => !!e.trim()).map((l, j) => (j > 0 ? "   " : " - ") + l).join('\n')
  }

  checkNull = this.assignProperties("expected null value", (a): a is null => a === null);

  checkString = this.assignProperties("expected string value", (a): a is string => typeof a === "string");
  checkStringEnum = <T extends string>(...values: T[]) => this.assignProperties(
    "expected one string of " + JSON.stringify(values),
    (a): a is T => typeof a === "string" && values.indexOf(a as T) !== -1)
  checkStringNotEmpty = this.assignProperties("expected string with length more than 0", (a): a is string => typeof a === "string" && a.length > 0);
  checkBoolean = this.assignProperties("", (a): a is boolean => typeof a === "boolean");
  checkBooleanTrue = this.assignProperties("", (a): a is true => typeof a === "boolean" && a === true);
  checkBooleanFalse = this.assignProperties("", (a): a is false => typeof a === "boolean" && a === false);

  checkNumber = this.assignProperties("", (a): a is number => typeof a === "number");
  checkNumberEnum = <T extends number>(...values: T[]) => this.assignProperties(
    "expected one number of " + JSON.stringify(values),
    (a): a is T => typeof a === "number" && values.indexOf(a as T) !== -1)

  /**
   * @returns {object} object: A hashmap of the errors for any values that don't validate.
   * @returns {false} false: The item typeof is not "object" or Array.isArray returns false.
   * @returns {true} true: All values are valid
   */
  checkArray<T>(checker: ICheckInterfaceFunction<T>) {
    return this.assignProperties(
      "expected an array that " + checker.expected,
      (a): a is T[] => {
        if (typeof a !== "object" || !Array.isArray(a)) return false;
        const errs: Record<number, string> = {};
        return (a.filter((b, i) => this.checkArrayValue<number, T>(i, checker, b, errs)).length === a.length) || errs as never;
      }
    );
  }

  /**
   * @returns {object} object: A hashmap of the errors for any properties that don't validate.
   * @returns {false} false: The item typeof is not "object"
   * @returns {true} true: All properties are valid
   */
  checkRecord<K extends string | number | symbol, T>(
    keychecker: ICheckInterfaceFunction<K>,
    checker: ICheckInterfaceFunction<T>
  ) {
    return this.assignProperties("expected a record that " + checker.expected, (a): a is Record<K, T> => {
      const keys = Object.keys(a);
      const errs: Record<K, string> = {} as any;
      return typeof a === "object" && (keys.filter(k =>
        this.checkArrayValueResult<any, any>(keychecker(k), errs, k,
          keychecker.expected ? "key " + keychecker.expected : "")
        && this.checkArrayValue<K, T>(k as any, checker, a[k], errs)
      ).length === keys.length) || errs as never;
    });
  }
  private checkArrayValue<K extends string | number | symbol, T>(k: K, checker: ICheckInterfaceFunction<T>, b: any, errs: Record<K, string>) {
    this.currentKeyArray.push(k);
    let res = checker(b);
    res = this.checkArrayValueResult<K, T>(res, errs, k, checker.expected);
    this.currentKeyArray.pop();
    return res;
  }

  private checkArrayValueResult<K extends string | number | symbol, T>(res: boolean, errs: Record<K, string>, k: K, expected: string) {
    if (typeof res === "object" && res !== null || typeof res === "string") {
      // we have an error hashmap or string
      if (typeof res === "object")
        errs[k] = res;
      else
        errs[k] = res;
      res = false;
    }
    else if (!res && expected) {
      errs[k] = expected;
    }
    return res;
  }

  /** 
   * @returns {null} null: The specified union keys are not valid.
   * @returns {object} object: A hashmap of the errors for any properties that don't validate.
   * @returns {string} string: Required keys are missing
   * @returns {false} false: The item typeof is not "object"
   * @returns {true} true: All properties are valid
   */
  checkObject<T extends {}, REQUIRED extends keyof T = keyof T>(
    checkermap: RequiredCheckermap<T, REQUIRED>,
    optionalcheckermap: OptionalCheckermap<T, keyof typeof checkermap> = {},
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

    return this.assignProperties(
      expectedMessage,
      (a, stringError: boolean = false): a is T => {
        if (typeof a !== "object") return false;
        const keys = Object.keys(a);
        const checkOrder: string[] = [...required];
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
        //check for missing required keys and return a string error if any are missing
        let missingkeys = required.filter(k => keys.indexOf(k) === -1);
        if (missingkeys.length)
          return this.responseStringError("missing required keys " + missingkeys.join(',')) as never;
        const log: string[] = [];
        this.errorLog.push(log);
        let errs: Partial<T> = {};
        let res = (keys.filter((k): boolean => {
          this.currentKeyArray.push(k);
          const keylog: string[] = [];
          // this.errorLog.push(keylog);
          let res: boolean;
          if (checkermap[k]) {
            res = checkermap[k](a[k]);
            if (typeof res === "object" && res !== null || typeof res === "string") {
              // we have an error hashmap or string
              errs[k] = res;
              res = false;
            } else if (!res && checkermap[k].expected) {
              keylog.push(this.responseStringError(checkermap[k].expected));
              errs[k] = checkermap[k].expected;
            }
          } else if (optionalcheckermap[k]) {
            res = optionalcheckermap[k](a[k]);
            if (typeof res === "object" && res !== null || typeof res === "string") {
              // we have an error hashmap or string
              errs[k] = res;
              res = false;
            } else if (!res && optionalcheckermap[k].expected) {
              keylog.push(this.responseStringError(optionalcheckermap[k].expected));
              errs[k] = optionalcheckermap[k].expected;
            }
          } else {
            res = false;
            keylog.push(this.responseStringError("property is unexpected"));
            errs[k] = "property is unexpected";
            badkey = true;
          }
          log.push(...keylog);
          this.currentKeyArray.pop();
          return res;
        }).length === keys.length);
        if (badkey) log.unshift(this.responseStringError(expectedMessage + " but got " + JSON.stringify(Object.keys(a))));
        // console.log(log.join('\n'));
        return (!res) ? errs as never : res;
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
const putsaverOptional = as<OptionalCheckermap<ServerConfig_TiddlyServer, never>>({
  backupFolder: checkString,
  etag: checkStringEnum("optional", "required", "disabled"),
  etagAge: checkNumber,
  gzipBackups: checkBoolean
});
const checkOptions = checker.union(
  checker.checkObject<Config.Options_Auth, "$element">(
    {
      $element: checkStringEnum("auth"),
    }, {
      authError: checkNumberEnum(403, 404),
      authList: checker.union(checker.checkArray(checkString), checkNull)
    }, ["$element"]),
  checker.checkObject<Config.Options_Backups, "$element">({
    $element: checkStringEnum("putsaver"),
  }, putsaverOptional, ["$element"]),
  checker.checkObject<Config.Options_Index, "$element">(
    {
      $element: checkStringEnum("index"),
    }, {
      defaultType: checker.union(checkStringEnum("html", "json"), checkNumberEnum(404, 403)),
      indexExts: checker.checkArray(checkString),
      indexFile: checker.checkArray(checkString)
    }, ["$element"])
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
    $children: checker.checkArray(checker.assignProperties("expected GroupChild", (b): b is Config.GroupElement["$children"][0] => GroupChild(b))),
    $options: checker.checkArray(checkOptions),
    key: checkString,
    indexPath: checker.union(checkString, checkBooleanFalse),
  }, undefined, ["$element"])
);

const _checkServerConfig = checker.checkObject<ServerConfig>({
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
  authAccounts: checker.checkRecord(checkString, checker.checkObject<ServerConfig["authAccounts"][""]>({
    clientKeys: checker.checkRecord(checkString, checker.checkObject<ServerConfig["authAccounts"][""]["clientKeys"][""]>({
      publicKey: checkString,
      cookieSalt: checker.checkStringNotEmpty
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
  putsaver: checker.union(checker.checkObject<ServerConfig["putsaver"]>({}, putsaverOptional), checker.checkBooleanFalse),
  EXPERIMENTAL_clientside_datafolders: checker.checkObject<ServerConfig["EXPERIMENTAL_clientside_datafolders"]>({
    alwaysRefreshCache: checkBoolean,
    enabled: checkBoolean,
    maxAge_tw_plugins: checkNumber
  })
});
export function checkServerConfig(obj) {
  let res = _checkServerConfig(obj);
  if (res !== true) debugger; //if you hit this breakpoint, it means the settings does 
  //not conform to ServerConfig and the server is about to exit. The error data is in `res`. 
  console.log("Check server config result: " + JSON.stringify(res, null, 2));
  return res;
};