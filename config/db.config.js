require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+07:00',
  ssl: {
    rejectUnauthorized: false // ✅ Cho phép chứng chỉ tự ký
  }

});



module.exports = db;
