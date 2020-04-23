const path = require("path");
const webpack = module.parent.require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
let dev = false;
/** @type {import("webpack").Configuration} */
const options = {
  entry: { index: "./build/server.js" },
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
    new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true }),
  ],
  node: {
    global: true,
    __dirname: false,
    __filename: false
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, "build"),
    libraryTarget: 'commonjs'
  },
  externals: [
    "tiddlywiki-production",
    "bufferutil",
    "utf-8-validate",
    "tiddlywiki-production/boot/boot.js"
  ],
  stats: {
    // Ignore warnings due to yarg's dynamic module loading
    warningsFilter: [/node_modules\/yargs/]
  },
};

module.exports = options;


const old = {
  watch: false,
  entry: path.resolve(__dirname, "./build/server.js"),
  output: {
    filename: "server-bin.js",
    path: path.resolve(__dirname, "./build/"),
    libraryTarget: "commonjs2"
  },
  plugins: [
    new webpack.DefinePlugin({
      GENTLY: false,
      global: { GENTLY: false }
    }),
    new CopyPlugin([
      // { from: "./"}
    ])
  ],
  mode: false ? "development" : "production",
  target: "node",
  node: {
    global: true,
    __dirname: false,
    __filename: false
  },
  externals: {
    "utf-8-validate": "commonjs utf-8-validate",
    bufferutil: "commonjs bufferutil"
  }
};
