// -------- Log Format --------
import winston from 'winston';

const { combine, timestamp, printf, errors } = winston.format;

export const logFormat = printf(({ level, message, timestamp, stack }) => {
  if (stack) return `${timestamp} [${level}]: ${message}\n${stack}`;
  return `${timestamp} [${level}]: ${message}`;
});

export const baseFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  logFormat
);
