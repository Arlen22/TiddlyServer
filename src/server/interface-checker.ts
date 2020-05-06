import {
  ServerConfig,
  ServerConfig_AccessOptions,
  ServerConfig_PutSaver,
  Config,
  Schema,
  ServerConfig_Controller,
  ServerConfigSchema,
  defaultPermissions,
  ServerConfig_AuthAccountsValue,
} from "./server-config";
import { as } from "./server-types";

interface Description<V> {
  $description: string,
  $items?: DescObj<V>,
  $default?: NonNullable<V>,
  $ref?: string
}
type Primitive = string | number | symbol | false | true | undefined;
type DescItem<V> =
  V extends Primitive ? string :
  V extends Array<infer X> ? Description<NonNullable<X>> :
  string extends keyof V ? Description<V[keyof V]> : Description<V>;

type DescObj<V> = { [K in keyof V]-?: DescItem<NonNullable<V[K]>> };

let descriptions/* : DescObj<ServerConfigSchema> */ = {
  $schema: "The JSON schema location for this document. This schema is generated directly from the TypeScript interfaces used in TiddlyServer. A text-editor with autocomplete, such as VS code, will make editing this file much simpler. Most fields include a description like this one. \n\nAll relative paths in this file are resolved relative to this file, so `./settings-tree.xml` refers to an XML file in the same folder as this file. All relative paths in included files (such as the XML file) are resolved relative to the included file.",
  authCookieAge: "Age to set for the auth cookie (default is 30 days)\n- 24 hours: 86400\n- 7 days: 604800\n- 30 days: 2592000\n- 60 days: 5184000\n- 90 days: 7776000\n- 120 days: 10368000\n- 150 days: 12950000\n- 180 days: 15552000",
  debugLevel: "- 4: Errors that require the process to exit for restart \n- 3: Major errors that are handled and do not require a server restart \n- 2: Warnings or errors that do not alter the program flow but need to be marked (minimum for status 500) \n- 1: Info - Most startup messages \n- 0: Normal debug messages and all software and request-side error messages \n- -1: Detailed debug messages from high level apis \n- -2: Response status messages and error response data \n- -3: Request and response data for all messages (verbose) \n- -4: Protocol details and full data dump (such as encryption steps and keys)",
  maxTransferRequests: "",
  tree: {
    $description: "The tree property accepts one of 3 formats. \n\n- If it is a string ending in .xml, .js, or .json, the tree will be loaded from the specified path. JS and JSON files must export a tree property and XML files must specify a tree element as root. \n\n- A path element (or a string specifying the path) to mount a path as root (a single file is possible but pointless). \n\n- A group element or the children of a group element (which is either an array, or an object with no $element property)",
  },
  authAccounts: {
    $description: "",
    $items: {
      clientKeys: {
        $description: "",
        $items: {
          publicKey: "",
          cookieSalt: ""
        }
      },
      permissions: {
        $description: "",
        $ref: ""
      }
    },
  },
  bindInfo: {
    $description: "bind address and port info",
    $items: {
      port: "port to listen on, default is 8080 for http and 8443 for https",
      _bindLocalhost: "always bind a separate server instance to 127.0.0.1 regardless of any other settings",
      bindAddress: { $description: "An array of IP addresses to accept requests on. Can be any IP address assigned to the machine. Default is \"127.0.0.1\".\n\nIf `bindWildcard` is true, each connection is checked individually. Otherwise, the server listens on the specified IP addresses and accepts all connections from the operating system. If an IP address cannot be bound, the server skips it unless `--bindAddressRequired` is specified\n\nIf `filterBindAddress` is true, IPv4 addresses may include a subnet mask, (e.g. `/24`) which matches any interface IP address in that range. Prefix with a minus sign (-) to block requests incoming to that IP address or range." },
      bindWildcard: "Bind to the wildcard addresses `0.0.0.0` and `::` (if enabled) in that order. The default is `true`. In many cases this is preferred, however Android does not support this for some reason. On Android, set this to `false` and set host to `[\"0.0.0.0/0\"]` to bind to all IPv4 addresses.",
      enableIPv6: "Bind to the IPv6 wildcard as well if `bindWilcard` is true and allow requests incoming to IPv6 addresses if not explicitly denied.",
      filterBindAddress: "IPv4 addresses may include a subnet mask, (e.g. `/24`) which matches any IP address in that range. Prefix with a minus sign (-) to block requests incoming to that IP address or range.",
      https: "https-only options: a string to a JavaScript file which exports a function of type `(iface:string) => https.ServerOptions`. Note that the initServer function will change this to a boolean value indicating whether https is in use once inside TiddlyServer.",
      localAddressPermissions: {
        $description: "Permissions based on local interface address.  Enter the IP Address and NetMask (`127.0.0.1/8`) as the property key. The keyword \"localhost\" (if specified) matches 127.0.0.0/8 instead of any other specified key.  Keyword \"*\" matches everything that doesn't match another IP address.  This checks the IP address each client connects to (socket.localAddress), not the bind address of the server instance that accepted the request. The keyword defaultPermission does nothing, but auto-complete should give you the default object.  You can then rename it to whatever you need it to be. ",
        $default: {
          "writeErrors": false,
          "mkdir": false,
          "upload": false,
          "websockets": false,
          "registerNotice": true,
          "putsaver": true,
          "loginlink": true,
          "transfer": false,
          "datafolder": true
        },
        $items: {
          datafolder: "Whether clients may access data folders, which gives them full access to the system as the user that owns the server process because data folders can be easily modified to execute code on the server. This returns a 403 Access Denied if a data folder is detected. It does not serve the files inside the data folder as a regular folder. For that you need to use the noDataFolder attribute on the folder in the tree.",
          loginlink: "Whether to include a link to the login page when returning auth errors",
          mkdir: "Whether clients may create new directories and datafolders inside existing directories served by TiddlyWiki",
          putsaver: "Whether clients may use the put saver, allowing any file served within the tree (not assets) to be overwritten, not just TiddlyWiki files. The put saver cannot save to data folders regardless of this setting.",
          registerNotice: "Whether login attempts for a public/private key pair which has not been registered will be logged at debug level 2 with the full public key which can be copied into an authAccounts entry. Turn this off if you get spammed with login attempts.",
          transfer: "Allows clients to use a custom TiddlyServer feature which relays a connection between two clients. ",
          upload: "Whether clients may upload files to directories (not data folders).",
          websockets: "Whether clients may open websocket connections.",
          writeErrors: "Whether to write status 500 errors to the browser, possibly including stack traces."
        }
      },
    }
  },
  controllers: { $description: "" },
  directoryIndex: { $description: "" },
  putsaver: { $description: "" },
  datafolder: { $description: "Options object whose properties will be passed to the tiddlywiki server instance using the spread operator. If a property specifies an object instead of a string, the object will be shared between all instances." },
  _datafolderclient: "The tiddlywiki folder to serve on `/assets/tiddlywiki/`",
  _datafolderserver: "The tiddlywiki folder to use for data folder instances.",
  _datafoldertarget: "Deprecated: Use _datafolderserver instead.",
  _devmode: "enables certain expensive per-request checks",

};



