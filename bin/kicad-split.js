#!/usr/bin/env node
'use strict';

var kicadTools = require('../');
var optimist = require('optimist');
var prompt = require('prompt');

var args = optimist
  .demand('outdir', 'in')
  .alias('h', 'help')
  .alias('h', '?')
  .options('outdir', {
    alias: 'o',
    describe: 'Output directory.'
  })
  .options('in', {
    alias: 'i',
    describe: 'Input file.'
  })
  .options('yes', {
    alias: 'y',
    describe: 'Overwrite files.'
  })
  .argv;

if (args.help) {
  optimist.showHelp();
  return process.exit(1);
}

prompt.message = '';
prompt.delimiter = '';
prompt.colors = false;
prompt.start();

args.shouldOverwrite = function(outFile, callback) {
  return prompt.get({
    description: 'Overwrite ' + outFile + ' [Ny]:',
    type: 'string'
  }, function(err, result) {
    if (err) {
      return callback(err);
    }
    var v = result.question.toLowerCase();
    if (v == 'y' || v == 'yes') {
      return callback(null, true);
    }
    return callback(null, false);
  });
};

console.log('Splitting', args.in, 'to', args.outdir);
kicadTools.split(args, function(err) {
  if (err) {
    console.error(err);
    return process.exit(1);
  }
  console.log('Split complete');
  return process.exit(0);
});