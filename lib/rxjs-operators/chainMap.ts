import { Observable, Subject, Operator, Subscriber, Subscription } from '../rx';

function obsTruthy<T>(a: T | undefined | null | false | "" | 0 | void): a is T {
    return !!a;
}
type ChainFunction<T, R> = (item: T) => (Observable<R> | void);
class ChainMapOperator<T, R> implements Operator<T, Observable<R>> {

    stack: Error;
    defInput: Subject<T>;
    inputs: { [K: string]: Subject<T> };
    outputs: Observable<R>[];
    keys: string[];

    constructor(
        private chain: ChainFunction<T, R>
    ) {

    }
    static isObservable<T>(obj: any): obj is Observable<T> {
        return typeof obj === "object" && obj instanceof Observable;
    }

    call(subs: Subscriber<Observable<R>>, source: any) {
        return (source as Observable<T>)
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
function chainMap<T, R>(this: Observable<T>, chainFunc: ChainFunction<T, R>) {
    return this.lift(new ChainMapOperator<T, R>(chainFunc));
}
declare module 'rxjs/Observable' {
    interface Observable<T> {
        chainMap: typeof chainMap;
    }
}
Observable.prototype.chainMap = chainMap;