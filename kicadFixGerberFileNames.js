#!/usr/bin/env node
'use strict';

var optimist = require('optimist');
var fsextra = require('fs-extra');
var fs = require('fs');
var path = require('path');
var async = require('async');

var argv = optimist
  .usage('Usage: kicadFixGerverFileNames.js [options]')
  .options('indir', {
    alias: 'i',
    describe: 'Input directory.'
  })
  .options('out', {
    alias: 'o',
    describe: 'Gerbv project output (.gvp).'
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
  'createGerbv': ['renameFiles', createGerbv.bind(null, argv.out)]
}, function(err) {
  if(err) {
    console.error(err.stack);
  }
});

function renameFiles(callback) {
  return fs.readdir(argv.indir, function(err, files) {
    if(err) {
      return callback(err);
    }
    async.forEach(files, function(file, callback) {
      var m;
      if(m = file.match(/(.*)-[BFE](.*)\.(.*)/)) {
        if(m[3] == 'gbr') {
          m[3] = 'gko';
        }
        var newFileName = path.join(argv.indir, m[1] + '.' + m[3]);
        return moveFile(file, newFileName, callback);
      }

      if(m = file.match(/(.*)\.drl/)) {
        var newFileName = m[1] + '.txt';
        return moveFile(file, newFileName, callback);
      }
      
      return callback();
    }, callback);
  });
}

function createGerbv(outputFileName, callback, options) {
  if(!outputFileName) {
    return callback();
  }
  console.log('creating gerbv project');
  return fs.readdir(argv.indir, function(err, files) {
    if(err) {
      return callback(err);
    }
    
    var output = '(gerbv-file-version! "2.0A")\n';
    files.forEach(function(file) {
      var ext = path.extname(file).toLowerCase();
      var fname = path.relative(path.dirname(path.resolve(outputFileName)), file);
      switch(ext) {
        case '.gbl':
          output += '(define-layer! 7 (cons \'filename "' + fname + '")(cons \'visible #f)(cons \'color #(0 15201 489)))\n';
          break;
        case '.gbs':
          output += '(define-layer! 6 (cons \'filename "' + fname + '")(cons \'visible #f)(cons \'color #(39619 39619 39619)))\n';
          break;
        case '.gbo':
          output += '(define-layer! 5 (cons \'filename "' + fname + '")(cons \'visible #f)(cons \'color #(65535 65535 65535)))\n';
          break;
        case '.gtl':
          output += '(define-layer! 4 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(0 11607 135)))\n';
          break;
        case '.gts':
          output += '(define-layer! 3 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(46953 46953 46953)))\n';
          break;
        case '.gto':
          output += '(define-layer! 2 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(65535 65535 65535)))\n';
          break;
        case '.gko':
          output += '(define-layer! 1 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(65535 50629 13107)))\n';
          break;
        case '.txt':
          output += '(define-layer! 0 (cons \'filename "' + fname + '")(cons \'visible #t)(cons \'color #(0 0 0))(cons \'attribs (list (list \'autodetect \'Boolean 1) (list \'zero_supression \'Enum 1) (list \'units \'Enum 0) (list \'digits \'Integer 4))))\n';
          break;
      }
    });
    output += '(define-layer! -1 (cons \'filename "' + path.dirname(path.resolve(outputFileName)) + '")(cons \'visible #f)(cons \'color #(0 16667 735)))\n';
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
