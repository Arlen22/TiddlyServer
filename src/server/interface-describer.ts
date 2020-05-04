import {
  Schema,
  Config,
  ServerConfigSchema,
  ServerConfig_AccessOptions,
  ServerConfig_PutSaver,
  ServerConfig_Controller,
} from "./server-config";

type RefKeys =
  | "#/definitions/GroupChild"
  | "#/definitions/TreeOptions"
  | "#/definitions/AccessOptions"
  ;

abstract class SD<V extends any> {
  public abstract type: string
  public abstract val: V
  public abstract exportSchema(): any;
}
class sdRecord<V> extends SD<{ [K in string]: V }> {
  public type: "record" = "record";
  public val: { [K in string]: V };
  constructor(
    public description: string,
    public children: SD<V>
  ) {
    super();
  }
  exportSchema() {
    return {
      "description": this.description || undefined,
      "additionalProperties": this.children.exportSchema(),
      "type": "object"
    }
  }
}
class sdArray<V> extends SD<V[]> {
  public type: "array" = "array";
  public val: V[];
  constructor(
    public description: string,
    public children: SD<V>
  ) {
    super();
  }
  exportSchema() {
    return {
      "description": this.description || undefined,
      "items": this.children.exportSchema(),
      "type": "array"
    }
  }

}

class sdObject<V> extends SD<V> {
  //{ [K in keyof V]-?: Exact<V, SD<NonNullable<V[K]>>> }
  public type: "object" = "object"
  public val: V;
  // public children: { [K in keyof V]-?: SD<NonNullable<V[K]>> }
  constructor(
    public description: string,
    private _children: { [K in keyof V]-?: SD<NonNullable<V[K]>> },
    private _required: ({ [K in keyof V]: V[K] extends undefined ? never : K }[keyof V])[]
  ) {
    super();
  }
  exportSchema() {
    let required = this._required;
    let type = this.type;
    let description = this.description || undefined;
    let properties, additionalProperties: boolean;
    if (this._children) {
      properties = {} as { [K in keyof V]: any };
      Object.keys(this._children).forEach((k) => {
        properties[k] = this._children[k as keyof V].exportSchema();
      });
      additionalProperties = false;
    } else {
      properties = undefined;
      additionalProperties = true;
    }
    return { additionalProperties, description, properties, required, type };
  }
}
type TypeMap = {
  "string": string,
  "boolean": boolean,
  "number": number,
  "symbol": symbol
}


class sdSimple<K extends keyof TypeMap, V extends TypeMap[K]> extends SD<V> {
  public val: V;
  public enumValues: V[]
  constructor(
    public description: string,
    public type: K,
    ...[enumValues = []]:
      TypeMap[K] extends V ? [] : [V[]]
  ) {
    super();
    this.enumValues = enumValues;
  }
  exportSchema() {
    return {
      "type": this.type,
      "description": this.description
    }
  }
}

type test<T> = T extends true ? any : never;
type t = test<boolean>;
class SDref<V> extends SD<V> {
  public val: V;
  public type: "ref" = "ref";
  constructor(public ref: string) {
    super();
  }
  exportSchema() {
    return {
      "$ref": this.ref
    }
  }
}
class SDanyof<V> extends SD<V> {
  public val: V;
  public type: "anyof" = "anyof";
  constructor(public description: string, public items: SD<any>[]) {
    super();
  }
  exportSchema() {
    return {
      "anyof": this.items.map(e => e.exportSchema())
    }
  }
}
type Options = Config.Options_Auth | Config.Options_Putsaver | Config.Options_Index;
const refs = {
  "#/definitions/GroupChild": GroupChildRef(),
  "#/definitions/TreeOptions": TreeOptionsRef(),
  "#/definitions/AccessOptions": new sdObject<ServerConfig_AccessOptions>("", {
    datafolder: new sdSimple("", "boolean"),
    loginlink: new sdSimple("", "boolean"),
    mkdir: new sdSimple("", "boolean"),
    putsaver: new sdSimple("", "boolean"),
    registerNotice: new sdSimple("", "boolean"),
    transfer: new sdSimple("", "boolean"),
    upload: new sdSimple("", "boolean"),
    websockets: new sdSimple("", "boolean"),
    writeErrors: new sdSimple("", "boolean")
  }, [
    "datafolder",
    "loginlink",
    "mkdir",
    "putsaver",
    "registerNotice",
    "transfer",
    "upload",
    "websockets",
    "writeErrors"
  ]),
  "#/definitions/PutSaver": new sdObject<ServerConfigSchema["putsaver"]>("", PutSaverOptions(), [])
}
function PutSaverOptions(): sdObject<ServerConfigSchema["putsaver"]>["_children"] {
  return {
    backupFolder: new sdSimple("", "string"),
    enabled: new sdSimple("", "boolean"),
    etag: new sdSimple("", "string", ["required", "disabled", "optional"]),
    etagAge: new sdSimple("", "number"),
    gzipBackups: new sdSimple("", "boolean")
  };
}
type Children<V extends {}> = { [K in keyof V]-?: SD<NonNullable<V[K]>> }
function TreeOptionsRef() {
  // const test = anyof("",
  //   new SDsimple("string", "", ["html", "json"]),
  //   new SDsimple("number", "", [403, 404]),
  // );
  // const index = ;
  return new sdArray<Options>("", anyof("",
    new sdObject<Config.Options_Auth>("", {
      $element: new sdSimple("", "string", ["auth"]),
      authError: new sdSimple("", "number", [403, 404]),
      authList: new sdArray("", new sdSimple("", "string"))
    }, ["$element"]),
    new sdObject<Config.Options_Putsaver>("", {
      $element: new sdSimple("", "string", ["putsaver"]),
      ...PutSaverOptions()
    }, ["$element"]),
    new sdObject<Config.Options_Index>("", {
      $element: new sdSimple("", "string", ["index"]),
      defaultType: anyof("",
        new sdSimple("", "string", ["html", "json"]),
        new sdSimple("", "number", [403, 404]),
      ),
      indexExts: new sdArray("", new sdSimple("", "string")),
      indexFile: new sdArray("", new sdSimple("", "string"))
    }, ["$element"])
  ));
}

