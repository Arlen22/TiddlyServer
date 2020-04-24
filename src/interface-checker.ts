import {
  ServerConfig,
  ServerConfig_AccessOptions,
  ServerConfig_PutSaver,
  Config,
  ServerConfig_Controller,
} from "./server-config";
import { as } from "./server-types";

abstract class TypeCheck<T> {
  static currentKeyArray: (string | number)[] = [];
  static stack: TypeCheck<any>[] = [];
  public abstract expectedMessage: string;
  public abstract error: Record<string | number, any> | string | undefined;
  public abstract currentKey: string | number | symbol | undefined;
  protected abstract _check(a: any): a is T;

  private errMessage = (err: any) => JSON.stringify(TypeCheck.currentKeyArray) + " " + err + "\n";

  public check(a: any): a is T {
    let parent: TypeCheck<any> | undefined = TypeCheck.stack[TypeCheck.stack.length - 1];
    TypeCheck.stack.push(this);
    this.currentKey = undefined;

    let res: boolean = false;

    if (!parent) {
      res = this._check(a);
    } else if (
      parent instanceof CheckMultiple ||
      parent instanceof CheckObject ||
      parent instanceof CheckUnion
    ) {
      let key = parent.currentKey;

      res = this._check(a);

      if (!res && typeof parent.error === "object") {
        parent.error[key] = this.error;
      } else if (!res) {
        throw new Error(
          "parent.error is a string. This is a bug in one of the instanceof specified classes."
        );
      }
    } else if (parent instanceof CheckSimple) {
      throw new Error("CheckSimple instances may not call other checkers. ");
    } else if (parent instanceof CheckRepeat) {
      res = this._check(a);
      if (!res) parent.error = this.error;
    } else {
      throw new Error("unhandled instance " + this.toString());
    }
    TypeCheck.stack.pop();
    this.currentKey = undefined;
    return res;
  }
  static errorMessage(key: symbol): (co: any, x: any) => string {
    switch (key) {
      case CheckObject.wrongUnionKey:
        return (co: CheckObject<any>, x) =>
          "wrong union key " +
          co.unionKeys
            ?.map(k => k + ": " + x[k] + " " + co.checkermap[k].expectedMessage)
            .join(", ");
      case CheckObject.typeofNotObject:
        return (co: CheckObject<any>, x) => "expected object value but got " + typeof x;
      case CheckObject.missingRequired:
        return (co: CheckObject<any>, x) => co.lastMessage;
      case CheckObject.unexpectedProperty:
        return (co: CheckObject<any>, x) =>
          co.expectedMessage + " but got " + JSON.stringify(Object.keys(x));
      default:
        return (tc, x) => tc.expectedMessage;
    }
  }
}

class CheckSimple<T> extends TypeCheck<T> {
  public error: string = "";
  public currentKey: undefined = undefined;
  protected _check: (a: any) => a is T;
  constructor(public expectedMessage: string, check: (a: any) => a is T) {
    super();
    this._check = check;
    this.error = this.expectedMessage;
  }
}

export const checkString = new CheckSimple(
  "expected a string value",
  (a): a is string => typeof a === "string"
);
export const checkStringEnum = <T extends string>(...val: T[]) =>
  new CheckSimple(
    "expected one string of " + JSON.stringify(val),
    (a): a is T => typeof a === "string" && (val as string[]).indexOf(a) !== -1
  );
export const checkStringNotEmpty = new CheckSimple(
  "expected a string with non-zero length",
  (a): a is string => typeof a === "string" && a.length > 0
);
export const checkNumber = new CheckSimple(
  "expected a number value",
  (a): a is number => typeof a === "number"
);
export const checkNumberEnum = <T extends number>(...val: T[]) =>
  new CheckSimple(
    "expected one number of " + JSON.stringify(val),
    (a): a is T => typeof a === "number" && (val as number[]).indexOf(a) !== -1
  );
