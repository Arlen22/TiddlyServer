const { DEFAULT_CONFIG, BaseError, formatError, createGenerator } = require("../ts-json-schema-generator-master");
const { writeFileSync } = require("fs");

const config = {
    ...DEFAULT_CONFIG,
    path: "src/server-config.ts",
    tsconfig: "./tsconfig.json",
    type: "ServerConfigSchema",
    sortProps: true
};

try {
    // const gen = ;
    let root = createGenerator(config).createSchema("ServerConfigSchema");
    root["$id"] = "settings-2-1.schema.json";
    root["definitions"]['ServerConfigSchema']['properties']['tree'] = { '$ref': 'settings-2-1-tree.schema.json' }
    let options = createGenerator(config).createSchema("OptionsArraySchema");
    options["$id"] = "settings-2-1-tree-options.schema.json";
    writeFileSync("settings-2-1.schema.json", JSON.stringify(root, null, 2));
    writeFileSync("settings-2-1-tree-options.schema.json", JSON.stringify(options, null, 2));
} catch (error) {
    if (error instanceof BaseError) {
        process.stderr.write(formatError(error));
        process.exit(1);
    } else {
        throw error;
    }
}
