'use strict';

var fs = require('fs');

module.exports = function(symbols, outFile, callback) {
  console.log('Writing', outFile);
  var text = "EESchema-LIBRARY Version 2.3\n";
  text += "# encoding utf-8\n";
  Object.keys(symbols).forEach(function(symbolName) {
    text += symbols[symbolName].original += '\n';
  });
  text += "#End Library\n";
  return fs.writeFile(outFile, text, callback);
};
