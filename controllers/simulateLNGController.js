const db = require('../config/db.config');

const dbColumnMap = {
  'PM2.5': 'PM25',
  'PM10': 'PM10',
  'NOx': 'NOx',
  'SOx': 'SOx',
  'CO2': 'CO2',
  'CO': 'CO',
  'HC': 'HC',
  'CH4': 'CH4',
  'N2O': 'N2O'
};

exports.simulateLNG = async (req, res) => {
  const { ship_name } = req.body;

  if (!ship_name) {
    return res.status(400).json({ message: 'Vui lòng chọn ship_name.' });
  }

  try {
    const connection = await db.promise().getConnection();

    const [ships] = await connection.query(
      'SELECT * FROM summary_data WHERE ship_name = ? LIMIT 1',
      [ship_name]
    );

    if (ships.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tàu.' });
    }

    const ship = ships[0];
    const {
      main_engine_power, auxiliary_engine_power, engine_speed, tier,
      lf_cruising_main, lf_maneuvering_main,
      lf_cruising_aux, lf_maneuvering_aux, lf_anchorage_aux,
      arrival_time, departure_time
    } = ship;

    const arrival = new Date(arrival_time);
    const departure = new Date(departure_time);
    const totalHours = (departure - arrival) / (1000 * 60 * 60);
    const cruisingHours = totalHours * 0.7;
    const maneuveringHours = totalHours * 0.2;
    const anchorageHours = totalHours * 0.1;

    const pollutants = ['CO2', 'NOx', 'SOx', 'PM10', 'PM2.5', 'CO', 'HC', 'N2O', 'CH4'];

    // 1. Lấy phát thải gốc (đã lưu ở đơn vị kg)
    const [emissions] = await connection.query(
      'SELECT * FROM emission_estimations WHERE ship_name = ? LIMIT 1',
      [ship_name]
    );
    if (emissions.length === 0) {
      return res.status(404).json({ message: 'Không có dữ liệu phát thải gốc.' });
    }

    const original = emissions[0];
    const original_total_grams = {};
    let total_original = 0;

    for (const pol of pollutants) {
      const dbPol = dbColumnMap[pol] || pol;
      const value =
        (original[`emission_cruising_main_${dbPol}`] || 0) +
        (original[`emission_maneuvering_main_${dbPol}`] || 0) +
        (original[`emission_cruising_aux_${dbPol}`] || 0) +
        (original[`emission_maneuvering_aux_${dbPol}`] || 0) +
        (original[`emission_anchorage_aux_${dbPol}`] || 0);
    
        original_total_grams[pol] = parseFloat(value.toFixed(2)); // giữ nguyên kg
        total_original += value; // giữ nguyên kg
        
    }
    

    // 2. Mô phỏng LNG 100 (ef: g/kWh → cần chia 1000 để về kg)
    const lng100 = {};
    let total_lng100 = 0;

    for (const pol of pollutants) {
      const [rows] = await connection.query(
        'SELECT * FROM emission_factors_lng_100 WHERE pollutant = ? LIMIT 1',
        [pol]
      );
      let value = 0;
      if (rows.length) {
        const efMain = parseFloat(rows[0].main_engine || 0);
        const efAux = parseFloat(rows[0].aux_engine || 0);

        const mainEmission =
          main_engine_power * lf_cruising_main * cruisingHours * efMain +
          main_engine_power * lf_maneuvering_main * maneuveringHours * efMain;

        const auxEmission =
          auxiliary_engine_power * lf_cruising_aux * cruisingHours * efAux +
          auxiliary_engine_power * lf_maneuvering_aux * maneuveringHours * efAux +
          auxiliary_engine_power * lf_anchorage_aux * anchorageHours * efAux;

        value = mainEmission + auxEmission;
      }

      // ✳️ Chia 1000 vì ef đang ở g/kWh → về kg
      lng100[pol] = parseFloat((value / 1000).toFixed(2)); // kg
      total_lng100 += value / 1000;
    }

    // 3. Mô phỏng LNG MGO
    const lngMGO = {};
    let total_lngMGO = 0;
    const engineType = engine_speed < 130 ? 'ssd_main_engine' : 'msd_main_engine';

    for (const pol of pollutants) {
      const [rows] = await connection.query(
        'SELECT * FROM emission_factors_lng_mgo_by_engine_type WHERE tier = ? AND pollutant = ? LIMIT 1',
        [tier, pol]
      );
      let value = 0;
      if (rows.length) {
        const efMain = parseFloat(rows[0][engineType] || 0);
        const efAux = parseFloat(rows[0].aux_engine || 0);

        const mainEmission =
          main_engine_power * lf_cruising_main * cruisingHours * efMain +
          main_engine_power * lf_maneuvering_main * maneuveringHours * efMain;

        const auxEmission =
          auxiliary_engine_power * lf_cruising_aux * cruisingHours * efAux +
          auxiliary_engine_power * lf_maneuvering_aux * maneuveringHours * efAux +
          auxiliary_engine_power * lf_anchorage_aux * anchorageHours * efAux;

        value = mainEmission + auxEmission;
      }

      lngMGO[pol] = parseFloat((value / 1000).toFixed(2)); // kg
      total_lngMGO += value / 1000;
    }

    connection.release();

    res.json({
      ship_name,
      original: original_total_grams, // đơn vị: g
      lng_100: lng100,                // đơn vị: kg
      lng_mgo: lngMGO,                // đơn vị: kg
      total_emissions: {
        original: parseFloat(total_original.toFixed(2)),   // g
        lng_100: parseFloat(total_lng100.toFixed(2)),       // kg
        lng_mgo: parseFloat(total_lngMGO.toFixed(2))        // kg
      }
    });
  } catch (error) {
    console.error('❌ Lỗi mô phỏng LNG:', error.message);
    res.status(500).json({ message: error.message });
  }
};
