"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("../rx");
function obsTruthy(a) {
    return !!a;
}
class ChainMapOperator {
    constructor(chain) {
        this.chain = chain;
    }
    static isObservable(obj) {
        return typeof obj === "object" && obj instanceof rx_1.Observable;
    }
    call(subs, source) {
        return source
            .map(this.chain)
            .filter(obsTruthy)
            .filter(ChainMapOperator.isObservable)
            .subscribe(subs);
    }
}
/**
 * Only forwards the result of the map operator if it is an observable, otherwise it drops it.
 * This is the equivelant of Observable.map(...).filter(obsTruthy).filter(isObservable)
 * @param this
 * @param chainFunc
 */
function chainMap(chainFunc) {
    return this.lift(new ChainMapOperator(chainFunc));
}
rx_1.Observable.prototype.chainMap = chainMap;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhaW5NYXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjaGFpbk1hcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDhCQUFnRjtBQUVoRixTQUFTLFNBQVMsQ0FBSSxDQUErQztJQUNqRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDZixDQUFDO0FBRUQsTUFBTSxnQkFBZ0I7SUFRbEIsWUFDWSxLQUEwQjtRQUExQixVQUFLLEdBQUwsS0FBSyxDQUFxQjtJQUd0QyxDQUFDO0lBQ0QsTUFBTSxDQUFDLFlBQVksQ0FBSSxHQUFRO1FBQzNCLE9BQU8sT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLEdBQUcsWUFBWSxlQUFVLENBQUM7SUFDaEUsQ0FBQztJQUVELElBQUksQ0FBQyxJQUErQixFQUFFLE1BQVc7UUFDN0MsT0FBUSxNQUF3QjthQUMzQixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQzthQUNmLE1BQU0sQ0FBQyxTQUFTLENBQUM7YUFDakIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQzthQUNyQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekIsQ0FBQztDQUVKO0FBQ0Q7Ozs7O0dBS0c7QUFDSCxTQUFTLFFBQVEsQ0FBNEIsU0FBOEI7SUFDdkUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksZ0JBQWdCLENBQU8sU0FBUyxDQUFDLENBQUMsQ0FBQztBQUM1RCxDQUFDO0FBTUQsZUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDIn0=