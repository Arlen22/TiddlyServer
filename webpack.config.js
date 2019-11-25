const path = require('path');
const webpack = module.parent.require("webpack");
/** 
 * @type {import("webpack").Configuration}
 */
module.exports = {
  watch: false,
  entry: {
    "bundled1": path.resolve(__dirname, './webpack-libs-bundle.js'),
    "morgan": require.resolve("morgan"),
    "compiled": path.resolve(__dirname, './src/server.js')
  },
  output: {
    filename: '[name]-lib.js',
    path: path.resolve(__dirname, './lib'),
    library: "[name]",
    libraryTarget: "commonjs2"
  },
  plugins: [
    new webpack.DefinePlugin({
      GENTLY: false,
      global: { GENTLY: false }
    })
  ],
  mode: false ? "development" : "production",
  target: 'node',
  node: {
    __dirname: true,
    __filename: true
  },
  externals: {
    'utf-8-validate': 'commonjs utf-8-validate',
    'bufferutil': 'commonjs bufferutil',
  }
};