require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,           // Thêm dòng này nếu bạn chưa có
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: true // ⚠️ Bắt buộc khi kết nối qua Railway Public
});

module.exports = db;
