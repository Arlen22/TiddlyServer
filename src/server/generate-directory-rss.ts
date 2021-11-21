import { extname } from "path";
import { pathToFileURL } from "url";
import { DirectoryIndexListing, DirectoryIndexOptions } from "./server-types";
import { expandNodeTree, toXML } from "./utils-xml";
import { mime } from "send";

export function generateDirectoryRSS(def: DirectoryIndexListing, opts: DirectoryIndexOptions) {
  let rss = {
    title: def.path,
    description: def.path,
    link: def.path,
    item: def.entries.map(e => ({
      title: e.name,
      link:"/" + e.path,
      description: e.type === "file" ? mime.lookup(e.name, "") : ("index/" + e.type),
      pubDate: new Date(e.modified).toISOString(),
      guid: "/" + e.path + "@" + e.modified
    }))
  }
  return '<?xml version="1.0" encoding="UTF-8" ?>\n'
    + '<rss version="2.0">\n'
    + toXML(expandNodeTree(rss, "channel")[0])
    + '\n</rss>\n';
}