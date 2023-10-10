const fs = require("fs");
const { resolve, basename } = require("path");

const autoprefixer = require("autoprefixer");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ForkTsCheckerPlugin = require("fork-ts-checker-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const OfflinePlugin = require("@lcdp/offline-plugin");
const ZipPlugin = require("zip-webpack-plugin");
const ReactRefreshPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const FaviconsWebpackPlugin = require("favicons-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

const packageJson = require("./package.json");

module.exports = function (env = {}, argv = {}) {
  const isProd = !env.dev;
  const serve = !!env.dev;
  const version = env.version || "custom";
  const zip = !!env.zip;

  return {
    target: "web",
    mode: isProd ? "production" : "development",
    devtool: isProd ? false : "inline-cheap-module-source-map",
    devServer: !serve
      ? undefined
      : {
          static: "./dist",
          hot: true,
          host: "0.0.0.0",
        },
    entry: "./src/index.tsx",
    output: {
      filename: "[name].[chunkhash:5].js",
      path: resolve(__dirname, "./dist"),
    },
    optimization: {
      minimize: false,
      minimizer: ["...", new CssMinimizerPlugin()],
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
      alias: {
        peerjs$: resolve(__dirname, "node_modules/peerjs/dist/peerjs.esm.js"),
      },
    },
    module: {
      rules: [
        {
          enforce: "pre",
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                [
                  require("@babel/preset-env"),
                  { targets: { browsers: [">1%"], ios: "12.5" } },
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
              cacheDirectory: true,
            },
          },
        },
        {
          // pass 1st party css files through css-loader with modules enabled and postcss+autoprefixer
          test: /\.css$/,
          exclude: /node_modules/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : "style-loader",
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
          // pass 3rd party css through css-loader without transforms
          test: /\.css$/,
          include: resolve(__dirname, "node_modules"),
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          test: /\.(woff2?|ttf|svg|eot|jpe?g|png|gif|mp4|mov|ogg|webm)(\?.*)?$/i,
          type: "asset/resource",
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
          isProd ? "production" : "development",
        ),
        "process.env.DATA_FILES": JSON.stringify(
          fs.readdirSync(resolve(__dirname, "src/songs")).map((file) => {
            const fileContents = JSON.parse(
              fs.readFileSync(resolve(__dirname, "src/songs", file)),
            );
            return {
              name: basename(file, ".json"),
              display: fileContents.i18n.en.name,
              parent: fileContents.meta.menuParent || "",
            };
          }),
        ),
      }),
      new MiniCssExtractPlugin({
        filename: "[name].[chunkhash:5].css",
      }),
      new FaviconsWebpackPlugin({
        logo: "./src/assets/ddr-tools-256.png",
        inject: true,
        prefix: "favicons/",
        favicons: {
          appName: "DDR Tools - card draw and more!",
          appShortName: "DDR Tools",
          theme_color: "#28b6ea",
          display: "standalone",
          scope: "/",
          start_url: "/",
          manifestMaskable: true,
          icons: {
            windows: false,
            yandex: false,
            firefox: false,
            coast: false,
            appleStartup: false,
            android: {
              offset: 15,
            },
            appleIcon: {
              offset: 10,
            },
          },
        },
      }),
      new HtmlWebpackPlugin({
        title: "DDR Tools - card draw and more!",
        filename: "index.html",
        meta: {
          description: packageJson.description,
          viewport: "width=device-width, initial-scale=1",
        },
        template: "src/index.ejs",
      }),
    ].concat(
      !isProd
        ? [new ReactRefreshPlugin({ overlay: false })]
        : zip
        ? [
            new ZipPlugin({
              path: __dirname,
              filename: `DDRCardDraw-${version}.zip`,
              exclude: "__offline_serviceworker",
            }),
          ]
        : [
            new OfflinePlugin({
              ServiceWorker: {
                events: true,
              },
              excludes: ["../*.zip", "jackets/**/*", "favicons/*"],
            }),
          ],
    ),
  };
};
