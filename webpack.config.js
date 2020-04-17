const path = require('path')
const webpack = module.parent.require('webpack')
const CopyPlugin = require('copy-webpack-plugin')

const options = {
  watch: false,
  entry: path.resolve(__dirname, './build/server.js'),
  output: {
    filename: 'server-bin.js',
    path: path.resolve(__dirname, './build/'),
    libraryTarget: 'commonjs2',
  },
  plugins: [
    new webpack.DefinePlugin({
      GENTLY: false,
      global: { GENTLY: false },
    }),
  ],
  mode: false ? 'development' : 'production',
  target: 'node',
  node: {
    global: true,
    __dirname: false,
    __filename: false,
  },
  externals: {
    'utf-8-validate': 'commonjs utf-8-validate',
    'bufferutil': 'commonjs bufferutil',
  },
}

module.exports = options
