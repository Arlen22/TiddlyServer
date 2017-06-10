"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rx_1 = require("../rx");
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
rx_1.Observable.prototype.routeCase = routeCase;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVDYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicm91dGVDYXNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsOEJBQWdGO0FBQ2hGLDJEQUF3RDtBQUV4RCxvREFBb0Q7QUFDcEQsbUNBQW1DO0FBQ25DLHNGQUFzRjtBQUN0RixpRUFBaUU7QUFDakUsRUFBRTtBQUNGLG9EQUFvRDtBQUNwRCxtQ0FBbUM7QUFDbkMsNkZBQTZGO0FBQzdGLGlFQUFpRTtBQUNqRSxtQkFDSSxRQUE0QixFQUM1QixNQUFzRSxFQUN0RSxZQUFtRDtJQUVuRCxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLHFDQUFpQixDQUFPLFFBQVEsRUFBRSxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztBQUNsRixDQUFDO0FBTkQsOEJBTUM7QUFFRCxlQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUMifQ==