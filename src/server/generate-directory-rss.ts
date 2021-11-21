import { basename, extname } from "path";
import { pathToFileURL } from "url";
import { DirectoryIndexListing, DirectoryIndexOptions } from "./server-types";
import { expandNodeTree, toXML } from "./utils-xml";
import { mime } from "send";
import { sortBySelector } from "./utils-functions";


export function generateDirectoryRSS(def: DirectoryIndexListing, opts: DirectoryIndexOptions) {
  let rss = {
    title: basename(def.path),
    description: opts.isLoggedIn ? "Logged in as " + opts.isLoggedIn : "Not logged in",
    link: def.path,
    item: def.entries.map(e => ({
      title: e.name,
      link: "/" + e.path,
      description: e.type === "file" ? `${e.mime} (${e.size})` : e.type,
      pubDate: new Date(e.modified).toISOString(),
      guid: "/" + e.path + "@" + e.modified
    }))
  };
  return '<?xml version="1.0" encoding="UTF-8" ?>\n'
    + '<rss version="2.0">\n'
    + toXML(expandNodeTree(rss, "channel")[0])
    + '\n</rss>\n';
}
