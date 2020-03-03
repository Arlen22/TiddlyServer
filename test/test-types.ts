import {
  Config,
  Schema,
  ServerConfig,
  ServerConfigSchema
} from "../src/server-config";

const config: ServerConfigSchema = {
  tree: [],
  $schema: "",
  // @ts-ignore
  bindInfo: {
    port: 8080,
    bindAddress: ["127.0.0.1" /* "0.0.0.0" */ /* "192.168.0.0/16" */],
    bindWildcard: false,
    enableIPv6: false,
    filterBindAddress: false,
    https: "./https.js",
    localAddressPermissions: {
      "*": {
        loginlink: false,
        mkdir: false,
        putsaver: false,
        registerNotice: false,
        upload: false,
        websockets: false,
        writeErrors: false,
        transfer: false
      }
    },
    _bindLocalhost: false
  }
};
