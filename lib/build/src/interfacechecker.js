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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnRlcmZhY2VjaGVja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0EsaURBQW9DO0FBRXBDLFNBQVMsT0FBTyxDQUFPLENBQUksRUFBRSxDQUFJO0lBQy9CLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLENBQUM7QUFDRCxTQUFTLEVBQUUsQ0FBYSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLElBQWtCLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFHdEYsTUFBZSxTQUFTO0lBQXhCO1FBUVUsZUFBVSxHQUFHLENBQUMsR0FBUSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQztJQXNEbEcsQ0FBQztJQXBEUSxLQUFLLENBQUMsQ0FBTTtRQUNqQixJQUFJLE1BQU0sR0FBK0IsU0FBUyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNyRixTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztRQUU1QixJQUFJLEdBQUcsR0FBWSxLQUFLLENBQUM7UUFFekIsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNYLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3RCO2FBQU0sSUFDTCxNQUFNLFlBQVksYUFBYTtZQUMvQixNQUFNLFlBQVksV0FBVztZQUM3QixNQUFNLFlBQVksVUFB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