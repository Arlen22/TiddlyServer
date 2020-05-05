const path = require("path");
/** @type {import("webpack")} */
const webpack = module.parent.require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const CleanWebpackPlugin = require("clean-webpack-plugin").CleanWebpackPlugin;
const dev = false;
/** @type {import("webpack").Configuration} */
const options = {
  entry: { index: "./dist/server.js" },
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
      { from: 'src/client', to: './client/' },
      { from: 'preflighter.js', to: '.' },
      { from: 'scripts', to: './scripts/' },
      { from: 'README.md', to: '.' },
    ]),
    new CleanWebpackPlugin({
      cleanAfterEveryBuildPatterns: [
        "server.d.ts",
        "server.js",
        "package.d.ts",
        "server/"
      ],
      cleanOnceBeforeBuildPatterns: []
    }),
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap('AfterEmitPlugin', (compilation) => {
          // make the package.json file for the npm package
          const json = JSON.parse(require("fs").readFileSync("./package.json", "utf8"));
          // remove keys not used in the production build
          delete json.devDependencies;
          delete json.main;
          delete json.scripts;
          // set the webpack output as the bin file
          json.bin = "./index.js";
          // save to the output directory
          require("fs").writeFileSync("./dist/package.json", JSON.stringify(json, null, 2), "utf8");
        });
      }
    }
  ],
  node: {
    global: true,
    __dirname: false,
    __filename: false
  },
  resolve: {
    alias: {
      "../package.json": "../../package.json"
    }
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