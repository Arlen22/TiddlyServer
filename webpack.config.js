const path = require('path');
const webpack = module.parent.require("webpack");
const CopyPlugin = require('copy-webpack-plugin');
/**
 * @type {import("webpack").Configuration}
 */
module.exports = {
  watch: false,
  entry: {
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
    }),
    new CopyPlugin([
        { from: './server.js', to: './build' },
        { from: './tiddlywiki/**/*', to: './build/' },
        { from: './build/src/*', to: './' },
        { from: './build/test/*', to: './' }
    ]),
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