type ValidateShape<T, Shape> =
  T extends Shape
  ? Exclude<keyof T, keyof Shape> extends never ? T : never
  : never;

type Exact<T, Union> = T extends Union ? Union extends T ? T : never : never;

declare function ref<K extends keyof typeof refs>(key: K): typeof refs[K];

function GroupChildRef(): SD<Schema.GroupChildElements> {
  type V = Schema.GroupChildElements;
  const $element = new sdSimple("", "string");
  const group: sdObject<Schema.GroupElement>["_children"] = {
    $element: new sdSimple("", "string", ["group"]),
    $options: ref("#/definitions/TreeOptions"),
    $children: ref("#/definitions/GroupChild"),
    indexPath: new sdSimple("", "string")
  };
  const folder: sdObject<Schema.FolderElement>["_children"] = {
    $element: new sdSimple("", "string", ["folder"]),
    $options: ref("#/definitions/TreeOptions"),
    path: new sdSimple("", "string"),
    noDataFolder: new sdSimple("", "boolean"),
    noTrailingSlash: new sdSimple("", "boolean")
  };
  const key = new sdSimple("", "string");
  return anyof("",
    new sdRecord<any>("", anyof("",
      new sdSimple("", "string"),
      new sdObject<Schema.GroupElement>("", group, ["$element"]),
      new sdObject<Schema.FolderElement>("", folder, ["$element", "path"])
    )),
    new sdArray<Schema.ArrayGroupElement | Schema.ArrayFolderElement | string>("", anyof("",
      new sdSimple("", "string"),
      new sdObject<Schema.ArrayGroupElement>("", { ...group, key }, ["$element", "key"]),
      new sdObject<Schema.ArrayFolderElement>("", { ...folder, key }, ["$element", "path"])
    )));
}

function anyof<A, B>(description: string, a: SD<A>, b: SD<B>): SD<A | B>;
function anyof<A, B, C>(description: string, a: SD<A>, b: SD<B>, c: SD<C>): SD<A | B | C>;
function anyof(description: string, ...t: SD<any>[]) {
  return new SDanyof(description, t);
}

const description = new sdObject<ServerConfigSchema>(
  "",
  {
    $schema: new sdSimple(`The JSON schema location for this document. This schema is generated directly from the TypeScript interfaces used in TiddlyServer. A text-editor with autocomplete, such as VS code, will make editing this file much simpler. Most fields include a description like this one. All relative paths in this file are resolved relative to this file, so \`./settings-tree.xml\` refers to an XML file in the same folder as this file. All relative paths in included files (such as the XML file) are resolved relative to the included file.`, "string"),
    _datafolderclient: new sdSimple("", "string"),
    _datafolderserver: new sdSimple("", "string"),
    _datafoldertarget: new sdSimple("", "string"),
    _devmode: new sdSimple("", "boolean"),
    tree: ref("#/definitions/GroupChild") as any,
    authAccounts: new sdRecord("", new sdObject("", {
      clientKeys: new sdRecord("", new sdObject("", {
        publicKey: new sdSimple("", "string"),
        cookieSalt: new sdSimple("", "string"),
      }, ["publicKey", "cookieSalt"])),
      permissions: ref("#/definitions/AccessOptions")
    }, ["clientKeys", "permissions"])),
    bindInfo: new sdObject("", {
      port: new sdSimple("", "number"),
      bindAddress: new sdArray("", new sdSimple("", "string")),
      bindWildcard: new sdSimple("", "boolean"),
      enableIPv6: new sdSimple("", "boolean"),
      filterBindAddress: new sdSimple("", "boolean"),
      https: new sdSimple("", "string"),
      localAddressPermissions: new sdRecord("", ref("#/definitions/AccessOptions")),
      _bindLocalhost: new sdSimple("", "boolean"),
    }, []),
    controllers: new sdArray("", new sdObject<ServerConfig_Controller>("", {
      publicKey: new sdSimple("", "string"),
      allowRestart: new sdSimple("", "boolean"),
      allowSave: new sdSimple("", "boolean"),
      permissions: anyof(
        "",
        ref("#/definitions/AccessOptions"),
        new sdSimple<"boolean", false>("", "boolean", [false])
      )
    }, ["publicKey", "permissions"])),
    datafolder: new sdObject("", null, []),
    directoryIndex: new sdObject("", {
      defaultType: new sdSimple("", "string", ["html", "json"]),
      icons: new sdRecord("", new sdArray("", new sdSimple("", "string"))),
      mimetypes: new sdRecord("", new sdArray("", new sdSimple("", "string"))),
      mixFolders: new sdSimple("", "boolean")
    }, []),
    putsaver: new sdObject("", PutSaverOptions(), []),
    authCookieAge: new sdSimple("", "number"),
    maxTransferRequests: new sdSimple("", "number"),
    debugLevel: new sdSimple("", "number")
  },
  ["tree", "bindInfo", "$schema"]
)
    // logging: new sdObject("", {
      // debugLevel: new sdSimple( "","number"),
      // logAccess: anyof("",
        // new sdSimple( "","string"),
        // new sdSimple( "","boolean", [false])
      // ),
      // logColorsToFile: new sdSimple( "","boolean"),
      // logError: new sdSimple( "","string"),
      // logToConsoleAlso: new sdSimple( "","boolean")
    // }),