type Reffer = Record<string, () => TypeCheck<any>>;
abstract class TypeCheck<T> {
  static currentKeyArray: (string | number)[] = [];
  static stack: TypeCheck<any>[] = [];
  public abstract expectedMessage: string;
  public abstract error: Record<string, any> | string | undefined;
  protected abstract currentKey: string | number | symbol | undefined;
  protected description: string = "";
  protected defData: any = undefined;
  /** Chainable method to set schema description */
  public describe(description: string) {
    this.description = description;
    return this;
  }
  /** Chainable method to set schema default */
  public defaultData(def: NonNullable<T>) {
    this.defData = def;
    return this;
  }
  protected abstract _check(a: any, reffer: Reffer): a is T;

  private errMessage = (err: any) => JSON.stringify(TypeCheck.currentKeyArray) + " " + err + "\n";

  public check(a: any, reffer: Reffer): a is T {
    let parent: TypeCheck<any> | undefined = TypeCheck.stack[TypeCheck.stack.length - 1];
    TypeCheck.stack.push(this);
    this.currentKey = undefined;

    let res: boolean = false;

    if (!parent) {
      res = this._check(a, reffer);
    } else if (
      parent instanceof CheckMultiple ||
      parent instanceof CheckObject ||
      parent instanceof CheckUnion
    ) {
      let key = parent.currentKey;

      res = this._check(a, reffer);

      if (!res && typeof parent.error === "object") {
        parent.error[key] = this.error;
      } else if (!res) {
        throw new Error(
          "parent.error is a string. This is a bug in one of the instanceof specified classes."
        );
      }
    } else if (parent instanceof CheckSimple) {
      throw new Error("CheckSimple instances may not call other checkers. ");
    } else if (parent instanceof CheckRef) {
      res = this._check(a, reffer);
      if (!res) parent.error = this.error;
    } else {
      throw new Error("unhandled instance " + this.toString());
    }
    TypeCheck.stack.pop();
    this.currentKey = undefined;
    return res;
  }
  public abstract getSchema(reffer: Reffer): any;

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
  protected currentKey: undefined = undefined;
  protected _check: (a: any) => a is T;
  constructor(
    public expectedMessage: string,
    check: (a: any) => a is T,
    public schema: {
      type: "boolean" | "number" | "string" | "null" | "object",
      enum?: readonly any[],
      expectNotEmpty?: boolean,
      regex?: string,
    }
  ) {
    super();
    this._check = check;
    this.error = this.expectedMessage;
  }
  getSchema() {
    return {
      type: this.schema.type,
      enum: this.schema.enum,
      default: this.defData,
      description: this.description || undefined
    }
  }
}

export const checkString = () => new CheckSimple(
  "expected a string value",
  (a): a is string => typeof a === "string",
  { type: "string" }
);
export const checkStringEnum = <T extends string>(val: readonly T[], ) =>
  new CheckSimple(
    "expected one string of " + JSON.stringify(val),
    (a): a is T => typeof a === "string" && (val as readonly string[]).indexOf(a) !== -1,
    { type: "string", enum: val }
  );
export const checkStringNotEmpty = () => new CheckSimple(
  "expected a string with non-zero length",
  (a): a is string => typeof a === "string" && a.length > 0,
  { type: "string", expectNotEmpty: true }
);
export const checkStringRegex = (reg: RegExp) => new CheckSimple(
  "expected a string that matches the regex " + reg.source,
  (a): a is string => typeof a === "string" && reg.test(a),
  { type: "string", regex: reg.source }
)
export const checkNumber = () => new CheckSimple(
  "expected a number value",
  (a): a is number => typeof a === "number",
  { type: "number" }
);
export const checkNumberEnum = <T extends number>(val: readonly T[], ) =>
  new CheckSimple(
    "expected one number of " + JSON.stringify(val),
    (a): a is T => typeof a === "number" && (val as readonly number[]).indexOf(a) !== -1,
    { type: "number", enum: val }
  );
export const checkBoolean = () => new CheckSimple(
  "expected a boolean value",
  (a): a is boolean => typeof a === "boolean",
  { type: "boolean" }
);
export const checkBooleanTrue = () => new CheckSimple(
  "expected a boolean true",
  (a): a is true => typeof a === "boolean" && a === true,
  { type: "boolean", enum: [true] }
);
export const checkBooleanFalse = () => new CheckSimple(
  "expected a boolean false",
  (a): a is false => typeof a === "boolean" && a === false,
  { type: "boolean", enum: [false] }
);
export const checkNull = () => new CheckSimple(
  "expected a null value",
  (a): a is null => typeof a === "object" && a === null,
  { type: "null" }
);
export const checkUndefined = () => new CheckSimple(
  "expected a null value",
  (a): a is undefined => typeof a === "undefined",
  { type: "null" }
);
export const checkAny = () => new CheckSimple(
  "expected any value",
  (a): a is any => true,
  { type: "object" }
);

