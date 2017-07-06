import { Observable, Subject, Operator, Subscriber, Subscription } from '../rx';
import { RouteCaseOperator } from "./routeCaseOperator";

//declare function routeCase<T>(this: Observable<T>,
//    selector: (obj: T) => string,
//    routes: { 0: string, 1: (obs: Observable<T>) => (Observable<T> | undefined) }[],
//    defaultRoute: (obs: Observable<T>) => void): Observable<T>;
//
//declare function routeCase<T>(this: Observable<T>,
//    selector: (obj: T) => string,
//    routes: { [selection: string]: ((obs: Observable<T>) => (Observable<T> | undefined)) },
//    defaultRoute: (obs: Observable<T>) => void): Observable<T>;

export function routeCase<T, R>(this: Observable<T>,
    selector: (obj: T) => string,
    routes: { [selection: string]: (obs: Observable<T>) => Observable<R> },
    defaultRoute: (obs: Observable<T>) => Observable<R>
): Observable<R> {
    return this.lift(new RouteCaseOperator<T, R>(selector, routes, defaultRoute));
}