export const checkBoolean = new CheckSimple(
  "expected a boolean value",
  (a): a is boolean => typeof a === "boolean"
);
export const checkBooleanTrue = new CheckSimple(
  "expected a boolean true",
  (a): a is true => typeof a === "boolean" && a === true
);
export const checkBooleanFalse = new CheckSimple(
  "expected a boolean false",
  (a): a is false => typeof a === "boolean" && a === false
);
export const checkNull = new CheckSimple(
  "expected a null value",
  (a): a is null => typeof a === "object" && a === null
);
export const checkAny = new CheckSimple("expected any value", (a): a is any => true);

export class CheckMultiple<T extends {}> extends TypeCheck<T> {
  error: Record<string | number, any> | string = {} as any;
  currentKey: any;
  protected _check = (a: any): a is T => {
    this.currentKey = undefined;
    this.error = {};
    let res = this.checkObject(a);

    if (!res) return (this.error = this.expectedMessage), res;
    else
      return this.checkChildren(a, k => {
        this.currentKey = k;
      });
  };
  constructor(
    public expectedMessage: string,
    private checkObject: (a: any) => a is T,
    private checkChildren: (a: any, curKey: (k: any) => void) => a is T
  ) {
    super();
  }
}

type ArrayType<T> = T extends Array<infer X> ? X : never;
export const checkArray = <V>(checker: TypeCheck<V>) =>
  new CheckMultiple(
    "expected an array that " + checker.expectedMessage,
    (a): a is V[] => typeof a === "object" && Array.isArray(a),
    (a, curKey): a is V[] =>
      a.filter((b, i) => {
        curKey(i);
        return checker.check(b);
      }).length === a.length
  );

export const checkRecord = <K extends string | number, V>(
  keyChecker: TypeCheck<K>,
  checker: TypeCheck<V>
) =>
  new CheckMultiple<{ [k in K]: V }>(
    "expected a record that " + checker.expectedMessage,
    (a): a is { [k in K]: V } => typeof a === "object",
    (a, curKey): a is { [k in K]: V } => {
      let keys = Object.keys(a);
      let arr = keys.filter(k => {
        curKey(k);
        return keyChecker.check(k) && checker.check(a[k]);
      });
      return arr.length === keys.length;
    }
  );

class CheckUnionWrapper<A, B> extends TypeCheck<A | B> {
  currentKey: number | undefined = undefined;
  error: Record<number, any> = {};
  _check: (x: any) => x is A | B = (a): a is A | B => {
    throw new Error("incorrect usage of CheckUnionWrapper");
  };
  get expectedMessage(): string {
    throw new Error("incorrect usage of CheckUnionWrapper");
  }

  constructor(public checkerA: TypeCheck<A>, public checkerB: TypeCheck<B>) {
    super();
  }
}

class CheckUnion<T> extends TypeCheck<T> {
  currentKey: string | number | undefined = undefined;
  error: Record<number, any> = {};
  expectedMessage: string = "";

  constructor(public checks: TypeCheck<any>[]) {
    super();
    this.expectedMessage = checks.map(e => e.expectedMessage).join(", ");
    if (this.checks.filter(e => e instanceof CheckUnion).length > 0)
      throw new Error(
        "A checkUnion as a direct child of a checkUnion is not supported. Use checkUnion.cu to nest unions instead."
      );
  }

  _check = (a: any): a is T => {
    // this.lastResult = undefined;
    this.currentKey = undefined;
    this.error = {};

    let res = this.checks.map((e, i) => {
      this.currentKey = i;
      let res = e.check(a);
      let err = e.error;
      return [res, err] as const;
    });

    let is = res.filter(e => e[0]).length > 0;
    // if (!is) res.forEach((e, i) => {
    //   if (!e[0] && typeof e[1] === "string" && e[1].startsWith("wrong union key")) {
    //     console.log(this.error[i]);
    //   }
    // })
    return is;
  };
}
// function getErrObj(is: boolean, checker: TypeCheck<any>, value: any) {
//   let errHash = (checker instanceof CheckObject)
//     ? checker.lastResult || checker.error
//     : checker.error;

//   if (is) return undefined;
//   if (typeof errHash === "symbol")
//     return TypeCheck.errorMessage(errHash)(checker, value);
//   else
//     return errHash;