export class CheckMultiple<T extends {}> extends TypeCheck<T> {
  error: Record<string, any> | string = {} as any;
  currentKey: any;
  protected _check = (a: any, reffer): a is T => {
    this.currentKey = undefined;
    this.error = {};
    let res = this.checkObject(a, reffer);
    if (!res) return (this.error = this.expectedMessage), res;
    else return this.checkChildren(a, reffer, k => {
      this.currentKey = k;
    });
  };
  constructor(
    public expectedMessage: string,
    private checkObject: (a: any, reffer: Reffer) => a is T,
    private checkChildren: (a: any, reffer: Reffer, curKey: (k: any) => void) => a is T,
    private schema: "array" | "record",
    private childType: TypeCheck<any>
  ) {
    super();
  }
  getSchema(reffer) {
    switch (this.schema) {
      case "record": return {
        type: "object",
        additionalProperties: this.childType.getSchema(reffer),
        default: this.defData,
        description: this.description || undefined
      };
      case "array": return {
        items: this.childType.getSchema(reffer),
        type: "array",
        default: this.defData,
        description: this.description || undefined
      };
    }
  }
}

type ArrayType<T> = T extends Array<infer X> ? X : never;
export const checkArray = <V>(checker: TypeCheck<V>, ) =>
  new CheckMultiple(
    "expected an array that " + checker.expectedMessage,
    (a, reffer): a is V[] => typeof a === "object" && Array.isArray(a),
    (a, reffer, curKey): a is V[] =>
      a.filter((b, i) => {
        curKey(i);
        return checker.check(b, reffer);
      }).length === a.length,
    "array",
    checker
  );

export const checkRecord = <K extends string, V>(
  keyChecker: TypeCheck<K>,
  checker: TypeCheck<V>,

) =>
  new CheckMultiple<{ [k in K]: V }>(
    "expected a record that " + checker.expectedMessage,
    (a, reffer): a is { [k in K]: V } => typeof a === "object",
    (a, reffer, curKey): a is { [k in K]: V } => {
      let keys = Object.keys(a);
      let arr = keys.filter(k => {
        curKey(k);
        return keyChecker.check(k, reffer) && checker.check(a[k], reffer);
      });
      return arr.length === keys.length;
    },
    "record",
    checker
  );

class CheckUnionWrapper<A, B> extends TypeCheck<A | B> {
  currentKey: number | undefined = undefined;
  error: any[] = [];
  _check: (x: any) => x is A | B = (a): a is A | B => {
    throw new Error("incorrect usage of CheckUnionWrapper");
  };
  get expectedMessage(): string {
    throw new Error("incorrect usage of CheckUnionWrapper");
  }
  getSchema() {
    throw new Error("incorrect usage of CheckUnionWrapper");
  }
  constructor(public checkerA: TypeCheck<A>, public checkerB: TypeCheck<B>) {
    super();
  }
}

class CheckUnion<T> extends TypeCheck<T> {
  currentKey: string | number | undefined = undefined;
  error: any[];
  expectedMessage: string = "";

  constructor(public checks: TypeCheck<any>[]) {
    super();
    this.error = new Array(this.checks.length);
    this.expectedMessage = checks.map(e => e.expectedMessage).join(", ");
    if (this.checks.filter(e => e instanceof CheckUnion).length > 0)
      throw new Error(
        "A checkUnion as a direct child of a checkUnion is not supported. Use checkUnion.cu to nest unions instead."
      );
  }

