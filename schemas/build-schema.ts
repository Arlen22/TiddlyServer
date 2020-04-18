const {
  DEFAULT_CONFIG,
  BaseError,
  formatError,
  createGenerator,
} = require('ts-json-schema-generator')
const { writeFileSync } = require('fs')
const stringify = require('json-stable-stringify')
const config = {
  ...DEFAULT_CONFIG,
  path: '../src/server-config.ts',
  tsconfig: 'tsconfig.json',
  type: 'ServerConfigSchema',
  sortProps: true,
}

try {
  let root = createGenerator(config).createSchema('ServerConfigSchema')
  root['$id'] = './settings-2-1.schema.json'
  root['definitions']['ServerConfigSchema']['properties']['tree'] = {
    $ref: './settings-2-1-tree.schema.json',
  }
  let options = createGenerator(config).createSchema('OptionsArraySchema')
  options['$id'] = './schemas/settings-2-1-tree-options.schema.json'
  writeFileSync('./schemas/settings-2-1.schema.json', stringify(root, { space: 2 }))
  writeFileSync('./schemas/settings-2-1-tree-options.schema.json', stringify(options, { space: 2 }))
} catch (error) {
  if (error instanceof BaseError) {
    process.stderr.write(formatError(error))
    process.exit(1)
  } else {
    throw error
  }
}
