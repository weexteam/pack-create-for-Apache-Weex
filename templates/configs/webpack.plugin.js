const path = require('path');
const webpack = require('webpack');
const config = require('./config');
const outputPath = path.join(config.root, config.pluginConfigPath);
const plugins = [
  /**
   * Plugin: webpack.DefinePlugin
   * Description: The DefinePlugin allows you to create global constants which can be configured at compile time. 
   *
   * See: https://webpack.js.org/plugins/define-plugin/
   */
  new webpack.DefinePlugin({
    'process.env': {
      'NODE_ENV': JSON.stringify('plugin')
    }
  }),
  /*
   * Plugin: BannerPlugin
   * Description: Adds a banner to the top of each generated chunk.
   * See: https://webpack.js.org/plugins/banner-plugin/
   */
  new webpack.BannerPlugin({
    banner: '// weex plugin \n',
    raw: true,
    exclude: 'Vue'
  })
];
// Config for compile plugin for web.
const pluginConfig = {
  context: root,
  entry: {
    'plugin.bundle': outputPath
  },
  output: {
    path: path.join(root, 'plugins'),
    filename: '[name].js'
  },
  /**
   * Developer tool to enhance debugging
   *
   * See: http://webpack.github.io/docs/configuration.html#devtool
   * See: https://github.com/webpack/docs/wiki/build-performance#sourcemaps
   */
  devtool: 'source-map',
  /*
   * Options affecting the resolving of modules.
   *
   * See: http://webpack.github.io/docs/configuration.html#module
   */
  module: {
    // webpack 2.0 
    rules: [{
      test: /\.js$/,
      use: [{
        loader: 'babel-loader'
      }],
      exclude: /node_modules(?!(\/|\\).*(weex).*)/
    }, {
      test: /\.vue(\?[^?]+)?$/,
      use: [{
        loader: 'vue-loader',
        options: {
          /**
           * important! should use postTransformNode to add $processStyle for
           * inline style prefixing.
           */
          optimizeSSR: false,
          compilerModules: [{
            postTransformNode: el => {
              el.staticStyle = `$processStyle(${el.staticStyle})`
              el.styleBinding = `$processStyle(${el.styleBinding})`
            }
          }]
        }
      }]
    }]
  },
  /*
   * Add additional plugins to the compiler.
   *
   * See: http://webpack.github.io/docs/configuration.html#plugins
   */
  plugins: plugins
};
module.exports = pluginConfig;
