const path = require('path');
// console.log(require.m);
// process.exit();
const webpack = require('/usr/local/lib/node_modules/webpack');
/** 
 * @type {import("webpack").Configuration}
 */
module.exports = {
  watch: true,
  entry: {
    // "source-map-support": path.resolve(__dirname, './node_modules/source-map-support/register.js'),
    "bundled1": path.resolve(__dirname, './webpack-bundle.js'),
    "morgan": require.resolve("morgan"),
    "compiled": path.resolve(__dirname, './src/server.js')
    // "wss": path.resolve(__dirname, './node_modules/ws/index.js')
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
      // __webpack_require__: true,
      global: { GENTLY: false },
      // "typeof __webpack_require__": "function"
      // PRODUCTION: JSON.stringify(true),
      // VERSION: JSON.stringify('5fa3b9'),
      // BROWSER_SUPPORTS_HTML5: true,
      // TWO: '1+1',
      // 'typeof window': JSON.stringify('object'),
      // 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
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