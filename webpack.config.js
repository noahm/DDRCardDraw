const { resolve } = require('path');

const autoprefixer = require('autoprefixer');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const UglifyPlugin = require('uglifyjs-webpack-plugin');

module.exports = function (env = {}, argv = {}) {
    const isProd = !env.dev;
    const serve = !!env.dev;

    return {
        devtool: isProd ? false : 'cheap-module-eval-source-map',
        devServer: !serve ? undefined : {
            contentBase: './dist',
        },
        entry: './src/app.jsx',
        output: {
            filename: '[name].bundle.js',
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
            new webpack.NoEmitOnErrorsPlugin(),
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': isProd ? 'production' : 'development',
            }),
            new ExtractTextPlugin({
                filename: '[name]-styles.css',
            }),
            new HtmlWebpackPlugin({
                title: 'DDR A Card Draw',
                filename: 'index.html',
            }),
        ].concat(!isProd ? [] : [
            new UglifyPlugin(),
        ]),
    };
};
