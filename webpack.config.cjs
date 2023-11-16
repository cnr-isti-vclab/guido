var webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path')

module.exports = {

  entry: {
    main: './src/index.js',
  },

  output: {
    path: path.resolve(__dirname + '/dist'),
    filename: 'main.js',
  },

  devServer: {
    contentBase: './dist',
	port:9000
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
