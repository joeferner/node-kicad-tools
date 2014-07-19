#!/usr/bin/env node
'use strict';

var optimist = require('optimist');
var fsextra = require('fs-extra');
var fs = require('fs');
var path = require('path');
var async = require('async');

var COLORS = {
  "real": {
    '.gbl': '0 15201 489',
    '.gbs': '39619 39619 39619',
    '.gbo': '65535 65535 65535',
    '.gtl': '0 11607 135',
    '.gts': '46953 46953 46953',
    '.gto': '65535 65535 65535',
    '.gko': '65535 50629 13107',
    '.txt': '0 0 0',
    'background': '0 16667 735'
  },
  "print": {
    '.gbl': '65535 65535 65535',
    '.gbs': '39619 39619 39619',
    '.gbo': '0 0 0',
    '.gtl': '65535 65535 65535',
    '.gts': '32239 32239 32239',
    '.gto': '0 0 0',
    '.gko': '0 0 0',
    '.txt': '0 0 0',
    'background': '65535 65535 65535'
  }
};

var argv = optimist
  .usage('Usage: kicadFixGerverFileNames.js [options]')
  .options('indir', {
    alias: 'i',
    describe: 'Input directory.'
  })
  .alias('help', 'h')
  .alias('h', '?')
  .argv;

if (argv.help) {
  optimist.showHelp();
  process.exit(1);
}

argv.indir = argv.indir || '.';

process.on('uncaughtException', function(err) {
  console.error('uncaughtException', err.stack || err);
});

async.auto({
  'renameFiles': renameFiles,
  'createGerbv': ['renameFiles', function(callback, data) {
    return createGerbv(data.renameFiles + '.gvp', COLORS['real'], callback);
  }],
  'createGerbvPrint': ['renameFiles', function(callback, data) {
    return createGerbv(data.renameFiles + '-print.gvp', COLORS['print'], callback);
  }]
}, function(err) {
  if(err) {
    console.error(err.stack);
  }
});

function renameFiles(callback) {
  var baseName;
  return fs.readdir(argv.indir, function(err, files) {
    if(err) {
      return callback(err);
    }
    async.forEach(files, function(file, callback) {
      var m;
      
      if(m = file.match(/(.*)\.(gts|gto|gtl|gko|gbs||gbo)/)) {
        baseName = path.join(argv.indir, m[1]);
      }
      
      if(m = file.match(/(.*)-[BFE](.*)\.(.*)/)) {
        if(m[3] == 'gbr') {
          m[3] = 'gko';
        }
        var newFileName = path.join(argv.indir, m[1] + '.' + m[3]);
        baseName = path.join(argv.indir, m[1]);
        return moveFile(file, newFileName, callback);
      }

      if(m = file.match(/(.*)\.drl/)) {
        var newFileName = m[1] + '.txt';
        return moveFile(file, newFileName, callback);
      }
      
      return callback();
    }, function(err) {
      if(err) {
        return callback(err);
      }
      return callback(null, baseName);
    });
  });
}

function createGerbv(outputFileName, colors, callback) {
  if(!outputFileName) {
    return callback();
  }
  console.log('creating gerbv project: ' + outputFileName);
  return fs.readdir(argv.indir, function(err, files) {
    if(err) {
      return callback(err);
    }
    
    var output = '(gerbv-file-version! "2.0A")\n';
    files.forEach(function(file) {
      var ext = path.extname(file).toLowerCase();
      var fname = path.relative(path.dirname(path.resolve(outputFileName)), file);
      var color = colors[ext] || '0 0 0';
      switch(ext) {
        case '.gbl':
          output += '(define-layer! 7 (cons \'filename "' + fname + '")(cons \'visible #f)(cons \'color #(' + color + ')))\n';
          break;
        case '.gbs':
          output += '(define-layer! 6 (cons \'filename "' + fname + '")(cons \'visible #f)(cons \'color #(' + color + ')))\n';
          break;
        case '.gbo':
          output += '(define-layer! 5 (cons \'filename "' + fname + '")(cons \'visible #f)(cons \'color #(' + color + ')))\n';
          break;
        case '.gtl':
          output += '(define-layer! 4 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(' + color + ')))\n';
          break;
        case '.gts':
          output += '(define-layer! 3 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(' + color + ')))\n';
          break;
        case '.gto':
          output += '(define-layer! 2 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(' + color + ')))\n';
          break;
        case '.gko':
          output += '(define-layer! 1 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(' + color + ')))\n';
          break;
        case '.txt':
          output += '(define-layer! 0 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(' + color + '))(cons \'attribs (list (list \'autodetect \'Boolean 1) (list \'zero_supression \'Enum 1) (list \'units \'Enum 0) (list \'digits \'Integer 4))))\n';
          break;
      }
    });
    var color = colors['background'] || '65535 65535 65535';
    output += '(define-layer! -1 (cons \'filename "' + path.dirname(path.resolve(outputFileName)) + '")(cons \'visible #f)(cons \'color #(' + color + ')))\n';
    output += '(set-render-type! 0)\n';
    return fs.writeFile(outputFileName, output, callback);
  });
}

function moveFile(file, newFileName, callback) {
  return fs.unlink(newFileName, function() {
    console.log("move " + file + " -> " + newFileName);
    return fs.rename(file, newFileName, callback);
  });
}  
