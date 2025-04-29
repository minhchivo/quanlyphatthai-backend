const db = require('../config/db.config');

// Lấy danh sách tàu (tên, loại, trọng tải, ngày đến, ngày đi)
exports.getShips = async (req, res) => {
  try {
    let query = `
      SELECT 
        id,
        ship_name, 
        ship_type,
        tonnage,
        arrival_time,
        departure_time
      FROM ships
    `;
    const params = [];

    if (req.query.startDate && req.query.endDate) {
      query += ` WHERE DATE(arrival_time) BETWEEN ? AND ?`;
      params.push(req.query.startDate, req.query.endDate);
    }

    const [ships] = await db.promise().query(query, params);
    res.json(ships);
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách tàu:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};


// Lấy thông tin chi tiết của 1 tàu
exports.getShipById = async (req, res) => {
  try {
    const { id } = req.params;
    const [ship] = await db.promise().query(`SELECT * FROM ships WHERE id = ?`, [id]);
    if (ship.length > 0) {
      res.json(ship[0]);
    } else {
      res.status(404).json({ message: 'Không tìm thấy tàu' });
    }
  } catch (error) {
    console.error('❌ Lỗi khi lấy chi tiết tàu:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};


// 🆕 Lấy dữ liệu tổng hợp từ summary_data
exports.getSummaryData = async (req, res) => {
  try {
    const [summary] = await db.promise().query('SELECT * FROM summary_data');
    res.json(summary);
  } catch (error) {
    console.error('❌ Lỗi lấy dữ liệu tổng hợp:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};