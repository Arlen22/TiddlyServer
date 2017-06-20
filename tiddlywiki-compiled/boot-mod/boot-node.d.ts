import { Observable } from 'rxjs';
declare module 'rxjs/operator/ignoreElements' {
    function ignoreElements<T>(this: Observable<T>): Observable<never>;
}
export interface Tiddler {
    fields: TiddlerFields;
}
export interface TiddlerFields {
    readonly text: string;
    readonly type: string;
    readonly title: string;
}
export interface FileInfo {
    filepath?: string;
    type?: string;
    tiddlers: TiddlerFields[];
    hasMetaFile?: boolean;
}
export declare function bootNode($tw: any): void;
