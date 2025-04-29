const db = require('../config/db.config');

// 1. Tổng hợp nhanh
exports.getSummary = async (req, res) => {
  try {
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;

    const [ships] = await db.promise().query(`SELECT COUNT(*) AS totalShips FROM ships`);
    const [emissions] = await db.promise().query(`SELECT SUM(total_emission) AS totalEmissions FROM emission_estimations`);

    const [shipsThisMonth] = await db.promise().query(`
      SELECT COUNT(*) AS shipsThisMonth
      FROM ships
      WHERE MONTH(arrival_time) = ? AND YEAR(arrival_time) = ?
    `, [month, year]);

    const [emissionsThisMonth] = await db.promise().query(`
      SELECT SUM(e.total_emission) AS emissionsThisMonth
      FROM ships s
      JOIN emission_estimations e ON s.ship_name = e.ship_name
      WHERE MONTH(s.arrival_time) = ? AND YEAR(s.arrival_time) = ?
    `, [month, year]);

    res.json({
      totalShips: ships[0].totalShips || 0,
      totalEmissions: emissions[0].totalEmissions || 0,
      shipsThisMonth: shipsThisMonth[0].shipsThisMonth || 0,
      emissionsThisMonth: emissionsThisMonth[0].emissionsThisMonth || 0,
      selectedMonth: month,
      selectedYear: year,
    });
  } catch (error) {
    console.error('❌ Lỗi getSummary:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};


// 2. Số lượt tàu theo ngày
exports.getShipsByDay = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT DATE(arrival_time) as date, COUNT(*) as ship_count
      FROM ships
      GROUP BY DATE(arrival_time)
      ORDER BY date ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi getShipsByDay:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 3. Phát thải theo ngày
exports.getEmissionsByDay = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT DATE(s.arrival_time) as date, SUM(e.total_emission) as emissions
      FROM ships s
      JOIN emission_estimations e ON s.ship_name = e.ship_name
      GROUP BY DATE(s.arrival_time)
      ORDER BY date ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi getEmissionsByDay:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 4. 5 tàu mới nhất
exports.getLatestShips = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT ship_name, arrival_time, departure_time
      FROM ships
      ORDER BY arrival_time DESC
      LIMIT 5
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi getLatestShips:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 5. Số lượt tàu theo tháng
exports.getShipsByMonth = async (req, res) => {
  const { year } = req.query;
  try {
    const [rows] = await db.promise().query(`
      SELECT MONTH(arrival_time) as month, COUNT(*) as ship_count
      FROM ships
      WHERE YEAR(arrival_time) = ?
      GROUP BY MONTH(arrival_time)
      ORDER BY month ASC
    `, [year]);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi getShipsByMonth:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 6. Phát thải theo tháng
exports.getEmissionsByMonth = async (req, res) => {
  const { year } = req.query;
  try {
    const [rows] = await db.promise().query(`
      SELECT MONTH(s.arrival_time) as month, SUM(e.total_emission) as emissions
      FROM ships s
      JOIN emission_estimations e ON s.ship_name = e.ship_name
      WHERE YEAR(s.arrival_time) = ?
      GROUP BY MONTH(s.arrival_time)
      ORDER BY month ASC
    `, [year]);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi getEmissionsByMonth:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// 5. So sánh số lượng tàu và phát thải giữa 2 tháng
// 5. So sánh số lượng tàu và phát thải giữa 2 tháng
exports.compareTwoMonths = async (req, res) => {
  const { year, month1, month2 } = req.query;
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        MONTH(s.arrival_time) AS month,
        COUNT(DISTINCT s.id) AS ship_count,
        SUM(e.total_emission) AS total_emission
      FROM ships s
      JOIN emission_estimations e ON s.ship_name = e.ship_name
      WHERE YEAR(s.arrival_time) = ?
        AND (MONTH(s.arrival_time) = ? OR MONTH(s.arrival_time) = ?)
      GROUP BY MONTH(s.arrival_time)
      ORDER BY MONTH(s.arrival_time)
      `,
      [year, month1, month2]
    );

    // Chuẩn hóa dữ liệu để luôn có đủ 2 tháng
    const result = [
      {
        month: month1,
        ship_count: 0,
        total_emission: 0,
      },
      {
        month: month2,
        ship_count: 0,
        total_emission: 0,
      },
    ];

    for (const row of rows) {
      if (row.month == month1) {
        result[0].ship_count = row.ship_count;
        result[0].total_emission = row.total_emission;
      }
      if (row.month == month2) {
        result[1].ship_count = row.ship_count;
        result[1].total_emission = row.total_emission;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('❌ Lỗi compareTwoMonths:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

