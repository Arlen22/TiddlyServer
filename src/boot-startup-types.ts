export interface PluginInfo {
	[K: string]: string
}
export interface WikiInfo {
	includeWikis: (string | { path: string, info: { "read-only": boolean } })[]
	build: string[][]
	plugins: string[]
	themes: string[]
	languages: string[]
	config?: { [K: string]: any }
	type: "tiddlywiki" | "tiddlyserver";
}
export interface FileInfo {
	tiddlers?: Record<string, any>;
	hasMetaFile: boolean;
	filepath: string;
	type: string;
}