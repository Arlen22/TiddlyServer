"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const routeCaseOperator_1 = require("./routeCaseOperator");
//declare function routeCase<T>(this: Observable<T>,
//    selector: (obj: T) => string,
//    routes: { 0: string, 1: (obs: Observable<T>) => (Observable<T> | undefined) }[],
//    defaultRoute: (obs: Observable<T>) => void): Observable<T>;
//
//declare function routeCase<T>(this: Observable<T>,
//    selector: (obj: T) => string,
//    routes: { [selection: string]: ((obs: Observable<T>) => (Observable<T> | undefined)) },
//    defaultRoute: (obs: Observable<T>) => void): Observable<T>;
function routeCase(selector, routes, defaultRoute) {
    return this.lift(new routeCaseOperator_1.RouteCaseOperator(selector, routes, defaultRoute));
}
exports.routeCase = routeCase;
