'use strict';

var kicad2svg = require('kicad2svg');
var fs = require('fs');
var path = require('path');
var async = require('async');
var tryRead = require('./tryRead');
var writeModules = require('./writeModules');

module.exports = function(opts, callback) {
  var inFile = opts.in;
  var outDir = opts.outdir;

  if (!inFile) {
    throw new Error("'in' is required.");
  }
  if (!outDir) {
    throw new Error("'outdir' is required.");
  }
  if (!opts.yes && !opts.shouldOverwrite) {
    throw new Error("'shouldOverwrite' is required if not force overwrite.");
  }

  return tryRead(inFile, function(err, type, data) {
    if (err) {
      return callback(err);
    }
    if (type == 'lib') {
      return splitLib(data, callback);
    } else if (type == 'mod') {
      return splitMod(data, callback);
    } else {
      return callback(new Error("Unhandled type: " + type));
    }
  });

  function splitMod(modData, callback) {
    return async.eachSeries(Object.keys(modData.modules), writeMod.bind(null, modData), callback);
  }

  function writeMod(modData, moduleName, callback) {
    var module = modData.modules[moduleName];
    var outFile = path.join(outDir, moduleName + '.mod');

    var modules = { };
    modules[module.name] = module;

    if (opts.yes) {
      return writeModules(modules, outFile, callback);
    } else {
      return fs.exists(outFile, function(exists) {
        if (exists) {
          return opts.shouldOverwrite(outFile, function(err, overwrite) {
            if (err) {
              return callback(err);
            }
            if (overwrite) {
              return writeModules(modules, outFile, callback);
            }
            console.log('skipping', outFile);
            return callback();
          })
        } else {
          return writeModules(modules, outFile, callback);
        }
      });
    }
  }

  function splitLib(libData, callback) {
    return async.eachSeries(Object.keys(libData.symbols), writeSymbol.bind(null, libData), callback);
  }

  function writeSymbol(symbolData, symbolName, callback) {
    var symbol = symbolData.symbols[symbolName];
    var outFile = path.join(outDir, symbolName + '.lib');

    if (opts.yes) {
      return writeSymbolData(symbol, outFile, callback);
    } else {
      return fs.exists(outFile, function(exists) {
        if (exists) {
          return opts.shouldOverwrite(outFile, function(err, overwrite) {
            if (err) {
              return callback(err);
            }
            if (overwrite) {
              return writeSymbolData(symbol, outFile, callback);
            }
            console.log('skipping', outFile);
            return callback();
          })
        } else {
          return writeSymbolData(symbol, outFile, callback);
        }
      });
    }
  }

  function writeSymbolData(symbol, outFile, callback) {
    console.log('Writing', outFile);
    var text = "EESchema-LIBRARY Version 2.3\n";
    text += "#encoding utf-8\n";
    text += symbol.original;
    return fs.writeFile(outFile, text, callback);
  }
};
