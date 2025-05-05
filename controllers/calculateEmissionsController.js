const db = require('../config/db.config');

exports.calculateEmissions = async (req, res) => {
  try {
    const connection = await db.promise().getConnection();
    await connection.beginTransaction();

    let shipsQuery = 'SELECT * FROM summary_data';
    let queryParams = [];
    if (req.ship_name) {
      shipsQuery += ' WHERE ship_name = ?';
      queryParams.push(req.ship_name);
    }

    const [ships] = await connection.query(shipsQuery, queryParams);
    if (ships.length === 0) throw new Error('Không có dữ liệu trong summary_data.');

    for (const ship of ships) {
      const {
        ship_name, arrival_time, departure_time,
        main_engine_power, auxiliary_engine_power,
        engine_speed, tonnage, tier,
        lf_cruising_main, lf_maneuvering_main,
        lf_cruising_aux, lf_maneuvering_aux, lf_anchorage_aux
      } = ship;

      const arrival = new Date(arrival_time);
      const departure = new Date(departure_time);
      const totalHours = (departure - arrival) / (1000 * 60 * 60);

      const cruisingHours = ship.cruising_distance;
      const maneuveringHours = ship.maneuvering_distance;

      const anchorageHours = ship.anchorage_hours;

      const pollutants = ['NOx', 'PM10', 'PM25', 'HC', 'CO', 'CO2', 'SOx', 'N2O', 'CH4'];
      let efMain = {}, efAux = {}, fields = [], values = [];

      // --- Thông tin cơ bản ---
      fields.push('ship_name', 'main_engine_power', 'auxiliary_engine_power', 'tonnage');
      values.push(ship_name, main_engine_power, auxiliary_engine_power, tonnage);

      fields.push('time_at_cruising', 'time_at_maneuvering', 'time_at_anchorage');
      values.push(cruisingHours, maneuveringHours, anchorageHours);

      // --- Lấy EF ---
      for (const pol of pollutants) {
        const polDB = pol === 'PM25' ? 'PM2.5' : pol;
        const [efRow] = await connection.query(
          'SELECT * FROM emission_factors_by_tier WHERE tier = ? AND pollutant = ? LIMIT 1',
          [tier, polDB]
        );
        if (efRow.length === 0) throw new Error(`Không tìm thấy emission factor cho ${pol}`);

        efMain[pol] = engine_speed < 130 ? parseFloat(efRow[0].ssd_main_engine) : parseFloat(efRow[0].msd_main_engine);
        efAux[pol] = parseFloat(efRow[0].aux_engine);

        fields.push(`ef_main_${pol}`, `ef_aux_${pol}`);
        values.push(efMain[pol], efAux[pol]);
      }

      // --- Tính phát thải ---
      const emissionResults = {};
      for (const pol of pollutants) {
        emissionResults[`emission_cruising_main_${pol}`] = main_engine_power * cruisingHours * lf_cruising_main * efMain[pol];
        emissionResults[`emission_cruising_aux_${pol}`] = auxiliary_engine_power * cruisingHours * lf_cruising_aux * efAux[pol];
        emissionResults[`emission_maneuvering_main_${pol}`] = main_engine_power * maneuveringHours * lf_maneuvering_main * efMain[pol];
        emissionResults[`emission_maneuvering_aux_${pol}`] = auxiliary_engine_power * maneuveringHours * lf_maneuvering_aux * efAux[pol];
        emissionResults[`emission_anchorage_aux_${pol}`] = auxiliary_engine_power * anchorageHours * lf_anchorage_aux * efAux[pol];
      }

      let total_emission = 0;
      for (const [key, value] of Object.entries(emissionResults)) {
        const valueInKg = value / 1000;
        fields.push(key);
        values.push(valueInKg);
        total_emission += valueInKg;
      }

      // --- Tổng từng giai đoạn ---
      const sumPhase = (prefix) =>
        pollutants.reduce((sum, pol) => sum + (emissionResults[`${prefix}_${pol}`] || 0), 0) / 1000;

      const emission_cruising_main_total = sumPhase('emission_cruising_main');
      const emission_cruising_aux_total = sumPhase('emission_cruising_aux');
      const emission_maneuvering_main_total = sumPhase('emission_maneuvering_main');
      const emission_maneuvering_aux_total = sumPhase('emission_maneuvering_aux');
      const emission_anchorage_aux_total = sumPhase('emission_anchorage_aux');

      fields.push(
        'emission_cruising_main_total', 'emission_cruising_aux_total',
        'emission_maneuvering_main_total', 'emission_maneuvering_aux_total',
        'emission_anchorage_aux_total',
        'lf_main_cruising', 'lf_main_maneuvering',
        'lf_aux_cruising', 'lf_aux_maneuvering', 'lf_aux_anchorage',
        'total_emission'
      );
      values.push(
        emission_cruising_main_total, emission_cruising_aux_total,
        emission_maneuvering_main_total, emission_maneuvering_aux_total,
        emission_anchorage_aux_total,
        lf_cruising_main, lf_maneuvering_main,
        lf_cruising_aux, lf_maneuvering_aux, lf_anchorage_aux,
        total_emission
      );

      await connection.query('DELETE FROM emission_estimations WHERE ship_name = ?', [ship_name]);

      await connection.query(`
        INSERT INTO emission_estimations (${fields.join(', ')})
        VALUES (${fields.map(() => '?').join(', ')})
      `, values);
    }

    await connection.commit();
    connection.release();
    res.json({ message: '✅ Tính toán và lưu emission_estimations thành công!' });
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    res.status(500).json({ message: error.message });
  }
};
