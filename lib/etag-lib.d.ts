import { Stats } from "fs";

declare function etag(entity: string | Buffer | Stats, options?: any);

export = etag;