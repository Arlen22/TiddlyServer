import * as path from "path";
/** @type {import("webpack")} */
const webpack = module.parent.require("webpack");
import CopyPlugin from "copy-webpack-plugin";
import { CleanWebpackPlugin } from 'clean-webpack-plugin';

const dev = false;
/** @type {import("webpack").Configuration} */
const options = {
  entry: { index: "./dist/build/server.js" },
  target: "node",
  mode: dev ? "none" : "production",
  devtool: false ? 'source-map' : "",
  watch: false,
  plugins: [
    new webpack.DefinePlugin({
      GENTLY: false,
      global: { GENTLY: false },
      "typeof __non_webpack_require__": JSON.stringify("function")
    }),
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node", raw: true
    }),
    new CopyPlugin([
      { from: 'assets', to: './assets/' },
      { from: 'preflighter.js', to: '.' },
      { from: 'scripts', to: './scripts/' },
      { from: 'README.md', to: '.' },
    ]),
  ],
  node: {
    global: true,
    __dirname: false,
    __filename: false
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, "dist"),
    libraryTarget: 'commonjs2'
  },
  externals: [
    "bufferutil",
    "utf-8-validate",
    "tiddlywiki-production",
    "tiddlywiki-production-server",
    "tiddlywiki-production-client"
  ],
  stats: {
    // Ignore warnings due to yarg's dynamic module loading
    warningsFilter: [/node_modules\/yargs/]
  },
};

module.exports = options;
// export default options;