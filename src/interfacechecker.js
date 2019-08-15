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
            // const required = Object.keys(checkermap);
            const checkOrder = [...required];
            // const optional = Object.keys(optionalcheckermap);
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