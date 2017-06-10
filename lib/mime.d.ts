export class Mime {
    types: { [k:string]: string; };
    extensions: { [k:string]: string; };
    define(map);
    load(file);
    lookup(path, fallback);
    extension(mimeType);
}
