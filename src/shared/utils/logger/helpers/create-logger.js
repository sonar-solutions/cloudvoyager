// -------- Create Logger Instance --------
import winston from 'winston';
import { logFormat, baseFormat } from './log-format.js';

const { combine, timestamp, colorize } = winston.format;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: baseFormat,
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    })
  ]
});

// Add file transport if LOG_FILE environment variable is set
if (process.env.LOG_FILE) {
  logger.add(new winston.transports.File({
    filename: process.env.LOG_FILE,
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
  }));
}

export default logger;
