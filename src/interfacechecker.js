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
            if (!res)
                parent.errHash[key] = this.errHash;
        }
        else if (parent instanceof CheckSimple) {
            throw new Error("CheckSimple instances may not call other checkers. ");
        }
        else if (parent instanceof CheckRepeat) {
            res = this._check(a);
            if (!res)
                parent.errHash = this.errHash;
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
                return (co, x) => "wrong union key";
            case CheckObject.typeofNotObject:
                return (co, x) => "expected object value";
            case CheckObject.missingRequired:
                return (co, x) => co.lastMessage;
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
        this.errHash = "";
        this.currentKey = undefined;
        this._check = check;
        this.errHash = this.expectedMessage;
    }
}
exports.checkString = new CheckSimple("expected string value", (a) => typeof a === "string");
exports.checkStringEnum = (...val) => new CheckSimple("expected one string of " + JSON.stringify(val), (a) => typeof a === "string" && val.indexOf(a) !== -1);
exports.checkStringNotEmpty = new CheckSimple("expected string with non-zero length", (a) => typeof a === "string" && a.length > 0);
exports.checkNumber = new CheckSimple("expected number value", (a) => typeof a === "number");
exports.checkNumberEnum = (...val) => new CheckSimple("expected one number of " + JSON.stringify(val), (a) => typeof a === "number" && val.indexOf(a) !== -1);
exports.checkBoolean = new CheckSimple("expected boolean value", (a) => typeof a === "boolean");
exports.checkBooleanTrue = new CheckSimple("expected boolean true", (a) => typeof a === "boolean" && a === true);
exports.checkBooleanFalse = new CheckSimple("expected boolean false", (a) => typeof a === "boolean" && a === false);
exports.checkNull = new CheckSimple("expected null value", (a) => typeof a === "object" && a === null);
exports.checkUnknown = new CheckSimple("expected unknown value", (a) => true);
class CheckMultiple extends TypeCheck {
    constructor(expectedMessage, checkObject) {
        super();
        this.expectedMessage = expectedMessage;
        this.checkObject = checkObject;
        this.errHash = {};
        this._check = (a) => {
            return this.checkObject(a, (k) => { this.currentKey = k; });
        };
    }
}
exports.CheckMultiple = CheckMultiple;
exports.checkArray = (checker) => new CheckMultiple("expected an array that " + checker.expectedMessage, (a, curKey) => {
    if (typeof a !== "object" || !Array.isArray(a))
        return false;
    return (a.filter((b, i) => { curKey(i); return checker.check(b); }).length === a.length);
});
exports.checkRecord = (keyChecker, checker) => new CheckMultiple("expected a record that " + checker.expectedMessage, (a, curKey) => {
    if (typeof a !== "object")
        return false;
    return (Object.keys(a).filter((k) => {
        curKey(k);
        return keyChecker.check(k) && checker.check(a[k]);
    }).length === a.length);
});
class CheckUnionWrapper extends TypeCheck {
    constructor(checkerA, checkerB) {
        super();
        this.checkerA = checkerA;
        this.checkerB = checkerB;
        this.currentKey = undefined;
        this.errHash = {};
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
        this.errHash = {};
        this.expectedMessage = "";
        this._check = (a) => {
            this.errHash = {};
            let res = this.checks.map((e, i) => {
                this.currentKey = i;
                let [, is, msg, hash] = (() => {
                    if (e instanceof CheckSimple)
                        return T4(e, e.check(a), e.expectedMessage, e.errHash);
                    if (e instanceof CheckMultiple)
                        return T4(e, e.check(a), e.expectedMessage, e.errHash);
                    if (e instanceof CheckObject)
                        return T4(e, e.check(a), objectMessage(e, a), e.lastResult || e.errHash);
                    return T4(e, e.check(a), e.expectedMessage, e.errHash);
                })();
                return T4(e, is, msg, hash);
            });
            let errs = res.map(([e, is, msg, hash]) => {
                if (is)
                    return false;
                if (typeof hash === "symbol") {
                    // if(hash === CheckObject.wrongUnionKey) re;
                    return TypeCheck.errorMessage(hash)(e, a);
                }
                else {
                    return hash;
                }
            });
            this.errHash = errs;
            return res.filter(([e, is, msg, hash]) => {
                return is;
            }).length > 0;
        };
        this.expectedMessage = checks.map(e => e.expectedMessage).join(', ');
        if (this.checks.filter(e => e instanceof CheckUnion).length > 0)
            throw new Error("A checkUnion as a direct child of a checkUnion is not supported. Use checkUnion.cu to nest unions instead.");
    }
}
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
        this.errorLog = [];
        this.currentKey = undefined;
        this.errHash = {};
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
    _check(a) {
        this.lastResult = undefined;
        this.currentKey = undefined;
        this.errHash = {};
        if (typeof a !== "object") {
            this.lastResult = CheckObject.typeofNotObject;
            return false;
        }
        const keys = Object.keys(a);
        const checkKeys = [...this.required];
        this.optional.forEach(k => { if (checkKeys.indexOf(k) === -1)
            checkKeys.push(k); });
        let wrongunionkey = this.unionKeys && !(this.unionKeys.filter(k => keys.indexOf(k) !== -1 && this.checkermap[k].check(a[k])).length === this.unionKeys.length);
        if (wrongunionkey) {
            this.lastResult = CheckObject.wrongUnionKey;
            return false;
        }
        //check for missing required keys and return a string error if any are missing
        let missingkeys = this.required.filter(k => keys.indexOf(k) === -1);
        if (missingkeys.length) {
            this.lastResult = CheckObject.missingRequired;
            this.lastMessage = "missing required keys " + missingkeys.join(',');
            return false;
        }
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
                this.lastResult = CheckObject.unexpectedProperty;
                res = false;
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
    return [res, union.errHash[0]];
}
exports.checkResult = checkResult;
function objectMessage(e, a) {
    return e.lastResult ? CheckObject.errorMessage(e.lastResult)(e, a) : e.expectedMessage;
}
function checkObject(checkermap, optionalcheckermap = {}, unionKeys = []) {
    return new CheckObject(checkermap, optionalcheckermap, unionKeys);
}
exports.checkObject = checkObject;
class CheckRepeat extends TypeCheck {
    constructor(innerCheck) {
        super();
        this.innerCheck = innerCheck;
        this.expectedMessage = "";
        this.errHash = {};
    }
    _check(a) {
        return this.innerCheck().check(a);
    }
}
exports.checkRepeat = (cb) => new CheckRepeat(cb);
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
    const GroupChild = exports.checkUnion(checkObject({
        $element: exports.checkStringEnum("folder"),
        $options: exports.checkArray(checkOptions),
        key: exports.checkString,
        noTrailingSlash: exports.checkBoolean,
        path: exports.checkString
    }, undefined, ["$element"]), checkObject({
        $element: exports.checkStringEnum("group"),
        $children: exports.checkArray(exports.checkRepeat(() => GroupChild)),
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
            $mount: GroupChild
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
        datafolder: exports.checkRecord(exports.checkString, exports.checkUnknown),
    });
    let [res, errHash] = checkResult(_checkServerConfig, obj);
    if (res !== true)
        console.log(errHash); //if you hit this breakpoint, it means the settings does 
    //not conform to ServerConfig and the server is about to exit. The error data is in `res`. 
    // console.log("Check server config result: " + JSON.stringify(res, null, 2));
    return [res, errHash];
}
exports.checkServerConfig = checkServerConfig;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImludGVyZmFjZWNoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxpREFBb0M7QUFFcEMsU0FBUyxPQUFPLENBQU8sQ0FBSSxFQUFFLENBQUk7SUFDL0IsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkMsQ0FBQztBQUNELFNBQVMsRUFBRSxDQUFhLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksSUFBa0IsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUd0RixNQUFlLFNBQVM7SUFBeEI7UUFRVSxlQUFVLEdBQUcsQ0FBQyxHQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDO0lBNkNsRyxDQUFDO0lBM0NRLEtBQUssQ0FBQyxDQUFNO1FBQ2pCLElBQUksTUFBTSxHQUErQixTQUFTLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3JGLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBRTVCLElBQUksR0FBRyxHQUFZLEtBQUssQ0FBQztRQUV6QixJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDdEI7YUFBTSxJQUNMLE1BQU0sWUFBWSxhQUFhO1lBQy9CLE1BQU0sWUFBWSxXQUFXO1lBQzdCLE1BQU0sWUFBWSxVQUFVLEVBQzVCO1lB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