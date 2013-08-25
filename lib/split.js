'use strict';

var kicad2svg = require('kicad2svg');
var fs = require('fs');
var path = require('path');
var async = require('async');

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

  return fs.readFile(inFile, 'utf8', function(err, data) {
    if (err) {
      return callback(err);
    }

    var modData, libData;
    try {
      var ext = path.extname(inFile);
      if (ext == '.mod') {
        modData = kicad2svg.modParser(data, {});
        return splitMod(modData, callback);
      } else if (ext == '.lib') {
        libData = kicad2svg.libParser(data, {});
        return splitLib(libData, callback);
      } else {
        try {
          libData = kicad2svg.libParser(data, {});
          return splitLib(libData, callback);
        } catch (e) {
          modData = kicad2svg.modParser(data, {});
          return splitMod(modData, callback);
        }
      }
    } catch (e) {
      return callback(e);
    }
  });

  function splitMod(modData, callback) {
    return async.eachSeries(Object.keys(modData.modules), writeMod.bind(null, modData), callback);
  }

  function writeMod(modData, moduleName, callback) {
    var module = modData.modules[moduleName];
    var outFile = path.join(outDir, moduleName + '.mod');

    if (opts.yes) {
      return writeModData(module, outFile, callback);
    } else {
      return fs.exists(outFile, function(exists) {
        if (exists) {
          return opts.shouldOverwrite(outFile, function(err, overwrite) {
            if (err) {
              return callback(err);
            }
            if (overwrite) {
              return writeModData(module, outFile, callback);
            }
            console.log('skipping', outFile);
            return callback();
          })
        } else {
          return writeModData(module, outFile, callback);
        }
      });
    }
  }

  function writeModData(module, outFile, callback) {
    console.log('Writing', outFile);
    var text = "PCBNEW-LibModule-V1\n";
    text += "# encoding utf-8\n";
    text += "Units " + module.units + "\n";
    text += "$INDEX\n";
    text += module.name + "\n";
    text += "$EndINDEX\n";
    text += module.original;
    return fs.writeFile(outFile, text, callback);
  }

  function splitLib(libData, callback) {
    return callback(new Error("Not Implemented"));
  }
};
