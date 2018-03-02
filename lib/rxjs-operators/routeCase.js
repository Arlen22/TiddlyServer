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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVDYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicm91dGVDYXNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0EsMkRBQXdEO0FBRXhELG9EQUFvRDtBQUNwRCxtQ0FBbUM7QUFDbkMsc0ZBQXNGO0FBQ3RGLGlFQUFpRTtBQUNqRSxFQUFFO0FBQ0Ysb0RBQW9EO0FBQ3BELG1DQUFtQztBQUNuQyw2RkFBNkY7QUFDN0YsaUVBQWlFO0FBRWpFLG1CQUNJLFFBQTRCLEVBQzVCLE1BQXNFLEVBQ3RFLFlBQW1EO0lBRW5ELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUkscUNBQWlCLENBQU8sUUFBUSxFQUFFLE1BQU0sRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFORCw4QkFNQyJ9