'use strict';

var fs = require('fs');

module.exports = function(modules, outFile, callback) {
  console.log('Writing', outFile);
  var text = "PCBNEW-LibModule-V1\n";
  text += "# encoding utf-8\n";
  text += "Units " + modules[Object.keys(modules)[0]].units + "\n";
  text += "$INDEX\n";
  Object.keys(modules).forEach(function(moduleName) {
    text += moduleName + "\n";
  });
  text += "$EndINDEX\n";
  Object.keys(modules).forEach(function(moduleName) {
    text += modules[moduleName].original += '\n';
  });
  text += "$EndLIBRARY\n";
  return fs.writeFile(outFile, text, callback);
};
