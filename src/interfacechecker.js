"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function checkInterface() {
}
exports.checkInterface = checkInterface;
class CheckInterface {
    constructor() {
        this.errorLog = [];
        this.currentKeyArray = [];
        this.responseStringError = (err) => JSON.stringify(this.currentKeyArray) + " " + err + "\n";
        // checkNever = (a): a is never => typeof a === "undefined";
        // this.assignExpected("expected string value", (a): a is string => typeof a === "string";);
        //   this.assignExpected("expected number value", this.checkNumber);
        // this.assignExpected("expected boolean value", this.checkBoolean);
        // this.assignExpected("expected boolean true", this.checkBooleanTrue);
        // this.assignExpected("expected boolean false", this.checkBooleanFalse);
        // this.assignExpected("expected null value", this.checkNull);
        this.checkNull = this.assignProperties("expected null value", (a) => a === null);
        this.checkString = this.assignProperties("expected string value", (a) => typeof a === "string");
        this.checkStringEnum = (...values) => this.assignProperties("expected one string of " + JSON.stringify(values), (a) => typeof a === "string" && values.indexOf(a) !== -1);
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
    union(af, bf, cf) {
        return this.assignProperties([af, bf, cf].map(e => e && e.expected).join(', '), ((item) => {
            // this.currentKeyArray.push(i);
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
            if (errs.length && errs.some(e => typeof e === "string")) {
                console.log(JSON.stringify(this.currentKeyArray) + " OR \n" + errs.map((e, i) => this.checkObjectError((typeof e === "string") ? e : (e + "\n"))).join("\n"));
            }
            return typeof res === "string" ? false : res;
        }));
    }
    checkObjectError(str) {
        return str.split("\n").filter(e => !!e.trim()).map((l, j) => (j > 0 ? "   " : " - ") + l).join('\n');
    }
    // checkArrayValue: ()
    checkArray(checker) {
        let sourceLine = new Error("checkArray origin");
        return this.assignProperties("expected an array that " + checker.expected, (a) => typeof a === "object" && Array.isArray(a) && (a.filter((b, i) => {
            let res = this.checkArrayValue(i, checker, b);
            return res;
        }).length === a.length));
    }
    checkRecord(keychecker, checker) {
        let sourceLine = new Error("checkRecord origin");
        return this.assignProperties("expected a record that " + checker.expected, (a) => {
            const keys = Object.keys(a);
            return typeof a === "object" && (keys.filter(k => {
                let res = keychecker(k) && this.checkArrayValue(k, checker, a[k]);
                return res;
            }).length === keys.length);
        });
    }
    checkArrayValue(k, checker, b) {
        this.currentKeyArray.push(k);
        let res = checker(b, true);
        if (typeof res === "string")
            console.log(JSON.stringify(this.currentKeyArray) + " " + this.checkObjectError(res));
        else if (!res)
            console.log(JSON.stringify(this.currentKeyArray) + " " + typeof b);
        this.currentKeyArray.pop();
        return res;
    }
    // checkObject<T extends {}>(
    //   checkermap: { [KEY in keyof T]-?: ((b) => b is T[KEY]) },
    //   optionalcheckermap?: undefined,
    //   /** if these keys do not pass, the item is assumed to be unrelated */
    //   unionKeys?: (keyof T)[]
    // ): (a) => a is T;
    // checkObject<T extends {}, REQUIRED extends keyof T>(
    //   checkermap: { [KEY in REQUIRED]-?: ((b) => b is T[KEY]) },
    //   optionalcheckermap: { [KEY in Exclude<keyof T, keyof typeof checkermap>]-?: ((b) => b is T[KEY]) },
    //   /** if these keys do not pass, the item is assumed to be unrelated */
    //   unionKeys?: (keyof T)[]
    // ): (a) => a is T;
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
            let responseString = "";
            //make sure every key is either in required or optional
            //and every key in required is actually present
            const log = [];
            this.errorLog.push(log);
            let res = (required.filter(k => {
                let res = keys.indexOf(k) !== -1;
                log.push(this.responseStringError("required property" + k + " not found"));
                if (!res)
                    badkey = true;
                return res;
            }).length === required.length) && (keys.filter((k) => {
                this.currentKeyArray.push(k);
                const keylog = [];
                this.errorLog.push(keylog);
                let res;
                if (checkermap[k]) {
                    res = checkermap[k](a[k]);
                    if (!res && checkermap[k].expected)
                        keylog.push(this.responseStringError(checkermap[k].expected));
                    if (!res && unionKeys && unionKeys.indexOf(k) !== -1) {
                        wrongunionkey = true;
                    }
                }
                else if (optionalcheckermap[k]) {
                    res = optionalcheckermap[k](a[k]);
                    if (!res && optionalcheckermap[k].expected)
                        keylog.push(this.responseStringError(optionalcheckermap[k].expected));
                }
                else {
                    res = false;
                    keylog.push(this.responseStringError("property is unexpected"));
                    badkey = true;
                }
                log.push(...keylog);
                this.currentKeyArray.pop();
                return res;
            }).length === keys.length);
            if (badkey)
                log.unshift(this.responseStringError(expectedMessage + " but got " + JSON.stringify(Object.keys(a))));
            if (!stringError && responseString)
                console.log(log.join('\n'));
            return (!res && stringError && !wrongunionkey) ? log.join('\n') : res;
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
const checkOptions = checker.union(checker.checkObject({
    $element: checkStringEnum("auth"),
    authError: checkNumberEnum(403, 404),
    authList: checker.union(checker.checkArray(checkString), checkNull)
}, undefined, ["$element"]), checker.checkObject({
    $element: checkStringEnum("backups"),
    backupFolder: checkString,
    etagAge: checkNumber,
    gzip: checkBoolean
}, undefined, ["$element"]), checker.checkObject({
    $element: checkStringEnum("index"),
    defaultType: checker.union(checkStringEnum("html", "json"), checkNumberEnum(404, 403)),
    indexExts: checker.checkArray(checkString),
    indexFile: checker.checkArray(checkString)
}, undefined, ["$element"]));
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
exports.checkServerConfig = checker.checkObject({
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
            userSalt: checkString
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
    putsaver: checker.checkObject({
        backupDirectory: checkString,
        etag: checkStringEnum("", "required", "disabled"),
        etagWindow: checkNumber
    }),
    EXPERIMENTAL_clientside_datafolders: checker.checkObject({
        alwaysRefreshCache: checkBoolean,
        enabled: checkBoolean,
        maxAge_tw_plugins: checkNumber
    })
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImludGVyZmFjZWNoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxTQUFnQixjQUFjO0FBRTlCLENBQUM7QUFGRCx3Q0FFQztBQTJCRCxNQUFNLGNBQWM7SUFJbEI7UUFGQSxhQUFRLEdBQWUsRUFBRSxDQUFDO1FBVTFCLG9CQUFlLEdBQWlDLEVBQUUsQ0FBQztRQUNuRCx3QkFBbUIsR0FBRyxDQUFDLEdBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7UUEwQi9GLDREQUE0RDtRQUM1RCw0RkFBNEY7UUFDNUYsb0VBQW9FO1FBQ3BFLG9FQUFvRTtRQUNwRSx1RUFBdUU7UUFDdkUseUVBQXlFO1FBQ3pFLDhEQUE4RDtRQUU5RCxjQUFTLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQyxFQUFhLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDdkYsZ0JBQVcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsdUJBQXVCLEVBQUUsQ0FBQyxDQUFDLEVBQWUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDO1FBRXhHLG9CQUFlLEdBQUcsQ0FBbUIsR0FBRyxNQUFXLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FDM0UseUJBQXlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFDbEQsQ0FBQyxDQUFDLEVBQVUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFDeEUsaUJBQVksR0FBRyxJQUFJLENBQUMsZ0JB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