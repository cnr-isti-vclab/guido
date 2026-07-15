var webpack = require('webpack')
var fs = require('fs')
//import webpack from 'webpack'

const HtmlWebpackPlugin = require('html-webpack-plugin')
//import HtmlWebpackPlugin from 'html-webpack-plugin'
//import path from 'path'
const path = require('path')

module.exports = {

  entry: {
    main: './src/index.js',
  },
    cache:false,
  output: {
    path: path.resolve(__dirname + '/dist/js'),
    filename: 'main.js',
  },

  mode: 'development',
  
  devServer: {
    static: './dist',
    port:9000,
  devMiddleware: {
    writeToDisk: true
  }
//    https: {
//      key: fs.readFileSync("server/private.key"),
//      cert: fs.readFileSync("server/private.pem"),
//      ca: fs.readFileSync("server/private.pem")
//    }
  },

  optimization: {
    minimize: false
  }, 
  plugins: [
    new webpack.HotModuleReplacementPlugin(), 
    new HtmlWebpackPlugin({
      title: 'guide2pi',
      template: __dirname + '/dist/index.html',
      inject: false
    }),
  ],
}
