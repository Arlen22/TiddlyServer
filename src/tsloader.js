"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_types_1 = require("./server-types");
function tsloader(state, mount, folder) {
    return server_types_1.obs_readFile()(folder, 'utf8').map(([err, data]) => {
        const json = server_types_1.tryParseJSON(data);
    });
}
exports.tsloader = tsloader;
