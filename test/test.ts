import { Config } from "../src/server-config";

import { normalizeTree_GroupElement_ } from "./test-serverconfig-tree";

normalizeTree_GroupElement_().then(res => {
  if(res !== "done") throw "not done";
});