const { resolve } = require('path');

const autoprefixer = require('autoprefixer');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const DelWebpackPlugin = require('del-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const OfflinePlugin = require('offline-plugin');
const ZipPlugin = require('zip-webpack-plugin');

module.exports = function (env = {}, argv = {}) {
  const isProd = !env.dev;
  const serve = !!env.dev;

  return {
    devtool: isProd ? false : 'cheap-module-eval-source-map',
    devServer: !serve ? undefined : {
      contentBase: './dist',
      host: '0.0.0.0',
      noInfo: true,
    },
    entry: './src/app.jsx',
    output: {
      filename: '[name].[hash:5].js',
      chunkFilename: '[name].[chunkhash:5].js',
      path: resolve(__dirname, './dist'),
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.css', '.json'],
    },
    module: {
      rules: [
        {
          enforce: 'pre',
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader?cacheDirectory',
            options: {
              presets: [
                require('babel-preset-env'),
              ],
              plugins: [
                require('babel-plugin-transform-class-properties'),
                require('babel-plugin-syntax-dynamic-import'),
                [require('babel-plugin-transform-react-jsx'), { pragma: 'h' }],
                [require('babel-plugin-jsx-pragmatic'), {
                  module: 'preact',
                  export: 'h',
                  import: 'h',
                }],
              ],
            },
          }
        },
        {
          test: /\.css$/,
          exclude: /node_modules/,
          loader: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [
              {
                loader: 'css-loader',
                options: {
                  modules: true,
                  localIdentName: '[local]__[hash:base64:5]',
                  importLoaders: 1,
                },
              },
              {
                loader: 'postcss-loader',
                options: {
                  ident: 'postcss',
                  plugins: [autoprefixer()],
                },
              },
            ],
          }),
        },
        {
          test: /\.(svg|woff2?|ttf|eot|jpe?g|png|gif|mp4|mov|ogg|webm)(\?.*)?$/i,
          loader: 'file-loader',
        },
      ],
    },
    plugins: [
      new DelWebpackPlugin({
        info: false,
        exclude: ['jackets'],
      }),
      new CopyWebpackPlugin([
        'src/assets',
      ]),
      new webpack.NoEmitOnErrorsPlugin(),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
      }),
      new ExtractTextPlugin({
        filename: '[name].[contenthash:5].css',
      }),
      new HtmlWebpackPlugin({
        title: 'DDR Card Draw',
        filename: 'index.html',
        meta: {
          viewport: 'width=device-width, initial-scale=1'
        },
      }),
    ].concat(!isProd ? [] : [
      new ZipPlugin({
        path: __dirname,
        filename: 'DDRCardDraw-x.x.x.zip',
        exclude: '__offline_serviceworker',
      }),
      new OfflinePlugin({
        ServiceWorker: {
          events: true,
        },
        excludes: ['../*.zip', 'jackets/*'],
      }),
      new webpack.optimize.UglifyJsPlugin(),
    ]),
  };
};
