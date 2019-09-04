"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function as(obj) {
    return obj;
}
function checkInterface() {
}
exports.checkInterface = checkInterface;
class UnionError {
    constructor(expected, union_result) {
        this.expected = expected;
        this.union_result = union_result;
    }
}
class CheckInterface {
    constructor() {
        this.errorLog = [];
        this.currentKeyArray = [];
        this.responseStringError = (err) => JSON.stringify(this.currentKeyArray) + " " + err + "\n";
        this.checkNull = this.assignProperties("expected null value", (a) => a === null);
        this.checkUnknown = this.assignProperties("expected unknown value", (a) => true);
        this.checkString = this.assignProperties("expected string value", (a) => typeof a === "string");
        this.checkStringEnum = (...values) => this.assignProperties("expected one string of " + JSON.stringify(values), (a) => typeof a === "string" && values.indexOf(a) !== -1);
        this.checkStringNotEmpty = this.assignProperties("expected string with length more than 0", (a) => typeof a === "string" && a.length > 0);
        this.checkBoolean = this.assignProperties("", (a) => typeof a === "boolean");
        this.checkBooleanTrue = this.assignProperties("", (a) => typeof a === "boolean" && a === true);
        this.checkBooleanFalse = this.assignProperties("", (a) => typeof a === "boolean" && a === false);
        this.checkNumber = this.assignProperties("", (a) => typeof a === "number");
        this.checkNumberEnum = (...values) => this.assignProperties("expected one number of " + JSON.stringify(values), (a) => typeof a === "number" && values.indexOf(a) !== -1);
    }
    assignProperties(message, func) {
        func.expected = message;
        return func;
    }
    get currentKey() { return this.currentKeyArray[this.currentKeyArray.length - 1]; }
    union(af, bf, cf) {
        const expectedMessage = [af, bf, cf].map(e => e && e.expected).join(', ');
        return this.assignProperties(expectedMessage, ((item) => {
            let errs = [];
            let res;
            if ((res = af(item, true)) === true)
                return true;
            errs.push(res);
            if ((res = bf(item, true)) === true)
                return true;
            errs.push(res);
            if (!!cf && (res = cf(item, true)) === true)
                return true;
            if (!!cf)
                errs.push(res);
            return new UnionError(expectedMessage, errs);
        }));
    }
    checkObjectError(str) {
        return str.split("\n").filter(e => !!e.trim()).map((l, j) => (j > 0 ? "   " : " - ") + l).join('\n');
    }
    /**
     * @returns {object} object: A hashmap of the errors for any values that don't validate.
     * @returns {false} false: The item typeof is not "object" or Array.isArray returns false.
     * @returns {true} true: All values are valid
     */
    checkArray(checker) {
        return this.assignProperties("expected an array that " + checker.expected, (a) => {
            if (typeof a !== "object" || !Array.isArray(a))
                return false;
            const errs = {};
            return (a.filter((b, i) => this.checkArrayValue(i, checker, b, errs)).length === a.length) || errs;
        });
    }
    /**
     * @returns {object} object: A hashmap of the errors for any properties that don't validate.
     * @returns {false} false: The item typeof is not "object"
     * @returns {true} true: All properties are valid
     */
    checkRecord(keychecker, checker) {
        return this.assignProperties("expected a record that " + checker.expected, (a) => {
            const keys = Object.keys(a);
            const errs = {};
            let res = typeof a === "object";
            res = keys.filter(k => this.checkArrayValueResult(keychecker(k), errs, k, keychecker.expected ? "key " + keychecker.expected : "") && this.checkArrayValue(k, checker, a[k], errs)).length === keys.length;
            return res || errs;
        });
    }
    checkArrayValue(k, checker, b, errs) {
        this.currentKeyArray.push(k);
        let res = checker(b);
        res = this.checkArrayValueResult(res, errs, k, checker.expected);
        this.currentKeyArray.pop();
        return res;
    }
    checkArrayValueResult(res, errs, k, expected) {
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
    checkObject(checkermap, optionalcheckermap = {}, 
    /** if these keys do not pass, the item is assumed to be unrelated */
    unionKeys) {
        // type t = Exclude
        const required = Object.keys(checkermap);
        const optional = Object.keys(optionalcheckermap);
        // let sourceLine = new Error("checkObject origin");
        let expectedMessage = "expected an object with keys " + [
            ...Object.keys(checkermap).map(e => JSON.stringify(e)),
            ...Object.keys(optionalcheckermap).map(e => JSON.stringify(e) + "?")
        ].join(',');
        if (unionKeys)
            unionKeys.forEach(k => {
                if (required.indexOf(k) === -1)
                    throw new Error("unionKey not found in checkermap " + k);
            });
        return this.assignProperties(expectedMessage, (a, stringError = false) => {
            if (typeof a !== "object")
                return false;
            const keys = Object.keys(a);
            const checkOrder = [...required];
            optional.forEach(k => { if (checkOrder.indexOf(k) === -1)
                checkOrder.push(k); });
            let badkey = false;
            //check if any union keys don't validate
            let wrongunionkey = unionKeys && !(unionKeys.filter(k => 
            //union keys are already in the checkermap
            //so we only need to make sure the object has the key before checking it
            keys.indexOf(k) !== -1 && checkermap[k](a[k])).length === unionKeys.length);
            if (wrongunionkey) {
                //don't log anything because something else is probably taking care of it
                return null;
            }
            //check for missing required keys and return a string error if any are missing
            let missingkeys = required.filter(k => keys.indexOf(k) === -1);
            if (missingkeys.length)
                return this.responseStringError("missing required keys " + missingkeys.join(','));
            const log = [];
            this.errorLog.push(log);
            let errs = {};
            let res = (keys.filter((k) => {
                this.currentKeyArray.push(k);
                const keylog = [];
                // this.errorLog.push(keylog);
                let res;
                if (checkermap[k]) {
                    res = checkermap[k](a[k]);
                    if (typeof res === "object" && res !== null || typeof res === "string") {
                        // we have an error hashmap or string
                        errs[k] = res;
                        res = false;
                    }
                    else if (!res && checkermap[k].expected) {
                        keylog.push(this.responseStringError(checkermap[k].expected));
                        errs[k] = checkermap[k].expected;
                    }
                }
                else if (optionalcheckermap[k]) {
                    res = optionalcheckermap[k](a[k]);
                    if (typeof res === "object" && res !== null || typeof res === "string") {
                        // we have an error hashmap or string
                        errs[k] = res;
                        res = false;
                    }
                    else if (!res && optionalcheckermap[k].expected) {
                        keylog.push(this.responseStringError(optionalcheckermap[k].expected));
                        errs[k] = optionalcheckermap[k].expected;
                    }
                }
                else {
                    res = false;
                    keylog.push(this.responseStringError("property is unexpected"));
                    errs[k] = "property is unexpected";
                    badkey = true;
                }
                log.push(...keylog);
                this.currentKeyArray.pop();
                return res;
            }).length === keys.length);
            if (badkey)
                log.unshift(this.responseStringError(expectedMessage + " but got " + JSON.stringify(Object.keys(a))));
            // console.log(log.join('\n'));
            return (!res) ? errs : res;
        });
    }
}
let checker = new CheckInterface();
let { checkBoolean, checkString, checkStringEnum, checkNumber, checkNumberEnum, checkBooleanFalse, checkNull } = checker;
const checkAccessPerms = checker.checkObject({
    mkdir: checkBoolean,
    upload: checkBoolean,
    websockets: checkBoolean,
    writeErrors: checkBoolean,
    registerNotice: checkBoolean,
    putsaver: checkBoolean
});
const putsaverOptional = as({
    backupFolder: checkString,
    etag: checkStringEnum("optional", "required", "disabled"),
    etagAge: checkNumber,
    gzipBackups: checkBoolean
});
const checkOptions = checker.union(checker.checkObject({
    $element: checkStringEnum("auth")
}, {
    authError: checkNumberEnum(403, 404, 302),
    authList: checker.union(checker.checkArray(checkString), checkNull)
}, ["$element"]), checker.checkObject({
    $element: checkStringEnum("putsaver"),
}, putsaverOptional, ["$element"]), checker.checkObject({
    $element: checkStringEnum("index"),
}, {
    defaultType: checker.union(checkStringEnum("html", "json"), checkNumberEnum(404, 403)),
    indexExts: checker.checkArray(checkString),
    indexFile: checker.checkArray(checkString)
}, ["$element"]));
const GroupChild = checker.union(checker.checkObject({
    $element: checkStringEnum("folder"),
    $options: checker.checkArray(checkOptions),
    key: checkString,
    noTrailingSlash: checkBoolean,
    path: checkString
}, undefined, ["$element"]), checker.checkObject({
    $element: checkStringEnum("group"),
    $children: checker.checkArray(checker.assignProperties("expected GroupChild", (b) => GroupChild(b))),
    $options: checker.checkArray(checkOptions),
    key: checkString,
    indexPath: checker.union(checkString, checkBooleanFalse),
}, undefined, ["$element"]));
const _checkServerConfig = checker.checkObject({
    $schema: checkString,
    __assetsDir: checkString,
    __dirname: checkString,
    __filename: checkString,
    _datafoldertarget: checkString,
    _devmode: checkBoolean,
    authCookieAge: checkNumber,
    tree: checker.checkArray(checker.checkObject({
        $element: checkStringEnum("host"),
        $mount: GroupChild
    })),
    authAccounts: checker.checkRecord(checkString, checker.checkObject({
        clientKeys: checker.checkRecord(checkString, checker.checkObject({
            publicKey: checkString,
            cookieSalt: checker.checkStringNotEmpty
        })),
        permissions: checkAccessPerms
    })),
    bindInfo: checker.checkObject({
        _bindLocalhost: checkBoolean,
        bindAddress: checker.checkArray(checkString),
        bindWildcard: checkBoolean,
        enableIPv6: checkBoolean,
        filterBindAddress: checkBoolean,
        https: checkBoolean,
        localAddressPermissions: checker.checkRecord(checkString, checkAccessPerms),
        port: checkNumber
    }),
    directoryIndex: checker.checkObject({
        defaultType: checkStringEnum("html", "json"),
        icons: checker.checkRecord(checkString, checker.checkArray(checkString)),
        mimetypes: checker.checkRecord(checkString, checker.checkArray(checkString)),
        mixFolders: checkBoolean,
        types: checker.checkRecord(checkString, checkString)
    }),
    logging: checker.checkObject({
        debugLevel: checkNumber,
        logAccess: checker.union(checkString, checkBooleanFalse),
        logColorsToFile: checkBoolean,
        logError: checkString,
        logToConsoleAlso: checkBoolean
    }),
    putsaver: checker.union(checker.checkObject({}, putsaverOptional), checker.checkBooleanFalse),
    datafolder: checker.checkRecord(checker.checkString, checker.checkUnknown),
    EXPERIMENTAL_clientside_datafolders: checker.checkObject({
        alwaysRefreshCache: checkBoolean,
        enabled: checkBoolean,
        maxAge_tw_plugins: checkNumber
    })
});
function checkServerConfig(obj) {
    let res = _checkServerConfig(obj);
    if (res !== true)
        debugger; //if you hit this breakpoint, it means the settings does 
    //not conform to ServerConfig and the server is about to exit. The error data is in `res`. 
    // console.log("Check server config result: " + JSON.stringify(res, null, 2));
    return res;
}
exports.checkServerConfig = checkServerConfig;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImludGVyZmFjZWNoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxTQUFTLEVBQUUsQ0FBSSxHQUFNO0lBQ25CLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQWdCLGNBQWM7QUFFOUIsQ0FBQztBQUZELHdDQUVDO0FBQ0QsTUFBTSxVQUFVO0lBQ2QsWUFDUyxRQUFnQixFQUNoQixZQUFtQjtRQURuQixhQUFRLEdBQVIsUUFBUSxDQUFRO1FBQ2hCLGlCQUFZLEdBQVosWUFBWSxDQUFPO0lBRzVCLENBQUM7Q0FDRjtBQXNDRCxNQUFNLGNBQWM7SUFJbEI7UUFGQSxhQUFRLEdBQWUsRUFBRSxDQUFDO1FBVTFCLG9CQUFlLEdBQWlDLEVBQUUsQ0FBQztRQUVuRCx3QkFBbUIsR0FBRyxDQUFDLEdBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7UUErQi9GLGNBQVMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLEVBQWEsRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQztRQUN2RixpQkFBWSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUMsRUFBZ0IsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFGLGdCQUFXLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHVCQUF1QixFQUFFLENBQUMsQ0FBQyxFQUFlLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQztRQUN4RyxvQkFBZSxHQUFHLENBQW1CLEdBQUcsTUFBVyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQzNFLHlCQUF5QixHQUFHLElB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