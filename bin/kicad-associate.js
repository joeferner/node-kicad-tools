#!/usr/bin/env node
'use strict';

console.log("TODO: Validate schematic symbol with inventory");

var optimist = require('optimist');
var fs = require('fs');
var path = require('path');
var async = require('async');
var glob = require('glob');
var request = require('request');
var partUrlPrefix = 'http://localhost:3000/part/';
var kicadLibraryModsPath = '../../kicad-library/mods/';

var args = optimist
  .alias('h', 'help')
  .alias('h', '?')
  .argv;

if (args.help) {
  optimist.showHelp();
  return process.exit(1);
}

function run(callback) {
  async.auto({
    'schFileNames': findSchFiles,
    'schFiles': ['schFileNames', readSchFiles],
    'parts': ['schFiles', resolveParts],
    'copyKiCadLibraryModule': ['parts', copyKiCadLibraryModule],
    'associate': ['schFiles', 'parts', associate],
    'writeSchFiles': ['associate', writeSchFiles]
  }, callback);
}

function findFilesByExt(ext, callback) {
  glob("*." + ext, function(err, files) {
    if (err) {
      return callback(err);
    }
    return callback(null, files);
  });
}

function findSchFiles(callback) {
  return findFilesByExt('sch', callback);
}

function readSchFiles(callback, data) {
  var schFileNames = data.schFileNames;
  console.log('readSchFiles', schFileNames);
  async.map(schFileNames, function(schFile, callback) {
    console.log('readSchFile', schFile);
    return fs.readFile(schFile, 'utf8', function(err, data) {
      if (err) {
        return callback(err);
      }
      var lines = data
        .split(/\n/);
      var results = {
        schFile: schFile,
        inventoryIds: [],
        refToModule: {},
        lines: lines,
        refsToInventoryId: {}
      };
      var ref = null;
      var hasInventoryId = false;
      var hasModule = false;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var m = line.match(/^\$Comp/);
        if(m) {
          ref = null;
          hasInventoryId = false;
          hasModule = false;
        }

        m = line.match(/^L (.*?) (.*?)$/);
        if (m) {
          ref = m[2];
        }

        m = line.match(/^F .*? "kicadlib:(.*?)" .*$/);
        if (m) {
          results.refToModule[ref] = m[1];
          hasModule = true;
        }

        m = line.match(/^F .*? "(.*?)" .* "inventoryId"$/);
        if (m) {
          results.refsToInventoryId[ref] = m[1];
          results.inventoryIds.push(m[1]);
          hasInventoryId = true;
        }

        m = line.match(/^\$EndComp/);
        if(m) {
          if(!hasInventoryId && !hasModule && ref[0] != '#') {
            console.log(ref + ' missing inventoryId');
          }
          ref = null;
        }
      }
      return callback(null, results);
    });
  }, callback);
}

function resolveParts(callback, data) {
  var inventoryIds = toSet([].concat.apply([], data.schFiles.map(function(r) { return r.inventoryIds; })));
  var parts = {};
  return async.forEachLimit(inventoryIds, 5, function(inventoryId, callback) {
    var url = partUrlPrefix + inventoryId;
    return request(url, function(err, res, body) {
      if (err) {
        return callback(err);
      }
      if (res.statusCode != 200) {
        return callback(new Error('Invalid response code for url: ' + url));
      }
      var json = JSON.parse(body);
      parts[inventoryId] = json;
      return callback();
    });
  }, function(err) {
    return callback(err, parts);
  });
}

function copyKiCadLibraryModule(callback, data) {
  var parts = data.parts;
  var kicadModules = getKicadModulesFromParts(parts);
  return async.forEachLimit(kicadModules, 5, function(moduleName, callback) {
    var localModPath = path.resolve('mods', moduleName + '.kicad_mod');
    return fs.exists(localModPath, function(exists) {
      if (exists) {
        return callback();
      }
      var kicadLibraryModPath = path.resolve(kicadLibraryModsPath, moduleName + '.kicad_mod');
      return fs.exists(kicadLibraryModPath, function(exists) {
        if (!exists) {
          console.log('Could not find: ' + kicadLibraryModPath);
          return callback();
        }
        return copyFile(kicadLibraryModPath, localModPath, callback);
      });
    });
  }, callback);
}

function getKicadModulesFromParts(parts) {
  var results = {};
  Object.keys(parts).forEach(function(partName) {
    var part = parts[partName];
    if (part.kicadModules) {
      part.kicadModules.forEach(function(kicadModule) {
        results[kicadModule.name] = true;
      });
    }
  });
  return Object.keys(results);
}

function associate(callback, data) {
  var schFiles = data.schFiles;
  var parts = data.parts;
  async.forEach(schFiles, function(schFile, callback) {
    var lines = schFile.lines;
    var ref = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();i

      var m = line.match(/^L (.*?) (.*?)$/);
      if (m) {
        ref = m[2];
      }

      m = line.match(/^F (.*?) ".*?" (.*)$/);
      if (m) {
        if(parseInt(m[1]) == 2) {
          var inventoryId = schFile.refsToInventoryId[ref];
          var associatedModule = schFile.refToModule[ref];
          if(inventoryId) {
            var part = parts[inventoryId];
            if(part) {
              var kicadModules = part.kicadModules;
              if(kicadModules && kicadModules.length == 1) {
                var kicadModule = kicadModules[0].name;
                var restOfLine = m[2];
                if(associatedModule != kicadModule) {
                  console.log('associating ' + ref + ' to ' + kicadModule);
                  restOfLine = restOfLine.replace('0000', '0001');
                  lines[i] = 'F 2 "kicadlib:' + kicadModule + '" ' + restOfLine;
                }
              } else if(!kicadModules || kicadModules.length == 0) {
                console.log('no module for ' + ref + ' on inventory id ' + inventoryId);
              } else {
                console.log('too many modules for ' + ref + ' on inventory id ' + inventoryId);
              }
            }
          }
        }
      }
    }
    return callback();
  }, callback);
}

function writeSchFiles(callback, data) {
  var schFiles = data.schFiles;
  async.forEach(schFiles, function(schFile, callback) {
    var fileName = schFile.schFile;
    var data = schFile.lines.join('\n');
    return fs.writeFile(fileName, data, callback);
  }, callback);
}

function copyFile(source, target, callback) {
  var cbCalled = false;

  console.log('copying ' + source + ' -> ' + target);
  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      callback(err);
      cbCalled = true;
    }
  }
}

function hashValuesToSet(hash) {
  var results = {};
  Object.keys(hash).forEach(function(key) {
    var val = hash[key];
    results[val] = true;
  });
  return Object.keys(results);
}

function toSet(arr) {
  var results = {};
  arr.forEach(function(e) {
    results[e] = true;
  });
  return Object.keys(results);
}

run(function(err) {
  if (err) {
    console.log(err);
  }
});
