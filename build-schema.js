const {DEFAULT_CONFIG, BaseError, formatError, createGenerator} = require("ts-json-schema-generator");
const {writeFileSync} = require("fs");
const stringify = require("json-stable-stringify");
const config = {
  ...DEFAULT_CONFIG,
  path: "src/server-config.ts",
  tsconfig: "./tsconfig.json",
  type: "ServerConfigSchema",
  sortProps: true
};
const prefix = "settings-2-2";
try {
  let root = createGenerator(config).createSchema("ServerConfigSchema");
  root["$id"] = prefix + ".schema.json";
  root["definitions"]['ServerConfigSchema']['properties']['tree'] = {'$ref': prefix + '-tree.schema.json'}
  let options = createGenerator(config).createSchema("OptionsArraySchema");
  options["$id"] = prefix + "-tree-options.schema.json";
  writeFileSync(prefix + ".schema.json", stringify(root, {space: 2}));
  writeFileSync(prefix + "-tree-options.schema.json", stringify(options, {space: 2}));
} catch (error) {
  if (error instanceof BaseError) {
    process.stderr.write(formatError(error));
    process.exit(1);
  } else {
    throw error;
  }
}
