#!/usr/bin/env node

// -------- CLI Entry Point --------

import { Command } from 'commander';
import { registerTransferCommand } from './commands/transfer.js';
import { registerMigrateCommand } from './commands/migrate.js';
import { registerSyncMetadataCommand } from './commands/sync-metadata.js';
import { registerVerifyCommand } from './commands/verify.js';
import { registerValidateCommand } from './commands/validate/index.js';
import { registerStatusCommand } from './commands/status/index.js';
import { registerResetCommand } from './commands/reset/index.js';
import { registerTestCommand } from './commands/test-connection/index.js';

const program = new Command();

program
  .name('cloudvoyager')
  .description('CloudVoyager CLI — Migrate data from SonarQube to SonarCloud')
  .version('1.1.2');

registerTransferCommand(program);
registerMigrateCommand(program);
registerSyncMetadataCommand(program);
registerVerifyCommand(program);
registerValidateCommand(program);
registerStatusCommand(program);
registerResetCommand(program);
registerTestCommand(program);

program.parse();
