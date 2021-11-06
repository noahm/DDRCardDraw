const fs = require("fs");
const { resolve, basename } = require("path");

const autoprefixer = require("autoprefixer");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ForkTsCheckerPlugin = require("fork-ts-checker-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const OfflinePlugin = require("offline-plugin");
const ZipPlugin = require("zip-webpack-plugin");
const ReactRefreshPlugin = require("@pmmmwh/react-refresh-webpack-plugin");

module.exports = function (env = {}, argv = {}) {
  const isProd = !env.dev;
  const serve = !!env.dev;
  const version = env.version || "custom";

  return {
    mode: isProd ? "production" : "development",
    devtool: isProd ? false : "eval-cheap-module-source-map",
    devServer: !serve
      ? undefined
      : {
          static: "./dist",
          hot: true,
          // host: "0.0.0.0"
        },
    entry: "./src/index.tsx",
    output: {
      filename: "[name].[chunkhash:5].js",
      chunkFilename: "[name].[chunkhash:5].js",
      path: resolve(__dirname, "./dist"),
    },
    optimization: {
      minimize: isProd,
    },
    performance: {
      hints: false,
    },
    stats: {
      colors: true,
      logging: "warn",
      children: false,
      assets: false,
      modules: false,
    },
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx", ".css", ".json"],
    },
    module: {
      rules: [
        {
          enforce: "pre",
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader?cacheDirectory",
            options: {
              presets: [
                [
                  require("@babel/preset-env"),
                  { targets: { browsers: [">2%"] } },
                ],
                require("@babel/preset-typescript"),
              ],
              plugins: [
                require("@babel/plugin-proposal-optional-chaining"),
                require("@babel/plugin-proposal-class-properties"),
                require("@babel/plugin-syntax-dynamic-import"),
                [
                  require("@babel/plugin-transform-react-jsx"),
                  { runtime: "automatic" },
                ],
                require("@babel/plugin-transform-react-jsx-source"),
                !isProd ? require("react-refresh/babel") : null,
              ].filter(Boolean),
            },
          },
        },
        {
          test: /\.css$/,
          exclude: /node_modules/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: "css-loader",
              options: {
                modules: {
                  localIdentName: "[local]__[hash:base64:5]",
                },
                importLoaders: 1,
              },
            },
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  plugins: [autoprefixer],
                },
              },
            },
          ],
        },
        {
          test: /\.svg$/,
          loader: "svg-inline-loader",
        },
        {
          test: /\.(woff2?|ttf|eot|jpe?g|png|gif|mp4|mov|ogg|webm)(\?.*)?$/i,
          loader: "file-loader",
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new ForkTsCheckerPlugin(),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "jackets/**/*",
            context: "src/assets",
            globOptions: {
              ignore: ["**/.DS_Store"],
            },
          },
        ],
      }),
      new webpack.ProgressPlugin(),
      new webpack.NoEmitOnErrorsPlugin(),
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(
          isProd ? "production" : "development"
        ),
        "process.env.DATA_FILES": JSON.stringify(
          fs.readdirSync(resolve(__dirname, "src/songs")).map((file) => ({
            name: basename(file, ".json"),
            display: JSON.parse(
              fs.readFileSync(resolve(__dirname, "src/songs", file))
            ).i18n.en.name,
          }))
        ),
      }),
      new MiniCssExtractPlugin({
        filename: "[name].[contenthash:5].css",
        chunkFilename: "[id].[chunkhash:5].js",
      }),
      new HtmlWebpackPlugin({
        title: "DDR Card Draw",
        filename: "index.html",
        meta: {
          viewport: "width=device-width, initial-scale=1",
        },
      }),
    ].concat(
      !isProd
        ? [new ReactRefreshPlugin()]
        : [
            new ZipPlugin({
              path: __dirname,
              filename: `DDRCardDraw-${version}.zip`,
              exclude: "__offline_serviceworker",
            }),
            new OfflinePlugin({
              ServiceWorker: {
                events: true,
              },
              excludes: ["../*.zip", "jackets/**/*"],
            }),
          ]
    ),
  };
};
