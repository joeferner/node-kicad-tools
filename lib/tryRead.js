'use strict';

var fs = require('fs');
var path = require('path');
var kicad2svg = require('kicad2svg');

module.exports = function(inFile, callback) {
  var modData, libData;
  return fs.readFile(inFile, 'utf8', function(err, data) {
    try {
      if (err) {
        throw err;
      }

      var ext = path.extname(inFile);
      if (ext == '.mod') {
        modData = kicad2svg.modParser(data, {});
        return callback(null, 'mod', modData);
      } else if (ext == '.lib') {
        libData = kicad2svg.libParser(data, {});
        return callback(null, 'lib', libData);
      } else {
        try {
          libData = kicad2svg.libParser(data, {});
          return callback(null, 'lib', libData);
        } catch (e) {
          modData = kicad2svg.modParser(data, {});
          return callback(null, 'mod', modData);
        }
      }
    } catch (e) {
      err = new Error("Could not parse: " + inFile);
      err.cause = e;
      return callback(err);
    }
  });
};
