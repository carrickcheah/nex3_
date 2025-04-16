const moment = require('moment');

/**
 * Convert SQL date format (YYYY-MM-DD) to display format (DD-MM-YYYY)
 * @param {string} sqlDate - Date in SQL format YYYY-MM-DD
 * @returns {string} - Date in display format DD-MM-YYYY
 */
exports.sql2date = function(sqlDate) {
    if (!sqlDate) return '';
    return moment(sqlDate).format('DD-MM-YYYY');
};

/**
 * Convert display date format (DD-MM-YYYY) to SQL format (YYYY-MM-DD)
 * @param {string} displayDate - Date in display format DD-MM-YYYY
 * @returns {string} - Date in SQL format YYYY-MM-DD
 */
exports.date2sql = function(displayDate) {
    if (!displayDate) return '';
    return moment(displayDate, 'DD-MM-YYYY').format('YYYY-MM-DD');
};

/**
 * Get the current date in display format (DD-MM-YYYY)
 * @returns {string} - Current date in display format
 */
exports.getCurrentDate = function() {
    return moment().format('DD-MM-YYYY');
};

/**
 * Get the current date in SQL format (YYYY-MM-DD)
 * @returns {string} - Current date in SQL format
 */
exports.getCurrentSqlDate = function() {
    return moment().format('YYYY-MM-DD');
};

/**
 * Format date and time for display
 * @param {string} datetime - Date and time to format
 * @returns {string} - Formatted date and time
 */
exports.formatDateTime = function(datetime) {
    if (!datetime) return '';
    return moment(datetime).format('DD-MM-YYYY HH:mm:ss');
};

/**
 * Format time for display
 * @param {string} time - Time to format
 * @returns {string} - Formatted time
 */
exports.formatTime = function(time) {
    if (!time) return '';
    return moment(time, 'HH:mm:ss').format('HH:mm');
};

/**
 * Calculate the difference between two times in minutes
 * @param {string} startTime - Start time in format HH:mm:ss
 * @param {string} endTime - End time in format HH:mm:ss
 * @returns {number} - Difference in minutes
 */
exports.timeDiffInMinutes = function(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    
    const start = moment(startTime, 'HH:mm:ss');
    const end = moment(endTime, 'HH:mm:ss');
    
    // Handle case where end time is the next day
    if (end.isBefore(start)) {
        end.add(1, 'day');
    }
    
    return end.diff(start, 'minutes');
};

/**
 * Generate a key for action tracking
 * @param {number} id - Transaction ID
 * @param {string} mode - Transaction mode
 * @returns {string} - Action key
 */
exports.keyHelper = function(id, mode) {
    return `${mode}_${id}_${Date.now()}`;
};

module.exports = exports;
