"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function as(obj) {
    return obj;
}
function checkInterface() {
}
exports.checkInterface = checkInterface;
class UnionError {
    constructor(expected, union_result, funcLength, showUnionNulls) {
        this.expected = expected;
        this.union_result = union_result;
        this.funcLength = funcLength;
        this.showUnionNulls = showUnionNulls;
    }
    toJSON() {
        let json = [];
        let expected = this.expected.map(e => typeof e === "string" ? e.replace(/"/gi, "'") : e);
        let result = this.union_result;
        for (let i = 0; i < this.funcLength; i++) {
            if (result[i] === null)
                continue;
            json.push(typeof result[i] === "object" ? result[i] : expected[i]);
        }
        return json;
    }
}
class CheckInterface {
    constructor(showUnionNulls) {
        this.showUnionNulls = showUnionNulls;
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
        const expectedMessage = [af, bf, cf].map(e => e && e.expected);
        const funcLength = cf ? 3 : 2;
        return this.assignProperties(expectedMessage.join(', '), ((item) => {
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
            return new UnionError(expectedMessage, errs, funcLength, this.showUnionNulls);
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
exports.CheckInterface = CheckInterface;
function checkServerConfig(obj, checker) {
    if (checker === undefined)
        checker = new CheckInterface(false);
    else if (typeof checker === "boolean")
        checker = new CheckInterface(checker);
    // let checker = new CheckInterface(showUnionNulls);
    let { checkBoolean, checkString, checkStringEnum, checkNumber, checkNumberEnum, checkBooleanFalse, checkNull } = checker;
    const checkAccessPerms = checker.checkObject({
        mkdir: checkBoolean,
        upload: checkBoolean,
        websockets: checkBoolean,
        writeErrors: checkBoolean,
        registerNotice: checkBoolean,
        putsaver: checkBoolean,
        loginlink: checkBoolean,
        transfer: checkBoolean
    });
    const putsaverOptional = as({
        backupFolder: checkString,
        etag: checkStringEnum("optional", "required", "disabled"),
        etagAge: checkNumber,
        gzipBackups: checkBoolean,
        enabled: checkBoolean
    });
    const checkOptions = checker.union(checker.checkObject({
        $element: checkStringEnum("auth")
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
        __targetTW: checkString,
        _datafoldertarget: checkString,
        _devmode: checkBoolean,
        authCookieAge: checkNumber,
        maxTransferRequests: checkNumber,
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
        putsaver: checker.checkObject({}, putsaverOptional),
        datafolder: checker.checkRecord(checker.checkString, checker.checkUnknown),
        EXPERIMENTAL_clientside_datafolders: checker.checkObject({
            alwaysRefreshCache: checkBoolean,
            enabled: checkBoolean,
            maxAge_tw_plugins: checkNumber
        })
    });
    let res = _checkServerConfig(obj);
    if (res !== true)
        debugger; //if you hit this breakpoint, it means the settings does 
    //not conform to ServerConfig and the server is about to exit. The error data is in `res`. 
    // console.log("Check server config result: " + JSON.stringify(res, null, 2));
    return res;
}
exports.checkServerConfig = checkServerConfig;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImludGVyZmFjZWNoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQSxTQUFTLEVBQUUsQ0FBSSxHQUFNO0lBQ25CLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQWdCLGNBQWM7QUFFOUIsQ0FBQztBQUZELHdDQUVDO0FBQ0QsTUFBTSxVQUFVO0lBQ2QsWUFDUyxRQUFrQixFQUNsQixZQUFtQixFQUNsQixVQUFrQixFQUNWLGNBQXVCO1FBSGhDLGFBQVEsR0FBUixRQUFRLENBQVU7UUFDbEIsaUJBQVksR0FBWixZQUFZLENBQU87UUFDbEIsZUFBVSxHQUFWLFVBQVUsQ0FBUTtRQUNWLG1CQUFjLEdBQWQsY0FBYyxDQUFTO0lBR3pDLENBQUM7SUFDRCxNQUFNO1FBQ0osSUFBSSxJQUFJLEdBQVUsRUFBRSxDQUFDO1FBQ3JCLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekYsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztRQUMvQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN4QyxJQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJO2dCQUFFLFNBQVM7WUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxD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