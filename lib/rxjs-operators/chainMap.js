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
