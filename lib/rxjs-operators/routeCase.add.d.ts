//import { concatMap } from 'rxjs/operator/concatMap';
import { Observable } from '../rx';

//declare function routeCase<T>(this: Observable<T>,
//    selector: (obj: T) => string,
//    routes: { 0: string, 1: (obs: Observable<T>) => (Observable<T> | undefined)}[],
//    defaultRoute: (obs: Observable<T>) => void): Observable<T>;
declare function routeCase<T>(this: Observable<T>,
    selector: (obj: T) => string,
    routes: { [selection: string]: (obs: Observable<T>) => Observable<T> },
    defaultRoute: (obs: Observable<T>) => void): Observable<T>;
declare function routeCase<T,R>(this: Observable<T>,
    selector: (obj: T) => string,
    routes: { [selection: string]: (obs: Observable<T>) => Observable<R> },
    defaultRoute: (obs: Observable<T>) => void): Observable<R>;

declare module 'rxjs/Observable' {
    interface Observable<T> {
        routeCase: typeof routeCase;
    }
}
