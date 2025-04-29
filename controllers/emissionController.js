const db = require('../config/db.config');

// Lấy Tổng phát thải theo tàu kèm trọng tải và công suất
exports.getTotalEmissionsByShip = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT 
        ship_name, 
        MAX(tonnage) AS tonnage, 
        MAX(main_engine_power) AS main_engine_power, 
        MAX(auxiliary_engine_power) AS auxiliary_engine_power,
        SUM(total_emission) AS total_emission
      FROM emission_estimations
      GROUP BY ship_name
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi lấy tổng phát thải:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};


// Lấy toàn bộ dữ liệu từ emission_estimations
exports.getSummaryData = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT * FROM emission_estimations
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi lấy dữ liệu emission_estimations:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Tổng hợp phát thải toàn bộ các giai đoạn
exports.getCombinedSummary = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT ship_name AS 'Tên tàu', 'Hành trình' AS 'Giai đoạn', 'Chính' AS 'Động cơ',
        ef_main_NOx AS 'NOx', ef_main_PM10 AS 'PM10', ef_main_PM25 AS 'PM2.5',
        ef_main_HC AS 'HC', ef_main_CO AS 'CO', ef_main_CO2 AS 'CO2',
        ef_main_SOx AS 'SOx', ef_main_N2O AS 'N2O', ef_main_CH4 AS 'CH4',
        emission_cruising_main_total AS 'Tổng'
      FROM emission_estimations
      
      UNION ALL

      SELECT ship_name AS 'Tên tàu', 'Điều động' AS 'Giai đoạn', 'Chính' AS 'Động cơ',
        ef_main_NOx, ef_main_PM10, ef_main_PM25,
        ef_main_HC, ef_main_CO, ef_main_CO2,
        ef_main_SOx, ef_main_N2O, ef_main_CH4,
        emission_maneuvering_main_total
      FROM emission_estimations

      UNION ALL

      SELECT ship_name AS 'Tên tàu', 'Hành trình' AS 'Giai đoạn', 'Phụ' AS 'Động cơ',
        ef_aux_NOx, ef_aux_PM10, ef_aux_PM25,
        ef_aux_HC, ef_aux_CO, ef_aux_CO2,
        ef_aux_SOx, ef_aux_N2O, ef_aux_CH4,
        emission_cruising_aux_total
      FROM emission_estimations

      UNION ALL

      SELECT ship_name AS 'Tên tàu', 'Điều động' AS 'Giai đoạn', 'Phụ' AS 'Động cơ',
        ef_aux_NOx, ef_aux_PM10, ef_aux_PM25,
        ef_aux_HC, ef_aux_CO, ef_aux_CO2,
        ef_aux_SOx, ef_aux_N2O, ef_aux_CH4,
        emission_maneuvering_aux_total
      FROM emission_estimations

      UNION ALL

      SELECT ship_name AS 'Tên tàu', 'Neo đậu' AS 'Giai đoạn', 'Phụ' AS 'Động cơ',
        ef_aux_NOx, ef_aux_PM10, ef_aux_PM25,
        ef_aux_HC, ef_aux_CO, ef_aux_CO2,
        ef_aux_SOx, ef_aux_N2O, ef_aux_CH4,
        emission_anchorage_aux_total
      FROM emission_estimations
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi lấy tổng hợp phát thải:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};



// Máy chính - Hành trình
exports.getMainEngineCruising = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT ship_name AS 'Tên tàu', 'Hành trình' AS 'Giai đoạn', 'Chính' AS 'Động cơ',
        ef_main_NOx AS 'NOx', ef_main_PM10 AS 'PM10', ef_main_PM25 AS 'PM2.5',
        ef_main_HC AS 'HC', ef_main_CO AS 'CO', ef_main_CO2 AS 'CO2',
        ef_main_SOx AS 'SOx', ef_main_N2O AS 'N2O', ef_main_CH4 AS 'CH4',
        emission_cruising_main_total AS 'Tổng'
      FROM emission_estimations
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi máy chính hành trình:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Máy chính - Điều động
exports.getMainEngineManeuvering = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT ship_name AS 'Tên tàu', 'Điều động' AS 'Giai đoạn', 'Chính' AS 'Động cơ',
        ef_main_NOx AS 'NOx', ef_main_PM10 AS 'PM10', ef_main_PM25 AS 'PM2.5',
        ef_main_HC AS 'HC', ef_main_CO AS 'CO', ef_main_CO2 AS 'CO2',
        ef_main_SOx AS 'SOx', ef_main_N2O AS 'N2O', ef_main_CH4 AS 'CH4',
        emission_maneuvering_main_total AS 'Tổng'
      FROM emission_estimations
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi máy chính điều động:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Máy phụ - Hành trình
exports.getAuxEngineCruising = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT ship_name AS 'Tên tàu', 'Hành trình' AS 'Giai đoạn', 'Phụ' AS 'Động cơ',
        ef_aux_NOx AS 'NOx', ef_aux_PM10 AS 'PM10', ef_aux_PM25 AS 'PM2.5',
        ef_aux_HC AS 'HC', ef_aux_CO AS 'CO', ef_aux_CO2 AS 'CO2',
        ef_aux_SOx AS 'SOx', ef_aux_N2O AS 'N2O', ef_aux_CH4 AS 'CH4',
        emission_cruising_aux_total AS 'Tổng'
      FROM emission_estimations
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi máy phụ hành trình:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Máy phụ - Điều động
exports.getAuxEngineManeuvering = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT ship_name AS 'Tên tàu', 'Điều động' AS 'Giai đoạn', 'Phụ' AS 'Động cơ',
        ef_aux_NOx AS 'NOx', ef_aux_PM10 AS 'PM10', ef_aux_PM25 AS 'PM2.5',
        ef_aux_HC AS 'HC', ef_aux_CO AS 'CO', ef_aux_CO2 AS 'CO2',
        ef_aux_SOx AS 'SOx', ef_aux_N2O AS 'N2O', ef_aux_CH4 AS 'CH4',
        emission_maneuvering_aux_total AS 'Tổng'
      FROM emission_estimations
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi máy phụ điều động:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Máy phụ - Neo đậu
exports.getAuxEngineAnchorage = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT ship_name AS 'Tên tàu', 'Neo đậu' AS 'Giai đoạn', 'Phụ' AS 'Động cơ',
        ef_aux_NOx AS 'NOx', ef_aux_PM10 AS 'PM10', ef_aux_PM25 AS 'PM2.5',
        ef_aux_HC AS 'HC', ef_aux_CO AS 'CO', ef_aux_CO2 AS 'CO2',
        ef_aux_SOx AS 'SOx', ef_aux_N2O AS 'N2O', ef_aux_CH4 AS 'CH4',
        emission_anchorage_aux_total AS 'Tổng'
      FROM emission_estimations
    `);
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi máy phụ neo đậu:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
