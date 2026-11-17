"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    format(level, message, meta) {
        const timestamp = new Date().toISOString();
        const metaString = meta ? ` | ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
    }
    info(message, meta) {
        console.log(this.format('info', message, meta));
    }
    warn(message, meta) {
        console.warn(this.format('warn', message, meta));
    }
    error(message, meta) {
        console.error(this.format('error', message, meta));
    }
    debug(message, meta) {
        if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
            console.debug(this.format('debug', message, meta));
        }
    }
}
exports.logger = new Logger();
