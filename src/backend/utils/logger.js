/**
 * Winston logger — structured JSON in production, coloured in dev.
 */

const { createLogger, format, transports } = require('winston');

const isProduction = process.env.APP_ENV === 'production';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction
    ? format.combine(format.timestamp(), format.json())
    : format.combine(
        format.colorize(),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.printf(({ level, message, timestamp }) => `${timestamp} [${level}] ${message}`)
      ),
  transports: [new transports.Console()],
});

module.exports = logger;
