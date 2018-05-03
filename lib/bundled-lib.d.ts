import { ServerResponse, IncomingMessage } from "http";
import { Stats, WriteStream } from "fs";
import { Stream, Writable } from "stream";

interface SendStream {
	options: any;
	path: string;
	req: IncomingMessage;
	res: ServerResponse;
	_acceptRanges: boolean;
	_cacheControl: boolean;
	_etag: boolean;
	_dotfiles: any;
	_hidden: boolean;
	_extensions: any[];
	_immutable: boolean;
	_index: any[];
	_lastModified: boolean;
	_maxage: any;
	_root: string;
	etag: (val: any) => any;
	hidden: (val: any) => any;
	index: (paths: any) => any;
	root: any;
	from: any;
	maxage: (maxAge: any) => any;
	error: (status: number, err?: Error) => any;
	hasTrailingSlash: () => boolean;
	isConditionalGET: () => boolean;
	isPreconditionFailure: () => boolean;
	removeContentHeaderFields: () => void;
	notModified: () => void;
	headersAlreadySent: () => void;
	isCachable: () => boolean;
	onStatError: (error: Error) => void;
	isFresh: () => boolean;
	isRangeFresh: () => boolean;
	redirect: (path: string) => void;
	pipe: (res: any) => any;
	send: (path: string, stat: any) => any;
	sendFile: (path: string) => void;
	sendIndex: (path: string) => void;
	stream: (path: string, options: any) => void;
	type: (path: string) => void;
	setHeader: (path: string, stat: any) => void;
	on(type: "error", cb: (err: { status: number, message: string }) => void): this;
	on(type: "directory", cb: (res: ServerResponse, path: string) => void): this;
	on(type: "file", cb: (res: ServerResponse, stat: Stats) => void): this;
	on(type: "headers", cb: (res: ServerResponse, path: string, stat: Stats) => void): this;
	on(type: "stream", cb: (stream: Stream) => void): this;
	on(type: "end", cb: () => void): this;
}

export declare const morgan: any;
export declare function send(req, path, opts): SendStream;
export declare function etag(entity: string | Buffer | Stats, options?: any);

export { ws, xmljs, formidable, fresh } from "../../TiddlyServer-webpack/bundle";
