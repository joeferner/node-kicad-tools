#!/usr/bin/env node
'use strict';

var kicadTools = require('../');
var optimist = require('optimist');
var prompt = require('prompt');

var args = optimist
  .demand('out', 'in')
  .alias('h', 'help')
  .alias('h', '?')
  .options('out', {
    alias: 'o',
    describe: 'Output file name.'
  })
  .options('in', {
    alias: 'i',
    describe: 'Input file with a list of files to join.'
  })
  .options('basedir', {
    describe: 'Base directory.'
  })
  .argv;

if (args.help) {
  optimist.showHelp();
  return process.exit(1);
}

console.log('Joining to', args.out);
kicadTools.join(args, function(err) {
  if (err) {
    console.error(err.stack);
    if (err.cause) {
      console.error(err.cause.stack);
    }
    return process.exit(1);
  }
  console.log('Join complete');
  return process.exit(0);
});