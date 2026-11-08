export const logger = {
  info: (message, meta = '') => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, meta ? meta : '');
  },
  warn: (message, meta = '') => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, meta ? meta : '');
  },
  error: (message, meta = '') => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, meta ? meta : '');
  },
  debug: (message, meta = '') => {
    if (process.env.DEBUG === 'true') {
      console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`, meta ? meta : '');
    }
  }
};
