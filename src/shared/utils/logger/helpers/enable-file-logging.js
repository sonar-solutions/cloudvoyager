// -------- Enable File Logging --------
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import logger from './create-logger.js';
import { logFormat } from './log-format.js';

const { combine, timestamp } = winston.format;

export function enableFileLogging(commandName) {
  const logsDir = path.resolve('migration-output', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  // Remove existing file transports to prevent duplicates
  const existing = logger.transports.filter(t => t instanceof winston.transports.File);
  for (const t of existing) logger.remove(t);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `cloudvoyager-${commandName}-${ts}.log`;
  const logFilePath = path.join(logsDir, logFileName);

  logger.add(new winston.transports.File({
    filename: logFilePath, level: 'debug',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
  }));

  logger.info(`Full logs will be written to: ${logFilePath}`);
  return logFilePath;
}
