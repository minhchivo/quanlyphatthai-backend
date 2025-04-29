const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/db.config');

exports.login = (req, res) => {
  const { username, password } = req.body;

  const sql = 'SELECT * FROM users WHERE username = ? LIMIT 1';
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error('Lỗi truy vấn:', err);
      return res.status(500).json({ message: 'Lỗi server' });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: 'Tên đăng nhập không tồn tại' });
    }

    const user = results[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Mật khẩu không đúng' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.json({ token }); // 🔥 Trả đúng định dạng frontend cần
  });
};
