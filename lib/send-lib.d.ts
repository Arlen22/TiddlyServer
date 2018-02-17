import { ServerResponse } from "http";
import { Stats, WriteStream } from "fs";
import { Stream, Writable } from "stream";

interface SendStream {
	on(type: "error", cb: (err: { status: number, message: string }) => void): this;
	on(type: "directory", cb: (res: ServerResponse, path: string) => void): this;
	on(type: "file", cb: (res: ServerResponse, stat: Stats) => void): this;
	on(type: "headers", cb: (res: ServerResponse, path:string, stat: Stats) => void): this;
	on(type: "stream", cb: (stream: Stream) => void): this;
	on(type: "end", cb: () => void): this;
	pipe(res: Writable)
}

declare function send(req, path, opts): SendStream;

export = send;