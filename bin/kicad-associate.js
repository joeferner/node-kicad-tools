#!/usr/bin/env node
'use strict';

console.log("Associates schematic symbols with PCB footprints");
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
    'netFile': findNetFile,
    'cmpFile': findCmpFile,
    'refsToInventoryId': ['netFile', readNetFile],
    'parts': ['refsToInventoryId', resolveParts],
    'refToModuleName': ['cmpFile', 'parts', associate],
    'copyKiCadLibraryModule': ['refToModuleName', copyKiCadLibraryModule]
  }, callback);
}

function findFileByExt(ext, callback) {
  glob("*." + ext, function(err, files) {
    if (err) {
      return callback(err);
    }
    if (files.length == 1) {
      return callback(null, files[0]);
    }
    return callback(new Error("Too many ." + ext + " files found: " + files));
  });
}

function findNetFile(callback) {
  return findFileByExt('net', callback);
}

function findCmpFile(callback) {
  return findFileByExt('cmp', callback);
}

function readNetFile(callback, data) {
  var netFile = data.netFile;
  return fs.readFile(netFile, 'utf8', function(err, data) {
    if (err) {
      return callback(err);
    }
    var lines = data
      .split(/\n/)
      .map(function(str) { return str.trim(); });
    var results = {};
    var ref = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = line.match(/^\(comp \(ref (.*?)\)$/);
      if (m) {
        ref = m[1];
      }
      m = line.match(/^\(field \(name inventoryId\) (.*?)\)\)$/);
      if (m) {
        results[ref] = parseInt(m[1]);
      }
    }
    return callback(null, results);
  });
}

function resolveParts(callback, data) {
  var inventoryIds = hashValuesToSet(data.refsToInventoryId);
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

function associate(callback, data) {
  return fs.readFile(data.cmpFile, 'utf8', function(err, cmpFile) {
    if (err) {
      return callback(err);
    }
    var refToModuleName = {};
    var lines = cmpFile
      .split(/\n/)
      .map(function(str) { return str.trim(); });
    var ref;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = line.match(/^Reference\s*=\s*(.*?);$/);
      if (m) {
        ref = m[1];
      }
      m = line.match(/^IdModule\s*=\s*(.*?);$/);
      if (m) {
        var idModule = m[1];
        if (idModule) {
          refToModuleName[ref] = idModule.split(/:/)[1];
        } else {
          idModule = getKiCadModuleFromRef(ref, data.refsToInventoryId, data.parts);
          if (idModule) {
            refToModuleName[ref] = idModule;
            line = 'IdModule  = kicadlib:' + idModule + ';';
            lines[i] = line;
          }
        }
      }
    }
    fs.writeFile(data.cmpFile, lines.join('\n'));
    return callback(null, refToModuleName);
  });
}

function getKiCadModuleFromRef(ref, refsToInventoryId, parts) {
  var inventoryId = refsToInventoryId[ref];
  if (!inventoryId) {
    console.log("Could not find inventory item for: " + ref);
    return null;
  }
  var part = parts[inventoryId];
  if (!part) {
    console.log("Could not find part for: " + ref + " (inventory id: " + inventoryId + ")");
    return null;
  }
  if (!part.kicadModules || part.kicadModules.length == 0) {
    console.log("Could not find kicadModules for: " + ref + " (inventory id: " + inventoryId + ")");
    return null;
  }
  if (part.kicadModules.length != 1) {
    console.log("Wrong number of kicadModules for: " + ref + " (inventory id: " + inventoryId + "): " + part.kicadModules);
    return null;
  }
  return part.kicadModules[0].name;
}

function copyKiCadLibraryModule(callback, data) {
  var moduleNames = hashValuesToSet(data.refToModuleName);
  return async.forEachLimit(moduleNames, 5, function(moduleName, callback) {
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

function copyFile(source, target, callback) {
  var cbCalled = false;

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

run(function(err) {
  if (err) {
    console.log(err);
  }
});
