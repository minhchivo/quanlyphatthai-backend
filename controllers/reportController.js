const db = require('../config/db.config');

exports.getReports = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`SELECT * FROM emission_estimations`);

    const transformedData = [];

    rows.forEach((row) => {
      // Hành trình - Máy chính
      transformedData.push({
        ship_name: row.ship_name,
        tonnage: row.tonnage,
        phase: 'Hành trình',
        engine_type: 'Chính',
        ef_NOx: row.ef_main_NOx,
        ef_PM10: row.ef_main_PM10,
        ef_PM25: row.ef_main_PM25,
        ef_HC: row.ef_main_HC,
        ef_CO: row.ef_main_CO,
        ef_CO2: row.ef_main_CO2,
        ef_SOx: row.ef_main_SOx,
        ef_N2O: row.ef_main_N2O,
        ef_CH4: row.ef_main_CH4,
        total_emission: row.emission_cruising_main_total,
      });

      // Hành trình - Máy phụ
      transformedData.push({
        ship_name: row.ship_name,
        tonnage: row.tonnage,
        phase: 'Hành trình',
        engine_type: 'Phụ',
        ef_NOx: row.ef_aux_NOx,
        ef_PM10: row.ef_aux_PM10,
        ef_PM25: row.ef_aux_PM25,
        ef_HC: row.ef_aux_HC,
        ef_CO: row.ef_aux_CO,
        ef_CO2: row.ef_aux_CO2,
        ef_SOx: row.ef_aux_SOx,
        ef_N2O: row.ef_aux_N2O,
        ef_CH4: row.ef_aux_CH4,
        total_emission: row.emission_cruising_aux_total,
      });

      // Điều động - Máy chính
      transformedData.push({
        ship_name: row.ship_name,
        tonnage: row.tonnage,
        phase: 'Điều động',
        engine_type: 'Chính',
        ef_NOx: row.ef_main_NOx,
        ef_PM10: row.ef_main_PM10,
        ef_PM25: row.ef_main_PM25,
        ef_HC: row.ef_main_HC,
        ef_CO: row.ef_main_CO,
        ef_CO2: row.ef_main_CO2,
        ef_SOx: row.ef_main_SOx,
        ef_N2O: row.ef_main_N2O,
        ef_CH4: row.ef_main_CH4,
        total_emission: row.emission_maneuvering_main_total,
      });

      // Điều động - Máy phụ
      transformedData.push({
        ship_name: row.ship_name,
        tonnage: row.tonnage,
        phase: 'Điều động',
        engine_type: 'Phụ',
        ef_NOx: row.ef_aux_NOx,
        ef_PM10: row.ef_aux_PM10,
        ef_PM25: row.ef_aux_PM25,
        ef_HC: row.ef_aux_HC,
        ef_CO: row.ef_aux_CO,
        ef_CO2: row.ef_aux_CO2,
        ef_SOx: row.ef_aux_SOx,
        ef_N2O: row.ef_aux_N2O,
        ef_CH4: row.ef_aux_CH4,
        total_emission: row.emission_maneuvering_aux_total,
      });

      // Neo đậu - Máy phụ (chỉ máy phụ neo đậu mới hoạt động)
      transformedData.push({
        ship_name: row.ship_name,
        tonnage: row.tonnage,
        phase: 'Neo đậu',
        engine_type: 'Phụ',
        ef_NOx: row.ef_aux_NOx,
        ef_PM10: row.ef_aux_PM10,
        ef_PM25: row.ef_aux_PM25,
        ef_HC: row.ef_aux_HC,
        ef_CO: row.ef_aux_CO,
        ef_CO2: row.ef_aux_CO2,
        ef_SOx: row.ef_aux_SOx,
        ef_N2O: row.ef_aux_N2O,
        ef_CH4: row.ef_aux_CH4,
        total_emission: row.emission_anchorage_aux_total,
      });
    });

    res.json(transformedData);
  } catch (error) {
    console.error('❌ Lỗi lấy báo cáo:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