// }

function flattenWrapper(c: TypeCheck<any>): TypeCheck<any>[] {
  if (c instanceof CheckUnionWrapper)
    return [...flattenWrapper(c.checkerA), ...flattenWrapper(c.checkerB)];
  else return [c];
}
/**
 * The error message of a union will be an array.
 * False indicates there were no errors for that branch (i.e. it passed)
 */
export const checkUnion = <A, B>(ca: TypeCheck<A>, cb: TypeCheck<B>) => {
  let checks = flattenWrapper(new CheckUnionWrapper(ca, cb)).filter(
    (e): e is NonNullable<typeof e> => !!e
  );
  return new CheckUnion<A | B>(checks);
};
checkUnion.cu = <A, B>(ca: TypeCheck<A>, cb: TypeCheck<B>) => new CheckUnionWrapper(ca, cb);

class CheckObject<T extends {}> extends TypeCheck<T> {
  private required = Object.keys(this.checkermap);
  private optional = Object.keys(this.optionalcheckermap);

  constructor(
    public checkermap: { [K: string]: TypeCheck<T[keyof T]> },
    public optionalcheckermap: { [K: string]: TypeCheck<T[keyof T]> },
    /** if these keys do not pass, the item is assumed to be unrelated */
    public unionKeys?: string[]
  ) {
    super();
    this.expectedMessage =
      "expected an object with keys " +
      [
        ...Object.keys(checkermap).map(e => JSON.stringify(e)),
        ...Object.keys(optionalcheckermap).map(e => JSON.stringify(e) + "?"),
      ].join(",");
    if (this.unionKeys)
      this.unionKeys.forEach(k => {
        if (this.required.indexOf(k) === -1)
          throw new Error("unionKey not found in checkermap " + k);
      });
  }

  public expectedMessage: string;
  public lastResult?: symbol = CheckObject.typeofNotObject;
  public lastMessage: string = "";
  // public errorLog: string[][] = [];
  public currentKey: string | number | undefined = undefined;
  public error: Record<string | number, any> | string | undefined = {};
  currentKeyArray: string[] = [];
  private symbolError(symbol: symbol, value: any, missingkeys?: string[]): false {
    this.lastResult = symbol;
    if (missingkeys) this.lastMessage = "missing required keys " + missingkeys.join(",");
    this.error =
      symbol === CheckObject.wrongUnionKey
        ? undefined
        : TypeCheck.errorMessage(symbol)(this, value);
    return false;
  }
  protected _check(a: any): a is T {
    this.lastResult = undefined;
    this.currentKey = undefined;
    this.lastMessage = "";
    this.error = {};
    if (typeof a !== "object") return this.symbolError(CheckObject.typeofNotObject, a);

    const keys = Object.keys(a);
    const checkKeys: string[] = [...this.required];
    this.optional.forEach(k => {
      if (checkKeys.indexOf(k) === -1) checkKeys.push(k);
    });

    let wrongunionkey =
      this.unionKeys &&
      !(
        this.unionKeys.filter(k => {
          let res = keys.indexOf(k) !== -1 && this.checkermap[k].check(a[k]);
          return res;
        }).length === this.unionKeys.length
      );
    if (wrongunionkey) return this.symbolError(CheckObject.wrongUnionKey, a);

    //check for missing required keys and return a string error if any are missing
    let missingkeys = this.required.filter(k => keys.indexOf(k) === -1);
    if (missingkeys.length) return this.symbolError(CheckObject.missingRequired, a, missingkeys);

    //make sure there are no extra keys in the object
    let extraKeys = keys.filter(e => checkKeys.indexOf(e) === -1);
    if (extraKeys.length) return this.symbolError(CheckObject.unexpectedProperty, a);

    return (
      keys.filter((k): boolean => {
        const keylog: string[] = [];
        let res: boolean = false;
        if (this.checkermap[k]) {
          this.currentKey = k;
          res = this.checkermap[k].check(a[k]);
        } else if (this.optionalcheckermap[k]) {
          this.currentKey = k;
          res = this.optionalcheckermap[k].check(a[k]);
        } else {
          this.currentKey = k;
          res = false;
          throw new Error(
            "Something went wrong and an extra key was found. This is a bug in the interface checker."
          );
        }
        return res;
      }).length === keys.length
    );
  }
  static wrongUnionKey = Symbol("unrelated union key");
  static typeofNotObject = Symbol("typeof not object");
  static missingRequired = Symbol("missing required keys");
  static unexpectedProperty = Symbol("property is unexpected");
}

