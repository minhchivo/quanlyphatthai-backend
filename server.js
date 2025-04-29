const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/authRoutes');
const inputDataRoutes = require('./routes/inputDataRoutes');
const calculateEmissionsRoutes = require('./routes/calculateEmissionsRoutes');
const shipRoutes = require('./routes/shipRoutes');
const emissionRoutes = require('./routes/emissionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const inputDataManagerRoutes = require('./routes/inputDataManagerRoutes');














// Kết nối MySQL (dùng mysql2 pool)
const db = require('./config/db.config');

// Kiểm tra kết nối
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Kết nối Database thất bại:', err.message);
  } else {
    console.log('✅ Kết nối Database thành công!');
    connection.release(); // Trả lại connection cho pool
  }
});

// Routes
app.use('/api', authRoutes);
app.use('/api', inputDataRoutes);
app.use('/api', calculateEmissionsRoutes);
app.use('/api/ships', shipRoutes);
app.use('/api/emissions', emissionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', inputDataManagerRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên http://localhost:${PORT}`);
});
