#!/usr/bin/env node
const { program } = require('commander');

program
  .version('1.0.0')
  .description('Safari AI Dev Studio CLI');

program
  .command('create <project>')
  .description('Create a new project')
  .action((project) => {
    console.log(`Creating project ${project}...`);
  });

program
  .command('run auto')
  .description('Run AI in autonomous mode')
  .action(() => {
    console.log('Starting autonomous AI execution...');
  });

program.parse(process.argv);