type RequiredCheckermap<T extends {}, REQUIRED extends keyof T> = {
  [KEY in REQUIRED]-?: TypeCheck<T[KEY]>;
};
// type RequiredCheckermap<T extends { [K: string]: unknown }, REQUIRED extends string> = { [KEY in REQUIRED]-?: TypeCheck<T[KEY]> };
type OptionalCheckermap<T extends {}, REQUIRED extends keyof T> = {
  [KEY in Exclude<keyof T, REQUIRED>]-?: TypeCheck<T[KEY]>;
};
// type OptionalCheckermap<T extends { [K: string]: unknown }, REQUIRED extends string> = { [KEY in Exclude<keyof T, REQUIRED>]-?: TypeCheck<T[KEY]> };

export function checkResult(e: TypeCheck<any>, a: any) {
  let union = new CheckUnion([e]);
  let res = union.check(a);
  return [res, union.error ? union.error[0] : undefined] as const;
}

export function checkObject<T, REQUIRED extends keyof T = keyof T>(
  checkermap: RequiredCheckermap<T, REQUIRED>,
  optionalcheckermap: OptionalCheckermap<T, REQUIRED> = {} as any,
  unionKeys: string[] = []
) {
  return new CheckObject<T>(checkermap, optionalcheckermap, unionKeys);
}

class CheckRepeat<T> extends TypeCheck<T> {
  // public expectedMessage: string = "";
  public error: string | Record<string | number, any> | undefined = {};
  public currentKey: string | number | symbol | undefined;
  protected _check(a: any): a is T {
    this.error = {};
    return this.innerCheck().check(a);
  }

  constructor(private innerCheck: () => TypeCheck<T>, public expectedMessage: string) {
    super();
  }
}
/**
 * Allows recursive types to be checked. The recursive type
 * should be the result of a function so each checker will
 * be a unique instance. The callback will be called on each
 * recursion.
 */
export const checkRepeat = <T>(cb: () => TypeCheck<T>, expected: string) =>
  new CheckRepeat(cb, expected);


const checkAccessPerms = checkObject<ServerConfig_AccessOptions>({
  mkdir: checkBoolean,
  upload: checkBoolean,
  websockets: checkBoolean,
  writeErrors: checkBoolean,
  registerNotice: checkBoolean,
  putsaver: checkBoolean,
  loginlink: checkBoolean,
  transfer: checkBoolean,
  datafolder: checkBoolean
});

