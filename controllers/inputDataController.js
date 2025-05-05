const db = require('../config/db.config');

exports.inputData = async (req, res) => {
  const {
    ship_name, ship_type, tonnage, built_year, pilot_from_buoy,
    arrival_time, departure_time,
    cruising_speed, maneuvering_speed, maximum_speed,
    main_engine_power, auxiliary_engine_power, engine_type, engine_speed
  } = req.body;

  let tier = '';
  if (built_year <= 1999) tier = 'Tier 0';
  else if (built_year <= 2011) tier = 'Tier 1';
  else if (built_year <= 2016) tier = 'Tier 2';
  else tier = 'Tier 3';

  try {
    const connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const insertValues = [
      ship_name, ship_type, tonnage, built_year, pilot_from_buoy,
      arrival_time, departure_time, cruising_speed, maneuvering_speed,
      maximum_speed, main_engine_power, auxiliary_engine_power, engine_type, engine_speed
    ];

    await connection.query(`
      INSERT INTO ships (
        ship_name, ship_type, tonnage, built_year, pilot_from_buoy,
        arrival_time, departure_time, cruising_speed, maneuvering_speed,
        maximum_speed, main_engine_power, auxiliary_engine_power, engine_type, engine_speed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, insertValues
    );

    await connection.query(`
      INSERT INTO input_data (
        ship_name, ship_type, tonnage, built_year, pilot_from_buoy,
        arrival_time, departure_time, cruising_speed, maneuvering_speed,
        maximum_speed, main_engine_power, auxiliary_engine_power, engine_type, engine_speed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, insertValues
    );

    const arrival = new Date(arrival_time);
    const departure = new Date(departure_time);
    const port_time_hours = (departure - arrival) / (1000 * 60 * 60);

    const [[{ total_cruising = 0 }]] = await connection.query(
      'SELECT SUM(cruising_distance) AS total_cruising FROM operation_stages_mipec WHERE point <= ?',
      [pilot_from_buoy]
    );

    const [[{ total_maneuvering = 0 }]] = await connection.query(
      'SELECT SUM(maneuvering_distance) AS total_maneuvering FROM operation_stages_mipec WHERE point <= ?',
      [pilot_from_buoy]
    );

// Lưu bản gốc (quãng đường) nếu cần
const total_cruising_nm = total_cruising;
const total_maneuvering_nm = total_maneuvering;

// ⚠️ Tính giờ từ quãng đường: (quãng đường / vận tốc) * 2
const cruising_distance = (total_cruising_nm / parseFloat(cruising_speed)) * 2;
const maneuvering_distance = (total_maneuvering_nm / parseFloat(maneuvering_speed)) * 2;

const cruising_hours = cruising_distance;
const maneuvering_hours = maneuvering_distance;
const anchorage_hours = port_time_hours - cruising_hours - maneuvering_hours;


    



    const [auxLoadRows] = await connection.query(
      'SELECT * FROM aux_engine_load_factor WHERE ship_type = ? LIMIT 1',
      [ship_type]
    );
    if (auxLoadRows.length === 0) throw new Error('Không tìm thấy Load Factor phụ trợ cho loại tàu này.');
    const auxLoad = auxLoadRows[0];

    const [efRows] = await connection.query(
      'SELECT * FROM emission_factors_by_tier WHERE tier = ?',
      [tier]
    );
    if (efRows.length === 0) throw new Error('Không tìm thấy Emission Factor cho Tier này.');

    const lf_cruising_main = (cruising_speed / maximum_speed) ** 3;
    const lf_maneuvering_main = (maneuvering_speed / maximum_speed) ** 3;
    const lf_cruising_aux = auxLoad.cruising_load_factor;
    const lf_maneuvering_aux = auxLoad.maneuvering_load_factor;
    const lf_anchorage_aux = auxLoad.cargo_operation_load_factor;

    const emissions = {};
    for (const ef of efRows) {
      const pol = ef.pollutant.replace('.', '');
      emissions[`ef_main_${pol}`] = parseFloat(ef.ssd_main_engine || 0);
      emissions[`ef_aux_${pol}`] = parseFloat(ef.aux_engine || 0);
    }

    const summaryFields = [
      'ship_name', 'ship_type', 'tonnage', 'built_year', 'pilot_from_buoy',
      'arrival_time', 'departure_time',
      'port_time_hours', 'anchorage_hours',
      'cruising_distance', 'maneuvering_distance',
      'cruising_speed', 'maneuvering_speed', 'maximum_speed',
      'main_engine_power', 'auxiliary_engine_power', 'engine_type', 'engine_speed',
      'lf_cruising_main', 'lf_cruising_aux',
      'lf_maneuvering_main', 'lf_maneuvering_aux',
      'lf_anchorage_aux',
      ...Object.keys(emissions),
      'tier', 'record_no'
    ];

    const summaryValues = [
      ship_name, ship_type, tonnage, built_year, pilot_from_buoy,
      arrival_time, departure_time,
      port_time_hours, anchorage_hours,
      cruising_distance, maneuvering_distance,
      cruising_speed, maneuvering_speed, maximum_speed,
      main_engine_power, auxiliary_engine_power, engine_type, engine_speed,
      lf_cruising_main, lf_cruising_aux,
      lf_maneuvering_main, lf_maneuvering_aux,
      lf_anchorage_aux,
      ...Object.values(emissions),
      tier, 0
    ];

    await connection.query(`
      INSERT INTO summary_data (${summaryFields.join(', ')})
      VALUES (${summaryFields.map(() => '?').join(', ')})`, summaryValues
    );

    await connection.commit();
    connection.release();

    res.json({ message: '✅ Nhập dữ liệu và lưu vào summary_data thành công!' });

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    res.status(500).json({ message: error.message });
  }
};
