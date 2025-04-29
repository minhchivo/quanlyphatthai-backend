// controllers/inputDataManagerController.js

const db = require('../config/db.config');
const calculateEmissionsController = require('./calculateEmissionsController');

// Lấy danh sách dữ liệu input_data
exports.getAllInputData = async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM input_data ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('❌ Lỗi lấy dữ liệu input_data:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// Xóa 1 dòng input_data và dữ liệu liên quan
exports.deleteInputData = async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [inputRows] = await connection.query('SELECT * FROM input_data WHERE id = ?', [id]);
    if (inputRows.length === 0) {
      throw new Error('Không tìm thấy dữ liệu input_data để xóa.');
    }

    const { ship_name, built_year, arrival_time } = inputRows[0];

    await connection.query('DELETE FROM ships WHERE ship_name = ? AND built_year = ? AND arrival_time = ?', [ship_name, built_year, arrival_time]);
    await connection.query('DELETE FROM summary_data WHERE ship_name = ? AND built_year = ? AND arrival_time = ?', [ship_name, built_year, arrival_time]);
    await connection.query('DELETE FROM emission_estimations WHERE ship_name = ?', [ship_name]);
    await connection.query('DELETE FROM input_data WHERE id = ?', [id]);

    await connection.commit();
    connection.release();
    res.json({ message: '✅ Xóa dữ liệu thành công!' });
  } catch (error) {
    console.error('❌ Lỗi khi xóa dữ liệu:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// Chỉnh sửa 1 dòng input_data và cập nhật lại dữ liệu liên quan
exports.updateInputData = async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    const connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [inputRows] = await connection.query('SELECT * FROM input_data WHERE id = ?', [id]);
    if (inputRows.length === 0) {
      throw new Error('Không tìm thấy dữ liệu input_data để cập nhật.');
    }

    const { ship_name, built_year, arrival_time } = inputRows[0];

    // 1. Cập nhật bảng input_data
    await connection.query('UPDATE input_data SET ? WHERE id = ?', [updatedData, id]);

    // 2. Cập nhật bảng ships
    await connection.query(
      'UPDATE ships SET ? WHERE ship_name = ? AND built_year = ? AND arrival_time = ?',
      [updatedData, ship_name, built_year, arrival_time]
    );

    // 3. Xóa dữ liệu cũ ở summary_data và emission_estimations
    await connection.query('DELETE FROM summary_data WHERE ship_name = ? AND built_year = ? AND arrival_time = ?', [ship_name, built_year, arrival_time]);
    await connection.query('DELETE FROM emission_estimations WHERE ship_name = ?', [ship_name]);

    // 4. Insert lại summary_data từ updatedData

    const arrival = new Date(updatedData.arrival_time);
    const departure = new Date(updatedData.departure_time);
    const totalHours = (departure - arrival) / (1000 * 60 * 60);
    const cruisingHours = totalHours * 0.7;
    const maneuveringHours = totalHours * 0.2;
    const anchorageHours = totalHours * 0.1;

    const cruisingDistance = updatedData.cruising_speed * cruisingHours;
    const maneuveringDistance = updatedData.maneuvering_speed * maneuveringHours;

    const [auxLoadRows] = await connection.query('SELECT * FROM aux_engine_load_factor WHERE ship_type = ? LIMIT 1', [updatedData.ship_type]);
    if (auxLoadRows.length === 0) throw new Error('Không tìm thấy Load Factor phụ trợ cho loại tàu này.');
    const auxLoad = auxLoadRows[0];

    const lf_cruising_main = (updatedData.cruising_speed / updatedData.maximum_speed) ** 3;
    const lf_maneuvering_main = (updatedData.maneuvering_speed / updatedData.maximum_speed) ** 3;
    const lf_cruising_aux = auxLoad.cruising_load_factor;
    const lf_maneuvering_aux = auxLoad.maneuvering_load_factor;
    const lf_anchorage_aux = auxLoad.cargo_operation_load_factor;

    const tier = 'Tier 0';
    const [efRows] = await connection.query('SELECT * FROM emission_factors_by_tier WHERE tier = ?', [tier]);
    if (efRows.length === 0) throw new Error('Không tìm thấy Emission Factor cho Tier này.');

    const emissions = {};
    for (const ef of efRows) {
      const pollutantClean = ef.pollutant.replace('.', '');
      emissions[`ef_main_${pollutantClean}`] = parseFloat(ef.ssd_main_engine || 0);
      emissions[`ef_aux_${pollutantClean}`] = parseFloat(ef.aux_engine || 0);
    }

    await connection.query(`
      INSERT INTO summary_data (
        ship_name, ship_type, tonnage, built_year, pilot_from_buoy,
        arrival_time, departure_time,
        port_time_hours, anchorage_hours,
        cruising_distance, maneuvering_distance,
        cruising_speed, maneuvering_speed, maximum_speed,
        main_engine_power, auxiliary_engine_power, engine_type, engine_speed,
        lf_cruising_main, lf_cruising_aux,
        lf_maneuvering_main, lf_maneuvering_aux,
        lf_anchorage_aux,
        ${Object.keys(emissions).join(', ')},
        tier, record_no
      )
      VALUES (${Array(25 + Object.keys(emissions).length).fill('?').join(', ')})
    `, [
      updatedData.ship_name, updatedData.ship_type, updatedData.tonnage, updatedData.built_year, updatedData.pilot_from_buoy,
      updatedData.arrival_time, updatedData.departure_time,
      totalHours, anchorageHours,
      cruisingDistance, maneuveringDistance,
      updatedData.cruising_speed, updatedData.maneuvering_speed, updatedData.maximum_speed,
      updatedData.main_engine_power, updatedData.auxiliary_engine_power, updatedData.engine_type, updatedData.engine_speed,
      lf_cruising_main, lf_cruising_aux,
      lf_maneuvering_main, lf_maneuvering_aux,
      lf_anchorage_aux,
      ...Object.values(emissions),
      tier, 0
    ]);

    await connection.commit();
    connection.release();

    // 5. Cuối cùng tính lại phát thải cho tất cả tàu
    await calculateEmissionsController.calculateEmissions({ ship_name: updatedData.ship_name }, res);

  } catch (error) {
    console.error('❌ Lỗi khi cập nhật dữ liệu:', error.message);
    res.status(500).json({ message: error.message });
  }
};
