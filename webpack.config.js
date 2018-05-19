const path = require("path");

module.exports = {
  mode: "development",
  devtool: "source-map",
  entry: "./client.js",
  output: {
    filename: "client.js",
    path: path.resolve(__dirname, "build")
  }
};
