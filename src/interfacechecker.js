"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
function mapItem(k, v) {
    return Object.freeze([k, v]);
}
function T4(A, B, C, D) { return [A, B, C, D]; }
class TypeCheck {
    constructor() {
        this.errMessage = (err) => JSON.stringify(TypeCheck.currentKeyArray) + " " + err + "\n";
    }
    check(a) {
        let parent = TypeCheck.stack[TypeCheck.stack.length - 1];
        TypeCheck.stack.push(this);
        this.currentKey = undefined;
        let res = false;
        if (!parent) {
            res = this._check(a);
        }
        else if (parent instanceof CheckMultiple ||
            parent instanceof CheckObject ||
            parent instanceof CheckUnion) {
            let key = parent.currentKey;
            res = this._check(a);
            if (!res && typeof parent.error === "object") {
                parent.error[key] = this.error;
            }
            else if (!res) {
                throw new Error("parent.error is a string. This is a bug in one of the instanceof specified classes.");
            }
        }
        else if (parent instanceof CheckSimple) {
            throw new Error("CheckSimple instances may not call other checkers. ");
        }
        else if (parent instanceof CheckRepeat) {
            res = this._check(a);
            if (!res)
                parent.error = this.error;
        }
        else {
            throw new Error("unhandled instance " + this.toString());
        }
        TypeCheck.stack.pop();
        this.currentKey = undefined;
        return res;
    }
    static errorMessage(key) {
        switch (key) {
            case CheckObject.wrongUnionKey:
                return (co, x) => {
                    var _a;
                    return "wrong union key " + ((_a = co.unionKeys) === null || _a === void 0 ? void 0 : _a.map(k => k + ": " + x[k] + " " + co.checkermap[k].expectedMessage).join(', '));
                };
            case CheckObject.typeofNotObject:
                return (co, x) => "expected object value but got " + typeof x;
            case CheckObject.missingRequired:
                return (co, x) => (co).lastMessage;
            case CheckObject.unexpectedProperty:
                return (co, x) => co.expectedMessage + " but got " + JSON.stringify(Object.keys(x));
            default:
                return (tc, x) => tc.expectedMessage;
        }
    }
}
TypeCheck.currentKeyArray = [];
TypeCheck.stack = [];
class CheckSimple extends TypeCheck {
    constructor(expectedMessage, check) {
        super();
        this.expectedMessage = expectedMessage;
        this.error = "";
        this.currentKey = undefined;
        this._check = check;
        this.error = this.expectedMessage;
    }
}
exports.checkString = new CheckSimple("expected a string value", (a) => typeof a === "string");
exports.checkStringEnum = (...val) => new CheckSimple("expected one string of " + JSON.stringify(val), (a) => typeof a === "string" && val.indexOf(a) !== -1);
exports.checkStringNotEmpty = new CheckSimple("expected a string with non-zero length", (a) => typeof a === "string" && a.length > 0);
exports.checkNumber = new CheckSimple("expected a number value", (a) => typeof a === "number");
exports.checkNumberEnum = (...val) => new CheckSimple("expected one number of " + JSON.stringify(val), (a) => typeof a === "number" && val.indexOf(a) !== -1);
exports.checkBoolean = new CheckSimple("expected a boolean value", (a) => typeof a === "boolean");
exports.checkBooleanTrue = new CheckSimple("expected a boolean true", (a) => typeof a === "boolean" && a === true);
exports.checkBooleanFalse = new CheckSimple("expected a boolean false", (a) => typeof a === "boolean" && a === false);
exports.checkNull = new CheckSimple("expected a null value", (a) => typeof a === "object" && a === null);
exports.checkAny = new CheckSimple("expected any value", (a) => true);
class CheckMultiple extends TypeCheck {
    constructor(expectedMessage, checkObject, checkChildren) {
        super();
        this.expectedMessage = expectedMessage;
        this.checkObject = checkObject;
        this.checkChildren = checkChildren;
        this.error = {};
        this._check = (a) => {
            this.currentKey = undefined;
            this.error = {};
            let res = this.checkObject(a);
            if (!res)
                return this.error = this.expectedMessage, res;
            else
                return this.checkChildren(a, (k) => { this.currentKey = k; });
        };
    }
}
exports.CheckMultiple = CheckMultiple;
exports.checkArray = (checker) => new CheckMultiple("expected an array that " + checker.expectedMessage, (a) => typeof a === "object" && Array.isArray(a), (a, curKey) => a.filter((b, i) => { curKey(i); return checker.check(b); }).length === a.length);
exports.checkRecord = (keyChecker, checker) => new CheckMultiple("expected a record that " + checker.expectedMessage, (a) => typeof a === "object", (a, curKey) => {
    let keys = Object.keys(a);
    let arr = keys.filter((k) => {
        curKey(k);
        return keyChecker.check(k) && checker.check(a[k]);
    });
    return arr.length === keys.length;
});
class CheckUnionWrapper extends TypeCheck {
    constructor(checkerA, checkerB) {
        super();
        this.checkerA = checkerA;
        this.checkerB = checkerB;
        this.currentKey = undefined;
        this.error = {};
        this._check = (a) => {
            throw new Error("incorrect usage of CheckUnionWrapper");
        };
    }
    get expectedMessage() {
        throw new Error("incorrect usage of CheckUnionWrapper");
    }
}
class CheckUnion extends TypeCheck {
    constructor(checks) {
        super();
        this.checks = checks;
        this.currentKey = undefined;
        this.error = {};
        this.expectedMessage = "";
        this._check = (a) => {
            // this.lastResult = undefined;
            this.currentKey = undefined;
            this.error = {};
            let res = this.checks.map((e, i) => {
                this.currentKey = i;
                let res = e.check(a);
                let err = e.error;
                return [res, err];
            });
            let is = res.filter((e) => e[0]).length > 0;
            // if (!is) res.forEach((e, i) => {
            //   if (!e[0] && typeof e[1] === "string" && e[1].startsWith("wrong union key")) {
            //     console.log(this.error[i]);
            //   }
            // })
            return is;
        };
        this.expectedMessage = checks.map(e => e.expectedMessage).join(', ');
        if (this.checks.filter(e => e instanceof CheckUnion).length > 0)
            throw new Error("A checkUnion as a direct child of a checkUnion is not supported. Use checkUnion.cu to nest unions instead.");
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
function flattenWrapper(c) {
    if (c instanceof CheckUnionWrapper)
        return [...flattenWrapper(c.checkerA), ...flattenWrapper(c.checkerB)];
    else
        return [c];
}
/**
 * The error message of a union will be an array.
 * False indicates there were no errors for that branch (i.e. it passed)
 */
exports.checkUnion = (ca, cb) => {
    let checks = flattenWrapper(new CheckUnionWrapper(ca, cb)).filter((e) => !!e);
    return new CheckUnion(checks);
};
exports.checkUnion.cu = (ca, cb) => new CheckUnionWrapper(ca, cb);
class CheckObject extends TypeCheck {
    constructor(checkermap, optionalcheckermap, 
    /** if these keys do not pass, the item is assumed to be unrelated */
    unionKeys) {
        super();
        this.checkermap = checkermap;
        this.optionalcheckermap = optionalcheckermap;
        this.unionKeys = unionKeys;
        this.required = Object.keys(this.checkermap);
        this.optional = Object.keys(this.optionalcheckermap);
        this.lastResult = CheckObject.typeofNotObject;
        this.lastMessage = "";
        // public errorLog: string[][] = [];
        this.currentKey = undefined;
        this.error = {};
        this.currentKeyArray = [];
        this.expectedMessage = "expected an object with keys " + [
            ...Object.keys(checkermap).map(e => JSON.stringify(e)),
            ...Object.keys(optionalcheckermap).map(e => JSON.stringify(e) + "?")
        ].join(',');
        if (this.unionKeys)
            this.unionKeys.forEach(k => {
                if (this.required.indexOf(k) === -1)
                    throw new Error("unionKey not found in checkermap " + k);
            });
    }
    symbolError(symbol, value, missingkeys) {
        this.lastResult = symbol;
        if (missingkeys)
            this.lastMessage = "missing required keys " + missingkeys.join(',');
        this.error = symbol === CheckObject.wrongUnionKey ? undefined : TypeCheck.errorMessage(symbol)(this, value);
        return false;
    }
    _check(a) {
        this.lastResult = undefined;
        this.currentKey = undefined;
        this.lastMessage = "";
        this.error = {};
        if (typeof a !== "object")
            return this.symbolError(CheckObject.typeofNotObject, a);
        const keys = Object.keys(a);
        const checkKeys = [...this.required];
        this.optional.forEach(k => { if (checkKeys.indexOf(k) === -1)
            checkKeys.push(k); });
        let wrongunionkey = this.unionKeys && !(this.unionKeys.filter(k => {
            let res = keys.indexOf(k) !== -1 && this.checkermap[k].check(a[k]);
            return res;
        }).length === this.unionKeys.length);
        if (wrongunionkey)
            return this.symbolError(CheckObject.wrongUnionKey, a);
        //check for missing required keys and return a string error if any are missing
        let missingkeys = this.required.filter(k => keys.indexOf(k) === -1);
        if (missingkeys.length)
            return this.symbolError(CheckObject.missingRequired, a, missingkeys);
        //make sure there are no extra keys in the object
        let extraKeys = keys.filter(e => checkKeys.indexOf(e) === -1);
        if (extraKeys.length)
            return this.symbolError(CheckObject.unexpectedProperty, a);
        return (keys.filter((k) => {
            const keylog = [];
            let res = false;
            if (this.checkermap[k]) {
                this.currentKey = k;
                res = this.checkermap[k].check(a[k]);
            }
            else if (this.optionalcheckermap[k]) {
                this.currentKey = k;
                res = this.optionalcheckermap[k].check(a[k]);
            }
            else {
                this.currentKey = k;
                res = false;
                throw new Error("Something went wrong and an extra key was found. This is a bug in the interface checker.");
            }
            return res;
        }).length === keys.length);
    }
}
CheckObject.wrongUnionKey = Symbol("unrelated union key");
CheckObject.typeofNotObject = Symbol("typeof not object");
CheckObject.missingRequired = Symbol("missing required keys");
CheckObject.unexpectedProperty = Symbol("property is unexpected");
// type OptionalCheckermap<T extends { [K: string]: unknown }, REQUIRED extends string> = { [KEY in Exclude<keyof T, REQUIRED>]-?: TypeCheck<T[KEY]> };
function checkResult(e, a) {
    let union = new CheckUnion([e]);
    let res = union.check(a);
    return [res, union.error ? union.error[0] : undefined];
}
exports.checkResult = checkResult;
function checkObject(checkermap, optionalcheckermap = {}, unionKeys = []) {
    return new CheckObject(checkermap, optionalcheckermap, unionKeys);
}
exports.checkObject = checkObject;
class CheckRepeat extends TypeCheck {
    constructor(innerCheck, expectedMessage) {
        super();
        this.innerCheck = innerCheck;
        this.expectedMessage = expectedMessage;
        // public expectedMessage: string = "";
        this.error = {};
    }
    _check(a) {
        this.error = {};
        return this.innerCheck().check(a);
    }
}
/**
 * Allows recursive types to be checked. The recursive type
 * should be the result of a function so each checker will
 * be a unique instance. The callback will be called on each
 * recursion.
 */
exports.checkRepeat = (cb, expected) => new CheckRepeat(cb, expected);
// export function checkServerConfig(obj, checker: boolean): true | {};
// export function checkServerConfig(obj, checker: TypeCheck<ServerConfig>): true | {};
function checkServerConfig(obj) {
    // if(checker === undefined) checker = new CheckInterface(false);
    // else if (typeof checker === "boolean") checker = new CheckInterface(checker);
    // let checker = new CheckInterface(showUnionNulls);
    // let { checkBoolean, checkString, checkStringEnum, checkNumber, checkNumberEnum, checkBooleanFalse, checkNull } = checker;
    const checkAccessPerms = checkObject({
        mkdir: exports.checkBoolean,
        upload: exports.checkBoolean,
        websockets: exports.checkBoolean,
        writeErrors: exports.checkBoolean,
        registerNotice: exports.checkBoolean,
        putsaver: exports.checkBoolean,
        loginlink: exports.checkBoolean,
        transfer: exports.checkBoolean
    });
    const putsaverOptional = server_types_1.as({
        backupFolder: exports.checkString,
        etag: exports.checkStringEnum("optional", "required", "disabled"),
        etagAge: exports.checkNumber,
        gzipBackups: exports.checkBoolean,
        enabled: exports.checkBoolean
    });
    const checkOptions = exports.checkUnion(checkObject({
        $element: exports.checkStringEnum("auth")
    }, {
        authError: exports.checkNumberEnum(403, 404),
        authList: exports.checkUnion(exports.checkArray(exports.checkString), exports.checkNull)
    }, ["$element"]), exports.checkUnion.cu(checkObject({
        $element: exports.checkStringEnum("putsaver"),
    }, putsaverOptional, ["$element"]), checkObject({
        $element: exports.checkStringEnum("index"),
    }, {
        defaultType: exports.checkUnion(exports.checkStringEnum("html", "json"), exports.checkNumberEnum(404, 403)),
        indexExts: exports.checkArray(exports.checkString),
        indexFile: exports.checkArray(exports.checkString)
    }, ["$element"])));
    const GroupChild = () => exports.checkUnion(checkObject({
        $element: exports.checkStringEnum("folder"),
        $options: exports.checkArray(checkOptions),
        key: exports.checkString,
        noTrailingSlash: exports.checkBoolean,
        path: exports.checkString
    }, undefined, ["$element"]), checkObject({
        $element: exports.checkStringEnum("group"),
        $children: exports.checkArray(exports.checkRepeat(() => GroupChild(), "expected a repeat of GroupChild")),
        $options: exports.checkArray(checkOptions),
        key: exports.checkString,
        indexPath: exports.checkUnion(exports.checkString, exports.checkBooleanFalse),
    }, undefined, ["$element"]));
    const _checkServerConfig = checkObject({
        $schema: exports.checkString,
        __assetsDir: exports.checkString,
        __dirname: exports.checkString,
        __filename: exports.checkString,
        __targetTW: exports.checkString,
        _datafoldertarget: exports.checkString,
        _devmode: exports.checkBoolean,
        authCookieAge: exports.checkNumber,
        maxTransferRequests: exports.checkNumber,
        tree: exports.checkArray(checkObject({
            $element: exports.checkStringEnum("host"),
            $mount: GroupChild()
        })),
        authAccounts: exports.checkRecord(exports.checkString, checkObject({
            clientKeys: exports.checkRecord(exports.checkString, checkObject({
                publicKey: exports.checkString,
                cookieSalt: exports.checkStringNotEmpty
            })),
            permissions: checkAccessPerms
        })),
        bindInfo: checkObject({
            _bindLocalhost: exports.checkBoolean,
            bindAddress: exports.checkArray(exports.checkString),
            bindWildcard: exports.checkBoolean,
            enableIPv6: exports.checkBoolean,
            filterBindAddress: exports.checkBoolean,
            https: exports.checkBoolean,
            localAddressPermissions: exports.checkRecord(exports.checkString, checkAccessPerms),
            port: exports.checkNumber
        }),
        directoryIndex: checkObject({
            defaultType: exports.checkStringEnum("html", "json"),
            icons: exports.checkRecord(exports.checkString, exports.checkArray(exports.checkString)),
            mimetypes: exports.checkRecord(exports.checkString, exports.checkArray(exports.checkString)),
            mixFolders: exports.checkBoolean,
            types: exports.checkRecord(exports.checkString, exports.checkString)
        }),
        logging: checkObject({
            debugLevel: exports.checkNumber,
            logAccess: exports.checkUnion(exports.checkString, exports.checkBooleanFalse),
            logColorsToFile: exports.checkBoolean,
            logError: exports.checkString,
            logToConsoleAlso: exports.checkBoolean
        }),
        putsaver: checkObject({}, putsaverOptional),
        datafolder: exports.checkRecord(exports.checkString, exports.checkAny),
    });
    let [res, errHash] = checkResult(_checkServerConfig, obj);
    // if (res !== true) console.log(errHash); //if you hit this breakpoint, it means the settings does 
    //not conform to ServerConfig and the server is about to exit. The error data is in `res`. 
    // console.log("Check server config result: " + JSON.stringify(res, null, 2));
    return [res, errHash];
}
exports.checkServerConfig = checkServerConfig;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImludGVyZmFjZWNoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxpREFBb0M7QUFFcEMsU0FBUyxPQUFPLENBQU8sQ0FBSSxFQUFFLENBQUk7SUFDL0IsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkMsQ0FBQztBQUNELFNBQVMsRUFBRSxDQUFhLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksSUFBa0IsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUd0RixNQUFlLFNBQVM7SUFBeEI7UUFRVSxlQUFVLEdBQUcsQ0FBQyxHQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDO0lBc0RsRyxDQUFDO0lBcERRLEtBQUssQ0FBQyxDQUFNO1FBQ2pCLElBQUksTUFBTSxHQUErQixTQUFTLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3JGLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBRTVCLElBQUksR0FBRyxHQUFZLEtBQUssQ0FBQztRQUV6QixJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDdEI7YUFBTSxJQUNMLE1BQU0sWUFBWSxhQUFhO1lBQy9CLE1BQU0sWUFBWSxXQUFXO1lBQzdCLE1BQU0sWUFBWSxVQUFVLEVBQzVCO1lB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