export const checkController = checkArray(checkObject<ServerConfig_Controller>({
  publicKey: checkString,
  permissions: checkUnion(checkBooleanFalse, checkAccessPerms),
  allowRestart: checkBoolean,
  allowSave: checkBoolean
}));
export function checkServerConfig(obj): readonly [boolean, string | {}] {
  // if(checker === undefined) checker = new CheckInterface(false);
  // else if (typeof checker === "boolean") checker = new CheckInterface(checker);

  // let checker = new CheckInterface(showUnionNulls);
  // let { checkBoolean, checkString, checkStringEnum, checkNumber, checkNumberEnum, checkBooleanFalse, checkNull } = checker;

  const putsaverOptional = as<OptionalCheckermap<ServerConfig_PutSaver, never>>({
    backupFolder: checkString,
    etag: checkStringEnum("optional", "required", "disabled"),
    etagAge: checkNumber,
    gzipBackups: checkBoolean,
    enabled: checkBoolean,
  });
  const checkOptions: TypeCheck<
    Config.Options_Auth | Config.Options_Backups | Config.Options_Index
  > = checkUnion(
    checkObject<Config.Options_Auth, "$element">(
      {
        $element: checkStringEnum("auth"),
      },
      {
        authError: checkNumberEnum(403, 404),
        authList: checkUnion(checkArray(checkString), checkNull),
      },
      ["$element"]
    ),
    checkUnion.cu(
      checkObject<Config.Options_Backups, "$element">(
        {
          $element: checkStringEnum("putsaver"),
        },
        putsaverOptional,
        ["$element"]
      ),
      checkObject<Config.Options_Index, "$element">(
        {
          $element: checkStringEnum("index"),
        },
        {
          defaultType: checkUnion(checkStringEnum("html", "json"), checkNumberEnum(404, 403)),
          indexExts: checkArray(checkString),
          indexFile: checkArray(checkString),
        },
        ["$element"]
      )
    )
  );
  const GroupChild: () => TypeCheck<Config.PathElement | Config.GroupElement> = () =>
    checkUnion(
      checkObject<Config.PathElement>(
        {
          $element: checkStringEnum("folder"),
          $options: checkArray(checkOptions),
          key: checkString,
          noTrailingSlash: checkBoolean,
          noDataFolder: checkBoolean,
          path: checkString,
        },
        undefined,
        ["$element"]
      ),
      checkObject<Config.GroupElement>(
        {
          $element: checkStringEnum("group"),
          $children: checkArray(checkRepeat(() => GroupChild(), "expected a repeat of GroupChild")),
          $options: checkArray(checkOptions),
          key: checkString,
          indexPath: checkUnion(checkString, checkBooleanFalse),
        },
        undefined,
        ["$element"]
      )
    );

  const _checkServerConfig = checkObject<ServerConfig>({
    $schema: checkString,
    __assetsDir: checkString,
    __dirname: checkString,
    __filename: checkString,
    __targetTW: checkString,
    _datafoldertarget: checkString,
    _devmode: checkBoolean,
    authCookieAge: checkNumber,
    maxTransferRequests: checkNumber,
    tree: checkArray(
      checkObject<Config.HostElement>({
        $element: checkStringEnum("host"),
        $mount: GroupChild(),
      })
    ),
    authAccounts: checkRecord(
      checkString,
      checkObject<ServerConfig["authAccounts"][""]>({
        clientKeys: checkRecord(
          checkString,
          checkObject<ServerConfig["authAccounts"][""]["clientKeys"][""]>({
            publicKey: checkString,
            cookieSalt: checkStringNotEmpty,
          })
        ),
        permissions: checkAccessPerms,
      })
    ),
    bindInfo: checkObject<ServerConfig["bindInfo"]>({
      _bindLocalhost: checkBoolean,
      bindAddress: checkArray(checkString),
      bindWildcard: checkBoolean,
      enableIPv6: checkBoolean,
      filterBindAddress: checkBoolean,
      https: checkBoolean,
      localAddressPermissions: checkRecord(checkString, checkAccessPerms),
      port: checkNumber,
    }),
    controllers: checkController,
    directoryIndex: checkObject<ServerConfig["directoryIndex"]>({
      defaultType: checkStringEnum("html", "json"),
      icons: checkRecord(checkString, checkArray(checkString)),
      mimetypes: checkRecord(checkString, checkArray(checkString)),
      mixFolders: checkBoolean,
      types: checkRecord(checkString, checkString),
    }),
    logging: checkObject<ServerConfig["logging"]>({
      debugLevel: checkNumber,
      logAccess: checkUnion(checkString, checkBooleanFalse),
      logColorsToFile: checkBoolean,
      logError: checkString,
      logToConsoleAlso: checkBoolean,
    }),
    putsaver: checkObject<ServerConfig["putsaver"], never>({}, putsaverOptional),
    datafolder: checkRecord(checkString, checkAny),
  });
  let [res, errHash] = checkResult(_checkServerConfig, obj);

  // if (res !== true) console.log(errHash); //if you hit this breakpoint, it means the settings does
  //not conform to ServerConfig and the server is about to exit. The error data is in `res`.
  // console.log("Check server config result: " + JSON.stringify(res, null, 2));
  return [res, errHash] as const;

}
