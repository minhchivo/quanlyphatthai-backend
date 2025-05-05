require('dotenv').config();
const bcryptjs = require('bcryptjsjs');
const db = require('./config/db.config'); // Kết nối MySQL pool

async function createUser() {
  const username = 'khanh'; // bạn muốn tạo tên user gì thì đổi ở đây
  const plainPassword = '123456'; // mật khẩu gốc

  try {
    // Băm mật khẩu
    const hashedPassword = await bcryptjs.hash(plainPassword, 10);

    // Insert user mới vào database
    db.query(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hashedPassword],
      (err, results) => {
        if (err) {
          console.error('❌ Lỗi khi tạo người dùng:', err.message);
        } else {
          console.log('✅ Tạo người dùng thành công!');
        }
        process.exit(0);
      }
    );
  } catch (error) {
    console.error('❌ Lỗi băm mật khẩu:', error.message);
    process.exit(1);
  }
}

createUser();
