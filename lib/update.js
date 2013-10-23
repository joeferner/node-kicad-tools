'use strict';

var kicad2svg = require('kicad2svg');
var fs = require('fs');
var path = require('path');
var async = require('async');
var tryRead = require('./tryRead');
var writeModules = require('./writeModules');
var writeSymbols = require('./writeSymbols');

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

    var existingNames = getExistingNames(outFileData);

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
          if (d.data.modules) {
            Object.keys(d.data.modules).forEach(function(moduleName) {
              outFileData.modules[moduleName] = d.data.modules[moduleName];
              delete existingNames[moduleName];
            });
          } else {
            Object.keys(d.data.symbols).forEach(function(symbolName) {
              outFileData.symbols[symbolName] = d.data.symbols[symbolName];
              delete existingNames[symbolName];
            });
          }
        });

        Object.keys(existingNames).forEach(function(n) {
          console.log('Not updating ' + n + ', not found in list.');
        });

        if (outFileData.modules) {
          return writeModules(outFileData.modules, outFile, callback);
        } else {
          return writeSymbols(outFileData.symbols, outFile, callback);
        }
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

function getExistingNames(data) {
  var d = {};
  if (data.modules) {
    Object.keys(data.modules).forEach(function(n) {
      d[n] = 1;
    });
  } else {
    Object.keys(data.symbols).forEach(function(n) {
      d[n] = 1;
    });
  }
  return d;
}
