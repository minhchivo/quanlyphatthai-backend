const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ message: 'Không có token, từ chối truy cập' });
  }

  const token = authHeader.split(' ')[1]; // Tách Bearer token

  if (!token) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu thông tin user vào req.user để dùng sau
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};
