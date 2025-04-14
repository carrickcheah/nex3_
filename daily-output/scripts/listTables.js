const mysql = require('mysql2/promise');
require('dotenv').config();

async function listTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await connection.execute('SHOW TABLES');
    console.log('Tables in nex_valiant database:');
    console.log('----------------------------');
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row[Object.keys(row)[0]]}`);
    });
  } catch (error) {
    console.error('Error listing tables:', error);
  } finally {
    await connection.end();
  }
}

listTables();