  _check = (a: any, reffer: Reffer): a is T => {
    // this.lastResult = undefined;
    this.currentKey = undefined;
    this.error = new Array(this.checks.length);

    let res = this.checks.map((e, i) => {
      this.currentKey = i;
      let res = e.check(a, reffer);
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
  getSchema(reffer) {
    return {
      default: this.defData,
      description: this.description || undefined,
      "anyOf": this.checks.map(e => e.getSchema(reffer))
    }
  }
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
    public description: string,
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
  getSchema(reffer) {
    const properties = {};
    this.required.forEach(k => {
      properties[k] = this.checkermap[k].getSchema(reffer);
    });
    this.optional.forEach(k => {
      properties[k] = this.optionalcheckermap[k].getSchema(reffer);
    });
    return {
      type: "object",
      additionalProperties: false,
      properties,
      required: this.required,
      default: this.defData,
      description: this.description || undefined
    }
  }
  public expectedMessage: string;
  public lastResult?: symbol = CheckObject.typeofNotObject;
  public lastMessage: string = "";
  // public errorLog: string[][] = [];
  public currentKey: string | number | undefined = undefined;
  public error: Record<string, any> | string | undefined = {};
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
  protected _check(a: any, reffer: Reffer): a is T {
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
          let res = keys.indexOf(k) !== -1 && this.checkermap[k].check(a[k], reffer);
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
          res = this.checkermap[k].check(a[k], reffer);
        } else if (this.optionalcheckermap[k]) {
          this.currentKey = k;
          res = this.optionalcheckermap[k].check(a[k], reffer);
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

// type RequiredCheckermap<T extends {}, REQUIRED extends keyof T> = {
//   [KEY in REQUIRED]-?: TypeCheck<T[KEY]>;
// };
// type RequiredCheckermap<T extends { [K: string]: unknown }, REQUIRED extends string> = { [KEY in REQUIRED]-?: TypeCheck<T[KEY]> };
type OptionalCheckermap<T extends {}, REQUIRED extends keyof T> = {
  [KEY in Exclude<keyof T, REQUIRED>]-?: TypeCheck<T[KEY]>;
};
// type OptionalCheckermap<T extends { [K: string]: unknown }, REQUIRED extends string> = { [KEY in Exclude<keyof T, REQUIRED>]-?: TypeCheck<T[KEY]> };

export function checkResult(e: TypeCheck<any>, a: any, reffer: Reffer) {
  let union = new CheckUnion([e]);
  let res = union.check(a, reffer);
  return [res, union.error ? union.error[0] : undefined] as const;
}
type Defined<T> = T extends undefined ? never : T;

type ExcludeNever<T> = { [K in keyof T]: T[K] extends never ? never : K }
type r = NonNullable<ServerConfigSchema["directoryIndex"]>;
type t = ExcludeNever<NonNullable<ServerConfigSchema["directoryIndex"]>>;
/** checkermap parameter is type never if T extends undefined */
export function checkObject<T, REQUIRED extends keyof T = keyof ExcludeNever<T>>(
  description: string,
  checkermap: {
    [KEY in REQUIRED]-?: TypeCheck<T[KEY]>;
  },
  optionalcheckermap: {
    [KEY in Exclude<keyof T, REQUIRED>]-?: TypeCheck<Defined<T[KEY]>>;
  } = {} as any,
  unionKeys: string[] = []
) {
  return new CheckObject<T>(description, checkermap, optionalcheckermap, unionKeys);
}

class CheckRef<T> extends TypeCheck<T> {
  // public expectedMessage: string = "";
  public error: string | Record<string, any> | undefined = {};
  public currentKey: string | number | symbol | undefined;
  protected _check(a: any, reffer: Reffer): a is T {
    this.error = {};
    if (!reffer[this.refKey]) console.log(reffer, this.refKey);
    return reffer[this.refKey]().check(a, reffer);
  }

  constructor(
    private refKey: string,
    public expectedMessage: string
  ) {
    super();
  }

  getSchema() {
    return { $ref: "#/definitions/" + this.refKey }
  }
}
/**
 * Allows recursive types to be checked. The recursive type
 * should be the result of a function so each checker will
 * be a unique instance. The callback will be called on each
 * recursion.
 */
export const checkRef = <T extends Reffer>() => <K extends keyof T>(refKey: K, expected: string) => {
  return new CheckRef<ReturnType<T[K]> extends TypeCheck<infer X> ? X : any>(refKey, expected);
}

// const checkAccessPerms = checkObject<ServerConfig_AccessOptions>(
//   "Permissions based on local interface address.  Enter the IP Address and NetMask (`127.0.0.1/8`) as the property key. The keyword \"localhost\" (if specified) matches 127.0.0.0/8 instead of any other specified key.  Keyword \"*\" matches everything that doesn't match another IP address.  This checks the IP address each client connects to (socket.localAddress), not the bind address of the server instance that accepted the request. The keyword defaultPermission does nothing, but auto-complete should give you the default object.  You can then rename it to whatever you need it to be. ",
//   {
//     datafolder: checkBoolean("Whether clients may access data folders, which gives them full access to the system as the user that owns the server process because data folders can be easily modified to execute code on the server. This returns a 403 Access Denied if a data folder is detected. It does not serve the files inside the data folder as a regular folder. For that you need to use the noDataFolder attribute on the folder in the tree."),
//     loginlink: checkBoolean("Whether to include a link to the login page when returning auth errors"),
//     mkdir: checkBoolean("Whether clients may create new directories and datafolders inside existing directories served by TiddlyWiki"),
//     putsaver: checkBoolean("Whether clients may use the put saver, allowing any file served within the tree (not assets) to be overwritten, not just TiddlyWiki files. The put saver cannot save to data folders regardless of this setting."),
//     registerNotice: checkBoolean("Whether login attempts for a public/private key pair which has not been registered will be logged at debug level 2 with the full public key which can be copied into an authAccounts entry. Turn this off if you get spammed with login attempts."),
//     transfer: checkBoolean("Allows clients to use a custom TiddlyServer feature which relays a connection between two clients. "),
//     upload: checkBoolean("Whether clients may upload files to directories (not data folders)."),
//     websockets: checkBoolean("Whether clients may open websocket connections."),
//     writeErrors: checkBoolean("Whether to write status 500 errors to the browser, possibly including stack traces."),
//   }
// );

// export const checkController = checkArray(checkObject<ServerConfig_Controller>({
//   publicKey: checkString(descriptions.controllers.$description),
//   permissions: checkUnion(checkBooleanFalse, checkAccessPerms),
//   allowRestart: checkBoolean,
//   allowSave: checkBoolean
// }));
export function checkServerConfig(obj): readonly [boolean, string | {}] {
  const _checkServerConfig = getServerConfig();
  let [res, errHash] = checkResult(_checkServerConfig["ServerConfig"](), obj, _checkServerConfig);
  return [res, errHash] as const;
}
export function generateSchema($id: string): any {
  const refs = getServerConfig();
  let definitions = {};
  Object.keys(refs).forEach((k) => {
    if (k === "ServerConfig") return;
    definitions[k] = refs[k as keyof typeof refs]().getSchema(refs);
  });
  return {
    $id,
    $ref: "#/definitions/ServerConfigSchema",
    $schema: "http://json-schema.org/draft-07/schema#",
    definitions
  };
}
type treeType = {

}

type refsType = {
  "GroupChild": () => TypeCheck<Config.PathElement | Config.GroupElement>
  "TreeOptions": () => TypeCheck<Config.Options_Auth | Config.Options_Index | Config.Options_Putsaver>
  "AccessOptions": () => TypeCheck<ServerConfig_AccessOptions>
  "AuthAccountsValue": () => TypeCheck<ServerConfig_AuthAccountsValue>
  "ServerConfig": () => TypeCheck<ServerConfig>
  "SchemaGroupChild": () => TypeCheck<Schema.GroupChildElements | Record<string, string | object>>
  "ServerConfigSchema": () => TypeCheck<ServerConfigSchema>
}
function getSchemaGroupChild() {
  const groupElement: {
    (array: true): TypeCheck<Schema.ArrayGroupElement>;
    (array: false): TypeCheck<Schema.GroupElement>;
  } = <AR extends boolean>(array: AR) => {
    return checkObject<Schema.ArrayGroupElement, "$element" | "$children" | "key">("",
      {
        $element: checkStringEnum(["group"]),
        ...(array ? { key: checkString() } : {}) as { key: TypeCheck<string> },
        $children: checkRef<refsType>()("SchemaGroupChild", "expected a repeat of GroupChild") as any
      },
      {
        $options: checkArray(checkRef<refsType>()("TreeOptions", "expected one of TreeOptions")),
        indexPath: checkString().describe("Path of a file to serve as the directory index.")
      },
      ["$element"]
    ).describe("This is a group element in an " + (array ? "array" : "object") + ". It is used for grouping folders under a mount point. " + (array ? "The key property is the mount point" : "The key is the mount point"));
  };
  const folderElement: {
    (array: true): TypeCheck<Schema.ArrayFolderElement>;
    (array: false): TypeCheck<Schema.FolderElement>;
  } = <AR extends boolean>(array: AR) => {
    return checkObject<Schema.ArrayFolderElement, "$element" | "path">("",
      {
        $element: checkStringEnum(["folder"] as const),
        path: checkString().describe("Path relative to this file or an absolute path. If NodeJS can access it using stat, readdir, and readFile, then you can put it here")
      },
      {
        $options: checkArray(checkRef<refsType>()("TreeOptions", "expected one of TreeOptions")),
        noTrailingSlash: checkBoolean().describe("Load data folders under this path with no trailing slash. This imitates single-file wikis and allows tiddlers with relative links to be imported directly into a data folder wiki. The source point of the relative link becomes the data folder itself as though it is actually a file. However, this breaks relative links to resources served by the datafolder instance itself, such as the files directory introduced in 5.1.19 and requires the relative link to include the data folder name in the relative link. For this reason, it is better to convert single-file wikis to the datafolder format by putting each wiki inside its own folder as index.html, and a \"files\" folder beside the index.html file, and adding an index option to this element."),
        noDataFolder: checkBoolean().describe("Do not recognize datafolders within this path. Files within data folders will be accessible directly from the web, including the tiddlywiki.info file, instead of treating it as a data folder. This is useful for folders like your downloads folder which might end up containing a tiddlywiki.info file but you do not want it to be a data folder."),
        ...(array ? { key: checkString() } : {}) as { key: TypeCheck<string> }
      },
      ["$element"]
    ).describe("This is a folder element. The path property specifies the file system path to serve. Any path may be specified, not just a folder. The key is the mount point for this item. If this is in an Array, the key property will be used or the path basename.")
  };
  const folderString = () => checkString().describe("A string specifying the file or folder to mount here. If this is in an array the basename will be used, in an object the key will be used.");

  const SchemaGroupChild = () => checkUnion(
    checkRecord<string, string | object>(checkStringRegex(/^[^$]+$/), checkUnion(
      checkUnion.cu(
        folderElement(false),
        groupElement(false),
      ),
      checkUnion.cu(
        checkRef<refsType>()("SchemaGroupChild", "expected group child"),
        folderString()
      )
    )),
    checkArray<Schema.ArrayFolderElement | Schema.ArrayGroupElement | string>(
      checkUnion(
        checkUnion.cu(
          folderElement(true),
          groupElement(true),
        ),
        folderString(),
      )
    )
  ).describe("This is the children type. It can be an array or object containing tree items. An array cannot use the group shorthand because there is no way to specify the mount point. You can use the advanced element syntax ({\"$element\":\"group\", \"key\":\"mount-point\", \"$children\": Children }) instead.");

  return SchemaGroupChild;

}
const putsaverOptional = () => ({
  backupFolder: checkString().describe("Backup folder to store backups in. Multiple folder paths can backup to the same folder if desired."),
  etag: checkStringEnum(["optional", "required", "disabled"]).describe("Whether to use the etag field -- if not specified then it will check it if presented. This does not affect the backup etagAge option, as the saving mechanism will still send etags back to the browser, regardless of this option."),
  etagAge: checkNumber().describe("Reject an etag with a modified time that is different than the file on disk by this many seconds. Sometimes sync or antivirus sofware will \"touch\" a file and update the modified time without changing anything. Size difference will still cause the request to be rejected."),
  gzipBackups: checkBoolean().describe("GZip backup file to save disk space. Good for larger wikis. Turn this off for experimental wikis that you often need to restore from a backup because of a bad line of code (I speak from experience)."),
  enabled: checkBoolean().describe("If false, disables the put saver globally"),
});
function getServerConfig() {

  const AccessOptionsDescription = "Whether the user has access to different features of TiddlyServer beyond static file serving";
  type TypeCheckItems<T, X = never> = {
    [K in Exclude<keyof T, X>]: TypeCheck<T[K]>;
  };

  const refs: { [K in keyof refsType]: refsType[K] } = {
    "GroupChild": (): TypeCheck<Config.PathElement | Config.GroupElement> =>
      checkUnion(
        checkObject<Config.PathElement>(
          "",
          {
            $element: checkStringEnum(["folder"] as const),
            $options: checkArray(checkRef<refsType>()("TreeOptions", "expected one of TreeOptions")),
            noTrailingSlash: checkBoolean(),
            noDataFolder: checkBoolean(),
            path: checkString(),
            key: checkString(),
          },
          undefined,
          ["$element"]
        ),
        checkObject<Config.GroupElement>("",
          {
            $element: checkStringEnum(["group"]),
            $children: checkArray(checkRef<refsType>()("GroupChild", "expected a repeat of GroupChild")),
            $options: checkArray(checkRef<refsType>()("TreeOptions", "expected one of TreeOptions")),
            indexPath: checkUnion(checkString(), checkBooleanFalse()),
            key: checkString(),
          },
          undefined,
          ["$element"]
        )
      ),
    "TreeOptions": () => checkUnion(
      checkObject<Config.Options_Auth, "$element">("",
        { $element: checkStringEnum(["auth"]).describe("Only allow requests using these authAccounts. Option elements affect the group they belong to and all children under that. Each property in an auth element replaces the key from parent auth elements.\n\nAnonymous requests are ALWAYS denied if an auth list applies to the requested path.\n\nNote that this does not change server authentication procedures. Data folders are always given the authenticated username regardless of whether there are auth elements in the tree.") },
        {
          authError: checkNumberEnum([403, 404] as const).describe("Which error code to return for unauthorized (or anonymous) requests\n\n - 403 Access Denied: Client is not granted permission to access this resouce.\n - 404 Not Found: Client is told that the resource does not exist."),
          authList: checkUnion(checkArray(checkString()), checkNull()).describe("Array of keys from authAccounts object that can access this resource. `null` allows all requests, including anonymous."),
        },
        ["$element"]
      ),
      checkUnion.cu(
        checkObject<Config.Options_Putsaver, "$element">("",
          {
            $element: checkStringEnum(["putsaver"] as const).describe("Options related to backups for single-file wikis. Option elements affect the group they belong to and all children under that. Each property in a backups element replaces the key from parent backups elements."),
          },
          putsaverOptional(),
          ["$element"]
        ),
        checkObject<Config.Options_Index, "$element">("",
          {
            $element: checkStringEnum(["index"] as const),
          },
          {
            defaultType: checkUnion(checkStringEnum(["html", "json"] as const), checkNumberEnum([404, 403] as const)),
            indexExts: checkArray(checkString()),
            indexFile: checkArray(checkString()),
          },
          ["$element"]
        )
      )
    ),
    "AccessOptions": () => checkObject<ServerConfig_AccessOptions>(
      "",
      {
        datafolder: checkBoolean().describe("Whether clients may access data folders, which gives them full access to the system as the user that owns the server process because data folders can be easily modified to execute code on the server. This returns a 403 Access Denied if a data folder is detected. It does not serve the files inside the data folder as a regular folder. For that you need to use the noDataFolder attribute on the folder in the tree."),
        loginlink: checkBoolean().describe("Whether to include a link to the login page when returning auth errors"),
        mkdir: checkBoolean().describe("Whether clients may create new directories and datafolders inside existing directories served by TiddlyWiki"),
        putsaver: checkBoolean().describe("Whether clients may use the put saver, allowing any file served within the tree (not assets) to be overwritten, not just TiddlyWiki files. The put saver cannot save to data folders regardless of this setting."),
        registerNotice: checkBoolean().describe("Whether login attempts for a public/private key pair which has not been registered will be logged at debug level 2 with the full public key which can be copied into an authAccounts entry. Turn this off if you get spammed with login attempts."),
        transfer: checkBoolean().describe("Allows clients to use a custom TiddlyServer feature which relays a connection between two clients. "),
        upload: checkBoolean().describe("Whether clients may upload files to directories (not data folders)."),
        websockets: checkBoolean().describe("Whether clients may open websocket connections."),
        writeErrors: checkBoolean().describe("Whether to write status 500 errors to the browser, possibly including stack traces."),
      }
    ).describe(AccessOptionsDescription),
    AuthAccountsValue: () => checkObject<ServerConfig_AuthAccountsValue>("", {
      clientKeys: checkRecord(
        checkString(),
        checkObject<ServerConfig_AuthAccountsValue["clientKeys"][""]>("", {
          publicKey: checkString().describe("base 64 encoded public key"),
          cookieSalt: checkStringNotEmpty().describe("String which will be added to the cookie by the server. Changing it will invalidate all current cookies for this user, which requires them to login again on each device. `node -e \"console.log(Date.now())\"` will print the current timestamp, which you can use to make sure you get one that you've never used it before."),
        }).describe("The username the user will login with")
      ).describe("Changing the public key or cookie suffix will require the user to log in again."),
      permissions: checkRef<refsType>()("AccessOptions", "expected AccessOptions object")
        .describe(AccessOptionsDescription)
        .defaultData(defaultPermissions),
    }).describe("The authAccount specified in the tree auth options"),
    SchemaGroupChild: getSchemaGroupChild(),
    "ServerConfig": () => checkObject<ServerConfig>("", {
      $schema: checkString(),
      __assetsDir: checkString(),
      __dirname: checkString(),
      __filename: checkString(),
      __serverTW: checkString(),
      __clientTW: checkString(),
      _devmode: checkBoolean(),
      authCookieAge: checkNumber(),
      maxTransferRequests: checkNumber(),
      debugLevel: checkNumber(),
      tree: checkArray(checkObject<Config.HostElement>("", {
        $element: checkStringEnum(["host"] as const),
        $mount: checkRef<refsType>()("GroupChild", "expected a GroupChild object"),
      })),
      authAccounts: checkRecord(checkString(), checkRef<refsType>()("AuthAccountsValue", "expected AuthAccountsValue")),
      bindInfo: checkObject<ServerConfig["bindInfo"]>("", {
        _bindLocalhost: checkBoolean(),
        bindAddress: checkArray(checkString()),
        bindWildcard: checkBoolean(),
        enableIPv6: checkBoolean(),
        filterBindAddress: checkBoolean(),
        https: checkBoolean(),
        localAddressPermissions: checkRecord(
          checkString(),
          checkRef<refsType>()("AccessOptions", "expected AccessOptions object"),
        ),
        port: checkNumber(),
      }),
      controllers: checkAny().describe("This is not implemented yet"),
      directoryIndex: checkObject<ServerConfig["directoryIndex"]>("", {
        defaultType: checkStringEnum(["html", "json"] as const),
        icons: checkRecord(checkString(), checkArray(checkString())),
        mimetypes: checkRecord(checkString(), checkArray(checkString())),
        mixFolders: checkBoolean(),
        types: checkRecord(checkString(), checkString()),
      }),
      putsaver: checkObject<ServerConfig["putsaver"], never>("", {}, putsaverOptional()),
      datafolder: checkRecord(checkString(), checkAny()),
    }),
    ServerConfigSchema: () => checkObject<Defined<ServerConfigSchema>, "tree">("", {
      tree: checkRef<refsType>()("SchemaGroupChild", "expected group child"),
    }, {
      _datafolderclient: checkString().describe("The tiddlywiki folder to serve on \"/assets/tiddlywiki/\""),
      _datafolderserver: checkString().describe("The tiddlywiki folder to use for data folder instances."),
      _datafoldertarget: checkString().describe("Deprecated: Use _datafolderserver instead."),
      _devmode: checkBoolean(),
      maxTransferRequests: checkNumber().describe("Max concurrent transfer requests"),
      authCookieAge: checkNumber().describe("Age to set for the auth cookie (default is 30 days)\n- 24 hours: 86400\n- 7 days: 604800\n- 30 days: 2592000\n- 60 days: 5184000\n- 90 days: 7776000\n- 120 days: 10368000\n- 150 days: 12950000\n- 180 days: 15552000"),
      debugLevel: checkNumber().describe("- 4: Errors that require the process to exit for restart \n- 3: Major errors that are handled and do not require a server restart \n- 2: Warnings or errors that do not alter the program flow but need to be marked (minimum for status 500) \n- 1: Info - Most startup messages \n- 0: Normal debug messages and all software and request-side error messages \n- -1: Detailed debug messages from high level apis \n- -2: Response status messages and error response data \n- -3: Request and response data for all messages (verbose) \n- -4: Protocol details and full data dump (such as encryption steps and keys)"),
      $schema: checkString().describe("\nThe JSON schema location for this document. This schema is generated\ndirectly from the TypeScript interfaces\nused in TiddlyServer. A text-editor with intellisense, such as VS code,\nwill make editing this file much simpler.\nMost fields include a description like this one.\n\nAll relative paths in this file are resolved relative to this file, so\n`./settings-tree.xml` refers to an XML file in the same folder as this file.\nAll relative paths in included files (such as the XML file) are resolved\nrelative to the included file."),
      bindInfo: checkObject<Defined<ServerConfigSchema["bindInfo"]>, never>("", {}, {
        _bindLocalhost: checkBoolean().describe("always bind a separate server instance to 127.0.0.1 regardless of any other settings"),
        bindAddress: checkArray(checkString()).describe("An array of IP addresses to accept requests on. Can be any IP address\nassigned to the machine. Default is \"127.0.0.1\".\n\nIf `bindWildcard` is true, each connection is checked individually. Otherwise, the server listens\non the specified IP addresses and accepts all connections from the operating system. If an IP address\ncannot be bound, the server skips it unless `--bindAddressRequired` is specified\n\nIf `filterBindAddress` is true, IPv4 addresses may include a subnet mask,\n(e.g. `/24`) which matches any interface IP address in that range. Prefix with a minus sign (-)\nto block requests incoming to that IP address or range."),
        bindWildcard: checkBoolean().describe("Bind to the wildcard addresses `0.0.0.0` and `::` (if enabled) in that order. The default is `true`. In many cases this is preferred, however Android does not support this for some reason. On Android, set this to `false` and set host to `[\"0.0.0.0/0\"]` to bind to all IPv4 addresses."),
        enableIPv6: checkBoolean().describe("Bind to the IPv6 wildcard as well if `bindWilcard` is true and allow requestsincoming to IPv6 addresses if not explicitly denied"),
        filterBindAddress: checkBoolean().describe("IPv4 addresses may include a subnet mask, (e.g. `/24`) which matches any IP address in that range. Prefix with a minus sign (-) to block requests incoming to that IP address or range."),
        https: checkString().describe("https-only options: a string to a JavaScript file which exports a function of type `(iface:string) => https.ServerOptions`. Developers: Note that the initServer function will change this to a boolean value indicating whether https is in use once inside TiddlyServer."),
        port: checkNumber().describe("port to listen on, default is 8080 for http and 8443 for https"),
        localAddressPermissions: checkRecord(checkString(),
          checkRef<refsType>()("AccessOptions", "expected AccessOptions object"),
        ).describe("Permissions based on local interface address.  Enter the IP Address and NetMask (`127.0.0.1/8`) as the property key. The keyword \"localhost\" (if specified) matches 127.0.0.0/8 instead of any other specified key.  Keyword \"*\" matches everything that doesn't match another IP address.  This checks the IP address each client connects to (socket.localAddress), not the bind address of the server instance that accepted the request. The keyword defaultPermission does nothing, but auto-complete should give you the defaults (assuming they haven't changed).  You can then rename it to whatever you need it to be. ")
          .defaultData({ defaultPermissions }),
      }/*  as TypeCheckItems<NonNullable<ServerConfigSchema["bindInfo"]>> */),
      authAccounts: checkRecord(checkString(), checkRef<refsType>()("AuthAccountsValue", "expected AuthAccountsValue")),
      putsaver: checkObject<ServerConfig["putsaver"], never>("", {}, putsaverOptional()).describe("Settings related to the put saver"),
      directoryIndex: checkObject<Defined<ServerConfigSchema["directoryIndex"]>>("", {
        defaultType: checkStringEnum(["html", "json"] as const)
          .describe("default format for the directory index"),
        icons: checkRecord(checkString(), checkArray(checkString()))
          .describe("Hashmap of type { \"icon_name\": [\".ext\", \"mime/type\"]} where ext represents the extensions to use this icon for. Icons are in the TiddlyServer/assets/icons folder."),
        mimetypes: checkRecord(checkString(), checkArray(checkString()))
          .describe("additional extensions to associate with mime types [\"mime/type\"]: [\"htm\", \"html\"]"),
        mixFolders: checkBoolean()
          .describe("Sort folder and files together rather than separated")
      }),
      controllers: checkAny(),
      datafolder: checkRecord(checkString(), checkAny()).describe("Options object whose properties will be passed to the tiddlywiki server instance using the spread operator. This means that if a property specifies an object (or array) instead of a primitive, the same object will be given to all instances."),
    }/*  as TypeCheckItems<ServerConfigSchema, "tree"> */)
  }
  return refs;
}


// // "ServerConfigSchema": () => checkObject<ServerConfigSchema>("", {
//     //   tree: checkRef("")
//     // })
//     "SchemaFolderElement": () => checkObject<Schema.FolderElement, "$element" | "path">(
//       "",
//       {
//         $element: checkStringEnum(["folder"] as const),
//         path: checkString()
//       }, {
//         $options: checkArray(checkRef<refsType>()("TreeOptions", "expected one of TreeOptions")),
//         noTrailingSlash: checkBoolean(),
//         noDataFolder: checkBoolean(),
//       },
//       ["$element"]
//     ),
//     "SchemaGroupElement": () => checkObject<Schema.FolderElement>(
//       "",
//       {
//         $element: checkStringEnum(["folder"] as const),
//         $options: checkArray(checkRef<refsType>()("TreeOptions", "expected one of TreeOptions")),
//         noTrailingSlash: checkBoolean(),
//         noDataFolder: checkBoolean(),
//         path: checkString(),
//         // key: checkString(),
//       },
//       undefined,
//       ["$element"]
//     ),
//     "FolderPathShorthand": () => checkString().describe("The path of a folder to mount without any extra options. The folder name will be used for the url name."),
//     "SchemaGroupChild": (): any =>
//       checkUnion(
//         checkRecord()
//         ,
//         checkUnion.cu(
//           checkObject<Schema.GroupElement, "$element" | "$children">("",
//             {
//               $element: checkStringEnum(["group"]),
//               $children: checkRef<refsType>()("SchemaGroupChild", "expected a repeat of GroupChild")
//             },
//             {
//               $options: checkArray(checkRef<refsType>()("TreeOptions", "expected one of TreeOptions")),
//               indexPath: checkString()
//             },
//             ["$element"]
//           ),
//           checkUnion(

//           )
//           checkObject<Schema.ArrayGroupElement, "$element" | "$children">("",
//             ,
//             ["$element"]
//           ),
//         )
//       ),
//       "GroupChildrenHashmap": () => checkRecord(checkStringRegex(/^[^$]+$/), checkUnion(
//         checkUnion.cu(
//           checkRef<refsType>()("GroupRecordItem", "expected a GroupRecordItem"),
//           checkRef<refsType>()("FolderRecordItem", "expected a FolderRecordItem"),
//         ),
//         checkUnion.cu(
//           checkRef<refsType>()("FolderPathShorthand", "expected a FolderPathShorthand"),
//           checkRef<refsType>()("GroupChildrenHashmap", "expected a GroupChildrenHashmap"),
//         ),
//       ))
//       // {
//       //   "type": "object",
//       //   "description": "An object with any type of mount item, using the key as the mount point. The key property of an item will be ignored.",
//       //   "patternProperties": {
//       //     "^[^$]+$": {
//       //       "anyOf": [
//       //         {
//       //           "$ref": "#/definitions/GroupRecordItem"
//       //         },
//       //         {
//       //           "$ref": "#/definitions/FolderRecordItem"
//       //         },
//       //         {
//       //           "$ref": "#/definitions/FolderPathShorthand"
//       //         },
//       //         {
//       //           "$ref": "#/definitions/GroupChildrenHashmap"
//       //         }
//       //       ]
//       //     }
//       //   },
//       //   "additionalProperties": false
//       // },
//       "GroupChildrenArray": {
//         "type": "array",
//         "items": {
//           "anyOf": [
//             {
//               "$ref": "#/definitions/GroupArrayItem"
//             },
//             {
//               "$ref": "#/definitions/FolderArrayItem"
//             },
//             {
//               "$ref": "#/definitions/FolderPathShorthand"
//             }
//           ]
//         },
//         "description": "An array of children, which must specify the key property. If folder is specified as a string, the key will be the folder name"
//       },
//       "GroupRecordItem": {
//         "type": "object",
//         "additionalProperties": false,
//         "patternProperties": {
//           "^key$": {
//             "type": "string"
//           }
//         },
//         "properties": {
//           "$element": {
//             "description": "This is a group",
//             "enum": [
//               "group"
//             ]
//           },
//           "indexPath": {
//             "type": "string"
//           },
//           "$children": {
//             "oneOf": [
//               {
//                 "$ref": "#/definitions/GroupChildrenArray"
//               },
//               {
//                 "$ref": "#/definitions/GroupChildrenHashmap"
//               }
//             ]
//           },
//           "$options": {
//             "$ref": "#/definitions/OptionsArray"
//           }
//         },
//         "required": [
//           "$children",
//           "$element"
//         ],
//         "description": "A group creates a virtual mount folder to group folders together. The $children property may be an array or object."
//       },
//       "FolderRecordItem": {
//         "type": "object",
//         "additionalProperties": false,
//         "patternProperties": {
//           "^key$": {
//             "type": "string"
//           }
//         },
//         "properties": {
//           "$element": {
//             "description": "This is a folder",
//             "enum": [
//               "folder"
//             ]
//           },
//           "path": {
//             "type": "string",
//             "description": "The folder path to mount"
//           },
//           "noDataFolder": {
//             "type": "boolean",
//             "description": "Handle data folders like regular folders. Useful for your downloads folder, for instance, in case you download a tiddlywiki.info file."
//           },
//           "noTrailingSlash": {
//             "type": "boolean",
//             "description": "Mount data folders inside this folder without a trailing slash, so that relative links start at the folder instead of the data folder. This is usually not preferred, because the folder can be referred to with two dots `../` but it can be helpful when converting single file wikis to data folders and there are a lot of interwiki links involved."
//           },
//           "$options": {
//             "$ref": "#/definitions/OptionsArray"
//           }
//         },
//         "required": [
//           "$element",
//           "path"
//         ],
//         "description": "The folder element mounts a folder"
//       },
//       "GroupArrayItem": {
//         "allOf": [
//           {
//             "$ref": "#/definitions/GenericArrayItem"
//           },
//           {
//             "$ref": "#/definitions/GroupRecordItem"
//           }
//         ]
//       },
//       "FolderArrayItem": {
//         "allOf": [
//           {
//             "$ref": "#/definitions/GenericArrayItem"
//           },
//           {
//             "$ref": "#/definitions/FolderRecordItem"
//           }
//         ]
//       },
//       "GenericArrayItem": {
//         "properties": {
//           "key": {
//             "type": "string",
//             "description": "The mount name that will show in the URL"
//           }
//         },
//         "required": [
//           "key"
//         ]
//       },
//       "FolderPathShorthand": {
//         "type": "string",
//         "description": "The path of a folder to mount without any extra options. The folder name will be used for the url name."
//       },
//       "OptionsArray": {
//         "$ref": "settings-2-2-tree-options.schema.json"
//       }
//     },