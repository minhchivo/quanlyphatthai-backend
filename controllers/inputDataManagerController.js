// controllers/inputDataManagerController.js

const db = require('../config/db.config');
const calculateEmissionsController = require('./calculateEmissionsController');

// Hàm normalize thời gian, không trừ 7 giờ nữa
const normalizeTime = (time) => {
  const date = new Date(time);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};


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

    const { ship_name } = inputRows[0];

    // Xóa dữ liệu liên quan đến tàu này
    await connection.query('DELETE FROM ships WHERE ship_name = ?', [ship_name]);
    await connection.query('DELETE FROM summary_data WHERE ship_name = ?', [ship_name]);
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


// Cập nhật dữ liệu input_data
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

    const { ship_name, built_year } = inputRows[0];

    // Không cần trừ 7 giờ nữa, chỉ cần chuẩn hóa định dạng thời gian
    updatedData.arrival_time = normalizeTime(updatedData.arrival_time);
    updatedData.departure_time = normalizeTime(updatedData.departure_time);

    // Cập nhật bảng input_data
    await connection.query('UPDATE input_data SET ? WHERE id = ?', [updatedData, id]);

    // Cập nhật bảng ships
    await connection.query('UPDATE ships SET ? WHERE ship_name = ? AND built_year = ?', [updatedData, ship_name, built_year]);

    // Tính toán lại dữ liệu
    const arrival = new Date(updatedData.arrival_time);
    const departure = new Date(updatedData.departure_time);
    const totalHours = (departure - arrival) / (1000 * 60 * 60);

    const [cruiseRow] = await connection.query(
      'SELECT SUM(cruising_distance) AS total_cruising FROM operation_stages_mipec WHERE point = ?',
      [updatedData.pilot_from_buoy]
    );

    const [manRow] = await connection.query(
      'SELECT SUM(maneuvering_distance) AS total_maneuvering FROM operation_stages_mipec WHERE point = ?',
      [updatedData.pilot_from_buoy]
    );

    const total_cruising_nm = cruiseRow[0].total_cruising || 0;
    const total_maneuvering_nm = manRow[0].total_maneuvering || 0;

    const cruising_distance = (total_cruising_nm / parseFloat(updatedData.cruising_speed)) * 2;
    const maneuvering_distance = (total_maneuvering_nm / parseFloat(updatedData.maneuvering_speed)) * 2;

    const cruisingHours = cruising_distance;
    const maneuveringHours = maneuvering_distance;
    const anchorageHours = totalHours - cruisingHours - maneuveringHours;

    const [auxLoadRows] = await connection.query(
      'SELECT * FROM aux_engine_load_factor WHERE ship_type = ? LIMIT 1',
      [updatedData.ship_type]
    );
    if (auxLoadRows.length === 0) throw new Error('Không tìm thấy Load Factor phụ trợ cho loại tàu này.');
    const auxLoad = auxLoadRows[0];

    const lf_cruising_main = (updatedData.cruising_speed / updatedData.maximum_speed) ** 3;
    const lf_maneuvering_main = (updatedData.maneuvering_speed / updatedData.maximum_speed) ** 3;
    const lf_cruising_aux = auxLoad.cruising_load_factor;
    const lf_maneuvering_aux = auxLoad.maneuvering_load_factor;
    const lf_anchorage_aux = auxLoad.cargo_operation_load_factor;

    const tier = 'Tier 0';
    const [efRows] = await connection.query(
      'SELECT * FROM emission_factors_by_tier WHERE tier = ?',
      [tier]
    );
    if (efRows.length === 0) throw new Error('Không tìm thấy Emission Factor cho Tier này.');

    const emissions = {};
    for (const ef of efRows) {
      const pollutantClean = ef.pollutant.replace('.', '');
      emissions[`ef_main_${pollutantClean}`] = parseFloat(ef.ssd_main_engine || 0);
      emissions[`ef_aux_${pollutantClean}`] = parseFloat(ef.aux_engine || 0);
    }

    // Cập nhật bảng summary_data
    await connection.query(`UPDATE summary_data SET
      port_time_hours = ?, anchorage_hours = ?,
      cruising_distance = ?, maneuvering_distance = ?,
      lf_cruising_main = ?, lf_cruising_aux = ?,
      lf_maneuvering_main = ?, lf_maneuvering_aux = ?,
      lf_anchorage_aux = ?,
      ${Object.keys(emissions).map(key => `${key} = ?`).join(', ')}
      WHERE ship_name = ? AND built_year = ?`,
      [
        totalHours, anchorageHours,
        cruising_distance, maneuvering_distance,
        lf_cruising_main, lf_cruising_aux,
        lf_maneuvering_main, lf_maneuvering_aux,
        lf_anchorage_aux,
        ...Object.values(emissions),
        ship_name, built_year
      ]
    );

    await connection.commit();
    connection.release();

    res.json({ message: '✅ Cập nhật dữ liệu thành công!' });

  } catch (error) {
    console.error('❌ Lỗi khi cập nhật dữ liệu:', error.message);
    res.status(500).json({ message: error.message });
  }
};

