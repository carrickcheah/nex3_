/**
 * Simple logger module for the application
 */
const logger = {
  info: function(message, data) {
    console.log(`[INFO] ${message}`, data || '');
  },
  error: function(message, error) {
    console.error(`[ERROR] ${message}`, error || '');
  },
  warn: function(message, data) {
    console.warn(`[WARNING] ${message}`, data || '');
  },
  debug: function(message, data) {
    console.debug(`[DEBUG] ${message}`, data || '');
  }
};

module.exports = logger; 