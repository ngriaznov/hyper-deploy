const winston = require("winston");
require("winston-daily-rotate-file");

const { format, } = require("winston");
const { printf } = format;

const createLogger = winston.createLogger({
  format: printf(({ level, message, label, timestamp }) => {
    return `${new Date().toISOString()} ${level}: ${message}`;
  }),
  transports: [
    new winston.transports.Console({
      colorize: true,
    }),
    new winston.transports.DailyRotateFile({
      name: "access-file",
      level: "info",
      filename: "./logs/application-%DATE%.log",
      json: false,
      datePattern: "YYYY-MM-DD",
      prepend: true,
      maxFiles: "14d",
    }),
    new winston.transports.DailyRotateFile({
      name: "error-file",
      level: "error",
      filename: "./logs/error-%DATE%.log",
      json: false,
      datePattern: "YYYY-MM-DD",
      prepend: true,
      maxFiles: "14d",
    }),
  ],
});

module.exports = {
  logger: createLogger,
};
