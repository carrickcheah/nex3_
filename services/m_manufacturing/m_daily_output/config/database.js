const path = require('path');

// Import the pool from the central database config
const pool = require(path.join(__dirname, '../../../config/database'));

// Export the pool for use in other modules
module.exports = pool;
