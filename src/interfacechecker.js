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
            return typeof a === "object" && (keys.filter(k => this.checkArrayValueResult(keychecker(k), errs, k, keychecker.expected ? "key " + keychecker.expected : "")
                && this.checkArrayValue(k, checker, a[k], errs)).length === keys.length) || errs;
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
    registerNotice: checkBoolean
});
const putsaverOptional = as({
    backupFolder: checkString,
    etag: checkStringEnum("optional", "required", "disabled"),
    etagAge: checkNumber,
    gzipBackups: checkBoolean
});
const checkOptions = checker.union(checker.checkObject({
    $element: checkStringEnum("auth"),
}, {
    authError: checkNumberEnum(403, 404),
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
    console.log("Check server config result: " + JSON.stringify(res, null, 2));
    return res;
}
exports.checkServerConfig = checkServerConfig;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImludGVyZmFjZWNoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxTQUFTLEVBQUUsQ0FBSSxHQUFNO0lBQ25CLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQWdCLGNBQWM7QUFFOUIsQ0FBQztBQUZELHdDQUVDO0FBQ0QsTUFBTSxVQUFVO0lBQ2QsWUFDUyxRQUFnQixFQUNoQixZQUFtQjtRQURuQixhQUFRLEdBQVIsUUFBUSxDQUFRO1FBQ2hCLGlCQUFZLEdBQVosWUFBWSxDQUFPO0lBRzVCLENBQUM7Q0FDRjtBQXFDRCxNQUFNLGNBQWM7SUFJbEI7UUFGQSxhQUFRLEdBQWUsRUFBRSxDQUFDO1FBVTFCLG9CQUFlLEdBQWlDLEVBQUUsQ0FBQztRQUVuRCx3QkFBbUIsR0FBRyxDQUFDLEdBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7UUErQi9GLGNBQVMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLEVBQWEsRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQztRQUV2RixnQkFBVyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLENBQUMsRUFBZSxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUM7UUFDeEcsb0JBQWUsR0FBRyxDQUFtQixHQUFHLE1BQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUMzRSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUNsRCxDQUFDLENBQUMsRUFBVSxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FB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