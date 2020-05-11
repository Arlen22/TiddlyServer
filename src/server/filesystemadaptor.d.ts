// export var FileSystemAdaptor: typeof FileSystemAdaptor;
/** @constructor */
declare function FileSystemAdaptor(options: any): void;
declare class FileSystemAdaptor {
  /** @constructor */
  constructor(options: any);
  wiki: any;
  files: any;
  wikiTiddlersPath: any;
  utils: any;
  name: string;
  supportsLazyLoading: boolean;
  isReady(): boolean;
  getTiddlerInfo(tiddler: any): {};
  getTiddlerFileInfo(tiddler: any, callback: any): void;
  saveTiddler(tiddler: any, callback: any): void;
  loadTiddler(title: any, callback: any): void;
  deleteTiddler(title: any, callback: any, options: any): void;
}
export { FileSystemAdaptor };
