"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function checkInterface() {
}
exports.checkInterface = checkInterface;
class CheckInterface {
    constructor() {
        this.currentKeyArray = [];
        this.checkNever = (a) => typeof a === "undefined";
        this.checkNull = (a) => a === null;
        this.checkString = (a) => typeof a === "string";
        this.checkStringEnum = (...values) => this.assignExpected("expected one string of " + JSON.stringify(values), (a) => typeof a === "string" && values.indexOf(a) !== -1);
        this.checkBoolean = (a) => typeof a === "boolean";
        this.checkBooleanTrue = (a) => typeof a === "boolean" && a === true;
        this.checkBooleanFalse = (a) => typeof a === "boolean" && a === false;
        this.checkNumber = (a) => typeof a === "number";
        this.checkNumberEnum = (...values) => this.assignExpected("expected one number of " + JSON.stringify(values), (a) => typeof a === "number" && values.indexOf(a) !== -1);
        this.checkString.expected = "expected string value";
        this.checkNumber.expected = "expected number value";
        this.checkBoolean.expected = "expected boolean value";
        this.checkBooleanTrue.expected = "expected boolean true";
        this.checkBooleanFalse.expected = "expected boolean false";
        this.checkNull.expected = "expected null value";
        // this.checkNever.expected = " "
    }
    assignExpected(message, func) {
        func.expected = message;
        return func;
    }
    union(af, bf, cf) {
        return (item) => {
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
        };
    }
    checkObjectError(str) {
        return str.split("\n").filter(e => !!e.trim()).map((l, j) => (j > 0 ? "   " : " - ") + l).join('\n');
    }
    // checkArrayValue: ()
    checkArray(checker) {
        let sourceLine = new Error("checkArray origin");
        return this.assignExpected("expected an array of one type", (a) => typeof a === "object" && Array.isArray(a) && (a.filter((b, i) => {
            let res = this.checkArrayValue(i, checker, b);
            return res;
        }).length === a.length));
    }
    checkRecord(keychecker, checker) {
        let sourceLine = new Error("checkRecord origin");
        return this.assignExpected("expected a record of one type", (a) => {
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
    checkObject(checkermap, optionalcheckermap = {}, 
    /** if these keys do not pass, the item is assumed to be unrelated */
    unionKeys) {
        // type t = Exclude
        const required = Object.keys(checkermap);
        const optional = Object.keys(optionalcheckermap);
        let sourceLine = new Error("checkObject origin");
        let expectedMessage = "expected an object with keys " + JSON.stringify({
            required: Object.keys(checkermap).filter(k => checkermap[k] !== this.checkNever),
            optional: Object.keys(optionalcheckermap).filter(k => checkermap[k] !== this.checkNever)
        });
        if (unionKeys && !unionKeys.every(e => required.indexOf(e) !== -1)) {
            sourceLine.message = "checkObject unionKeys properties are required";
            throw sourceLine;
        }
        return this.assignExpected("", (a, stringError = false) => {
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
            let res = (required.filter(k => {
                let res = keys.indexOf(k) !== -1;
                if (!res)
                    badkey = true;
                return res;
            }).length === required.length) && (keys.filter((k) => {
                this.currentKeyArray.push(k);
                let res;
                if (!!checkermap[k]) {
                    res = checkermap[k](a[k]);
                    if (!res && checkermap[k].expected)
                        responseString += (JSON.stringify(this.currentKeyArray) + " " + checkermap[k].expected) + "\n";
                    if (!res && unionKeys && unionKeys.indexOf(k) !== -1) {
                        wrongunionkey = true;
                    }
                }
                else if (!!optionalcheckermap[k]) {
                    res = optionalcheckermap[k](a[k]);
                    if (!res && optionalcheckermap[k].expected)
                        responseString += (JSON.stringify(this.currentKeyArray) + " " + optionalcheckermap[k].expected) + "\n";
                }
                else {
                    res = false;
                    responseString += (JSON.stringify(this.currentKeyArray) + " property is unexpected\n");
                    badkey = true;
                }
                this.currentKeyArray.pop();
                return res;
            }).length === keys.length);
            if (badkey)
                responseString += (JSON.stringify(this.currentKeyArray) + " " + expectedMessage + " but got " + JSON.stringify(Object.keys(a))) + "\n";
            if (!stringError && responseString)
                console.log(responseString);
            return (!res && stringError && !wrongunionkey) ? responseString : res;
        });
    }
}
let checker = new CheckInterface();
let { checkBoolean, checkString, checkStringEnum, checkNumber, checkNumberEnum, checkBooleanFalse, checkNever, checkNull } = checker;
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
    $children: checker.checkArray((b) => GroupChild(b)),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImludGVyZmFjZWNoZWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxTQUFnQixjQUFjO0FBRTlCLENBQUM7QUFGRCx3Q0FFQztBQUdELE1BQU0sY0FBYztJQUdsQjtRQWVBLG9CQUFlLEdBQWlDLEVBQUUsQ0FBQztRQTBCbkQsZUFBVSxHQUFHLENBQUMsQ0FBQyxFQUFjLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxXQUFXLENBQUM7UUFDekQsY0FBUyxHQUFHLENBQUMsQ0FBQyxFQUFhLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDO1FBQ3pDLGdCQUFXLEdBQUcsQ0FBQyxDQUFDLEVBQWUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFFBQVEsQ0FBQztRQUN4RCxvQkFBZSxHQUFHLENBQW1CLEdBQUcsTUFBVyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUN6RSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUNsRCxDQUFDLENBQUMsRUFBVSxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUN4RSxpQkFBWSxHQUFHLENBQUMsQ0FBQyxFQUFnQixFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssU0FBUyxDQUFDO1FBQzNELHFCQUFnQixHQUFHLENBQUMsQ0FBQyxFQUFhLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxTQUFTLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQztRQUMxRSxzQkFBaUIsR0FBRyxDQUFDLENBQUMsRUFBYyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssU0FBUyxJQUFJLENBQUMsS0FBSyxLQUFLLENBQUM7UUFDN0UsZ0JBQVcsR0FBRyxDQUFDLENBQUMsRUFBZSxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDO1FBQ3hELG9CQUFlLEdBQUcsQ0FBbUIsR0FBRyxNQUFXLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQ3pFLHlCQUF5QixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQ2xELENBQUMsQ0FBQyxFQUFVLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBcER0RSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsR0FBRyx1QkFBdUIsQ0FBQztRQUNwRCxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsR0FBRyx1QkFBdUIsQ0FBQztRQUNwRCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsR0FBRyx3QkFBd0IsQ0FBQztRQUN0RCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxHQUFHLHVCQUF1QixDQUFDO1FBQ3pELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEdBQUcsd0JBQXdCLENBQUM7UUFDM0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEdBQUcscUJBQXFCLENBQUM7UUFDaEQsaUNBQWlDO0lBRW5DLENBQUM7SUFFRCxjQUFjLENBQUksT0FBZSxFQUFFLElBQU87UUFDeEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7UUFDeEIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBS0QsS0FBSyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRztRQUNmLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNkLGdDQUFnQztZQUNoQyxJQUFJLElBQUksR0FBdUIsRUFBRSxDQUFDO1lBQ2xDLElBQUksR0FBcUIsQ0FBQztZQUMxQixJQUFJLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJO2dCQUFFLE9BQU8sSUFBSSxDQUFDO1lBQ2pELElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDZixJQUFJLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJO2dCQUFFLE9BQU8sSUFBSSxDQUFDO1lBQ2pELElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDZixJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLElBQUk7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFDekQsSUFBSSxDQUFDLENBQUMsRUFBRTtnQkFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3pCLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLEVBQUU7Z0JBQ3hELE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FDOUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FDaEUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzthQUNmO1lBQ0QsT0FBTyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQy9DLENBQUMsQ0FBQztJQUNKLENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxHQUFXO1FBQzFCLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUN0RyxDQUFDO0lBZUQsc0JBQXNCO0lBQ3RCLFVBQVUsQ0FBSSxPQUE0QztRQUN4RCxJQUFJLFVBQVUsR0FBRyxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ2hELE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FDeEIsK0JBQStCLEVBQy9CLENBQUMsQ0FBQyxFQUFZLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDL0UsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBWSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3pELE9BQU8sR0FBRyxDQUFDO1FBQ2IsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFRCxXQUFXLENBQXdDLFVBQXlCLEVBQUUsT0FBNEM7UUFDeEgsSUFBSSxVQUFVLEdBQUcsSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNqRCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsK0JBQStCLEVBQUUsQ0FBQyxDQUFDLEVBQXFCLEVBQUU7WUFDbkYsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QixPQUFPLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQy9DLElBQUksR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFPLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hFLE9BQU8sR0FBRyxDQUFDO1lBQ2IsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDTyxlQUFlLENBQXdDLENBQUksRUFBRSxPQUFpRCxFQUFFLENBQU07UUFDNUgsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0IsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMzQixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVE7WUFDekIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7YUFDbEYsSUFBSSxDQUFDLEdBQUc7WUFDWCxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEdBQUcsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDM0IsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBY0QsV0FBVyxDQUNULFVBQXlELEVBQ3pELHFCQUFrRSxFQUFFO0lBQ3BFLHFFQUFxRTtJQUNyRSxTQUFzQjtRQUV0QixtQkFBbUI7UUFDbkIsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN6QyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDakQsSUFBSSxVQUFVLEdBQUcsSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNqRCxJQUFJLGVBQWUsR0FBRywrQkFBK0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQ3JFLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsVUFBVSxDQUFDO1lBQ2hGLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxVQUFVLENBQUM7U0FDekYsQ0FBQyxDQUFDO1FBRUgsSUFBSSxTQUFTLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ2xFLFVBQVUsQ0FBQyxPQUFPLEdBQUcsK0NBQStDLENBQUM7WUFDckUsTUFBTSxVQUFVLENBQUM7U0FDbEI7UUFFRCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQ3hCLEVBQUUsRUFDRixDQUFDLENBQUMsRUFBRSxjQUF1QixLQUFLLEVBQVUsRUFBRTtZQUMxQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVE7Z0JBQUUsT0FBTyxLQUFLLENBQUM7WUFDeEMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1Qiw0Q0FBNEM7WUFDNUMsTUFBTSxVQUFVLEdBQWEsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO1lBQzNDLG9EQUFvRDtZQUNwRCxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakYsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDO1lBQ25CLHdDQUF3QztZQUN4QyxJQUFJLGFBQWEsR0FBRyxTQUFTLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDdEQsMENBQTBDO1lBQzFDLHdFQUF3RTtZQUN4RSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FDOUMsQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRS9CLElBQUksYUFBYSxFQUFFO2dCQUNqQix5RUFBeUU7Z0JBQ3pFLE9BQU8sSUFBd0IsQ0FBQzthQUNqQztZQUVELElBQUksY0FBYyxHQUFHLEVBQUUsQ0FBQztZQUN4Qix1REFBdUQ7WUFDdkQsK0NBQStDO1lBRS9DLElBQUksR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDN0IsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDakMsSUFBSSxDQUFDLEdBQUc7b0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQztnQkFDeEIsT0FBTyxHQUFHLENBQUM7WUFDYixDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBVyxFQUFFO2dCQUM1RCxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0IsSUFBSSxHQUFZLENBQUM7Z0JBQ2pCLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRTtvQkFDbkIsR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDMUIsSUFBSSxDQUFDLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUTt3QkFDaEMsY0FBYyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUM7b0JBQ2pHLElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7d0JBQ3BELGFBQWEsR0FBRyxJQUFJLENBQUM7cUJBQ3RCO2lCQUNGO3FCQUFNLElBQUksQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFFO29CQUNsQyxHQUFHLEdBQUcsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2xDLElBQUksQ0FBQyxHQUFHLElBQUksa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUTt3QkFDeEMsY0FBYyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsR0FBRyxHQUFHLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQztpQkFDMUc7cUJBQU07b0JBQ0wsR0FBRyxHQUFHLEtBQUssQ0FBQztvQkFDWixjQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRywyQkFBMkIsQ0FBQyxDQUFDO29CQUN2RixNQUFNLEdBQUcsSUFBSSxDQUFDO2lCQUNmO2dCQUNELElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQzNCLE9BQU8sR0FBRyxDQUFDO1lBQ2IsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzQixJQUFJLE1BQU07Z0JBQUUsY0FBYyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsR0FBRyxHQUFHLGVBQWUsR0FBRyxXQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDbkosSUFBSSxDQUFDLFdBQVcsSUFBSSxjQUFjO2dCQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDaEUsT0FBTyxDQUFDLENBQUMsR0FBRyxJQUFJLFdBQVcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUF1QixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFDakYsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0NBRUY7QUFDRCxJQUFJLE9BQU8sR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO0FBQ25DLElBQUksRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxPQUFPLENBQUM7QUFDckksTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUE2QjtJQUN2RSxLQUFLLEVBQUUsWUFBWTtJQUNuQixNQUFNLEVBQUUsWUFBWTtJQUNwQixVQUFVLEVBQUUsWUFBWTtJQUN4QixXQUFXLEVBQUUsWUFBWTtJQUN6QixjQUFjLEVBQUUsWUFBWTtDQUM3QixDQUFDLENBQUM7QUFDSCxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsS0FBSyxDQUNoQyxPQUFPLENBQUMsV0FBVyxDQUFzQjtJQUN2QyxRQUFRLEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQztJQUNqQyxTQUFTLEVBQUUsZUFBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7SUFDcEMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxTQUFTLENBQUM7Q0FDcEUsRUFBRSxTQUFTLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUMzQixPQUFPLENBQUMsV0FBVyxDQUF5QjtJQUMxQyxRQUFRLEVBQUUsZUFBZSxDQUFDLFNBQVMsQ0FBQztJQUNwQyxZQUFZLEVBQUUsV0FBVztJQUN6QixPQUFPLEVBQUUsV0FBVztJQUNwQixJQUFJLEVBQUUsWUFBWTtDQUNuQixFQUFFLFNBQVMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQzNCLE9BQU8sQ0FBQyxXQUFXLENBQXVCO0lBQ3hDLFFBQVEsRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDO0lBQ2xDLFdBQVcsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEVBQUUsZUFBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUN0RixTQUFTLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUM7SUFDMUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO0NBQzNDLEVBQUUsU0FBUyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FDNUIsQ0FBQztBQUNGLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQzlCLE9BQU8sQ0FBQyxXQUFXLENBQXFCO0lBQ3RDLFFBQVEsRUFBRSxlQUFlLENBQUMsUUFBUSxDQUFDO0lBQ25DLFFBQVEsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztJQUMxQyxHQUFHLEVBQUUsV0FBVztJQUNoQixlQUFlLEVBQUUsWUFBWTtJQUM3QixJQUFJLEVBQUUsV0FBVztDQUNsQixFQUFFLFNBQVMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQzNCLE9BQU8sQ0FBQyxXQUFXLENBQXNCO0lBQ3ZDLFFBQVEsRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDO0lBQ2xDLFNBQVMsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUE0QyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdGLFFBQVEsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztJQUMxQyxHQUFHLEVBQUUsV0FBVztJQUNoQixTQUFTLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsaUJBQWlCLENBQUM7Q0FDekQsRUFBRSxTQUFTLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUM1QixDQUFDO0FBQ1csUUFBQSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFlO0lBQ2pFLE9BQU8sRUFBRSxXQUFXO0lBQ3BCLFdBQVcsRUFBRSxXQUFXO0lBQ3hCLFNBQVMsRUFBRSxXQUFXO0lBQ3RCLFVBQVUsRUFBRSxXQUFXO0lBQ3ZCLGlCQUFpQixFQUFFLFdBQVc7SUFDOUIsUUFBUSxFQUFFLFlBQVk7SUFDdEIsYUFBYSxFQUFFLFdBQVc7SUFDMUIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBcUI7UUFDL0QsUUFBUSxFQUFFLGVBQWUsQ0FBUyxNQUFNLENBQUM7UUFDekMsTUFBTSxFQUFFLFVBQVU7S0FDbkIsQ0FBQyxDQUFDO0lBQ0gsWUFBWSxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQWlDO1FBQ2pHLFVBQVUsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFxRDtZQUNuSCxTQUFTLEVBQUUsV0FBVztZQUN0QixRQUFRLEVBQUUsV0FBVztTQUN0QixDQUFDLENBQUM7UUFDSCxXQUFXLEVBQUUsZ0JBQWdCO0tBQzlCLENBQUMsQ0FBQztJQUNILFFBQVEsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUEyQjtRQUN0RCxjQUFjLEVBQUUsWUFBWTtRQUM1QixXQUFXLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUM7UUFDNUMsWUFBWSxFQUFFLFlBQVk7UUFDMUIsVUFBVSxFQUFFLFlBQVk7UUFDeEIsaUJBQWlCLEVBQUUsWUFBWTtRQUMvQixLQUFLLEVBQUUsWUFBWTtRQUNuQix1QkFBdUIsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQztRQUMzRSxJQUFJLEVBQUUsV0FBVztLQUNsQixDQUFDO0lBQ0YsY0FBYyxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQWlDO1FBQ2xFLFdBQVcsRUFBRSxlQUFlLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQztRQUM1QyxLQUFLLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4RSxTQUFTLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM1RSxVQUFVLEVBQUUsWUFBWTtRQUN4QixLQUFLLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDO0tBQ3JELENBQUM7SUFDRixPQUFPLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBMEI7UUFDcEQsVUFBVSxFQUFFLFdBQVc7UUFDdkIsU0FBUyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLGlCQUFpQixDQUFDO1FBQ3hELGVBQWUsRUFBRSxZQUFZO1FBQzdCLFFBQVEsRUFBRSxXQUFXO1FBQ3JCLGdCQUFnQixFQUFFLFlBQVk7S0FDL0IsQ0FBQztJQUNGLFFBQVEsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUEyQjtRQUN0RCxlQUFlLEVBQUUsV0FBVztRQUM1QixJQUFJLEVBQUUsZUFBZSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDO1FBQ2pELFVBQVUsRUFBRSxXQUFXO0tBQ3hCLENBQUM7SUFDRixtQ0FBbUMsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFzRDtRQUM1RyxrQkFBa0IsRUFBRSxZQUFZO1FBQ2hDLE9BQU8sRUFBRSxZQUFZO1FBQ3JCLGlCQUFpQixFQUFFLFdBQVc7S0FDL0IsQ0FBQztDQUNILENBQUMsQ0FBQyJ9