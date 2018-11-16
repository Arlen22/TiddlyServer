const path = require('path');

module.exports = {
  entry: {
    "source-map-support": path.resolve(__dirname, './node_modules/source-map-support/register.js'),
    "bundled": path.resolve(__dirname, './webpack-bundle.js'),
    "morgan": require.resolve("morgan")
    // "wss": path.resolve(__dirname, './node_modules/ws/index.js')
  },
  output: {
    filename: '[name]-lib.js',
    path: path.resolve(__dirname, './lib'),
    library: "[name]",
    libraryTarget: "commonjs2"
  },
  target: 'node',
  externals: {
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil'
  }
};