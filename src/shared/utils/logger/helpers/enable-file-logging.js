// -------- Enable File Logging --------
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import logger from './create-logger.js';
import { logFormat } from './log-format.js';

const { combine, timestamp } = winston.format;

function filterByLevel(level) {
  return winston.format((info) => info.level === level ? info : false)();
}

export function enableFileLogging(commandName) {
  const logsDir = path.resolve('migration-output', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const existing = logger.transports.filter(t => t instanceof winston.transports.File);
  for (const t of existing) logger.remove(t);

  const safeName = commandName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fileFormat = combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat);

  const rawLogPath = path.join(logsDir, `cloudvoyager-${safeName}-${ts}.log`);
  const infoLogPath = path.join(logsDir, `cloudvoyager-${safeName}-${ts}.info.log`);
  const warnLogPath = path.join(logsDir, `cloudvoyager-${safeName}-${ts}.warn.log`);
  const errorLogPath = path.join(logsDir, `cloudvoyager-${safeName}-${ts}.error.log`);

  logger.add(new winston.transports.File({
    filename: rawLogPath, level: 'debug',
    format: fileFormat
  }));

  logger.add(new winston.transports.File({
    filename: infoLogPath, level: 'info',
    format: combine(filterByLevel('info'), fileFormat)
  }));

  logger.add(new winston.transports.File({
    filename: warnLogPath, level: 'warn',
    format: combine(filterByLevel('warn'), fileFormat)
  }));

  logger.add(new winston.transports.File({
    filename: errorLogPath, level: 'error',
    format: combine(filterByLevel('error'), fileFormat)
  }));

  logger.info(`Logs directory: ${logsDir}`);
  logger.info(`  Raw logs:   ${rawLogPath}`);
  logger.info(`  Info logs:  ${infoLogPath}`);
  logger.info(`  Warn logs:  ${warnLogPath}`);
  logger.info(`  Error logs: ${errorLogPath}`);
  return { rawLogPath, infoLogPath, warnLogPath, errorLogPath };
}
