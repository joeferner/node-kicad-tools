'use strict';

var kicad2svg = require('kicad2svg');
var fs = require('fs');
var path = require('path');
var async = require('async');
var tryRead = require('./tryRead');
var writeModules = require('./writeModules');

module.exports = function(opts, callback) {
  var inFile = opts.in;
  var outFile = opts.out;
  var basedir = opts.basedir || process.cwd();

  if (!inFile) {
    throw new Error("'in' is required.");
  }
  if (!outFile) {
    throw new Error("'out' is required.");
  }

  return tryRead(outFile, function(err, type, outFileData) {
    if (err) {
      return callback(err);
    }

    return fs.readFile(inFile, 'utf8', function(err, data) {
      if (err) {
        return callback(err);
      }
      var lines = data
        .split('\n')
        .filter(function(line) {
          return line.length > 0;
        });
      async.map(lines, readFile.bind(null, basedir), function(err, fileData) {
        if (err) {
          return callback(err);
        }
        fileData.forEach(function(d) {
          Object.keys(d.data.modules).forEach(function(moduleName) {
            var module = d.data.modules[moduleName];
            outFileData.modules[moduleName] = module;
          });
        });

        return writeModules(outFileData.modules, outFile, callback);
      });
    });
  });
};

function readFile(basedir, fileName, callback) {
  return tryRead(path.join(basedir, fileName), function(err, type, data) {
    if (err) {
      return callback(err);
    }
    if (type == 'lib' || type == 'mod') {
      return callback(null, { type: type, data: data });
    } else {
      return callback(new Error("Unhandled type: " + type));
    }
  });
}