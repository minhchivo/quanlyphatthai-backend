const db = require('../config/db.config');

exports.calculateEmissions = async (req, res) => {
  try {
    const connection = await db.promise().getConnection();
    await connection.beginTransaction();

    // Nếu có req.ship_name => chỉ tính 1 tàu
    let shipsQuery = 'SELECT * FROM summary_data';
    let queryParams = [];
    if (req.ship_name) {
      shipsQuery += ' WHERE ship_name = ?';
      queryParams.push(req.ship_name);
    }
    const [ships] = await connection.query(shipsQuery, queryParams);
    if (ships.length === 0) {
      throw new Error('Không có dữ liệu trong summary_data.');
    }

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

      const cruisingHours = totalHours * 0.7;
      const maneuveringHours = totalHours * 0.2;
      const anchorageHours = totalHours * 0.1;

      const pollutants = ['NOx', 'PM10', 'PM25', 'HC', 'CO', 'CO2', 'SOx', 'N2O', 'CH4'];

      let efMain = {}, efAux = {}, fields = [], values = [];

      fields.push('ship_name');
      values.push(ship_name);

      fields.push('main_engine_power');
      values.push(main_engine_power);

      fields.push('auxiliary_engine_power');
      values.push(auxiliary_engine_power);

      fields.push('time_at_anchorage');
      values.push(anchorageHours);

      fields.push('time_at_cruising');
      values.push(cruisingHours);

      fields.push('time_at_maneuvering');
      values.push(maneuveringHours);

      fields.push('tonnage');
      values.push(tonnage);

      for (const pol of pollutants) {
        const pollutantInDB = pol === 'PM25' ? 'PM2.5' : pol;

        const [efRow] = await connection.query(
          'SELECT * FROM emission_factors_by_tier WHERE tier = ? AND pollutant = ? LIMIT 1',
          [tier, pollutantInDB]
        );

        if (efRow.length === 0) {
          throw new Error(`Không tìm thấy emission factor cho ${pol}`);
        }

        efMain[pol] = engine_speed < 130 ? parseFloat(efRow[0].ssd_main_engine) : parseFloat(efRow[0].msd_main_engine);
        efAux[pol] = parseFloat(efRow[0].aux_engine);

        fields.push(`ef_main_${pol}`);
        values.push(efMain[pol]);
        fields.push(`ef_aux_${pol}`);
        values.push(efAux[pol]);
      }

      const emissionResults = {};

      for (const pol of pollutants) {
        emissionResults[`emission_cruising_main_${pol}`] = main_engine_power * cruisingHours * lf_cruising_main * efMain[pol];
        emissionResults[`emission_cruising_aux_${pol}`] = auxiliary_engine_power * cruisingHours * lf_cruising_aux * efAux[pol];
        emissionResults[`emission_maneuvering_main_${pol}`] = main_engine_power * maneuveringHours * lf_maneuvering_main * efMain[pol];
        emissionResults[`emission_maneuvering_aux_${pol}`] = auxiliary_engine_power * maneuveringHours * lf_maneuvering_aux * efAux[pol];
        emissionResults[`emission_anchorage_aux_${pol}`] = auxiliary_engine_power * anchorageHours * lf_anchorage_aux * efAux[pol];
      }

      for (const key of Object.keys(emissionResults)) {
        fields.push(key);
        values.push(emissionResults[key]);
      }

      const emission_cruising_main_total = pollutants.reduce((sum, pol) => sum + emissionResults[`emission_cruising_main_${pol}`], 0);
      const emission_cruising_aux_total = pollutants.reduce((sum, pol) => sum + emissionResults[`emission_cruising_aux_${pol}`], 0);
      const emission_maneuvering_main_total = pollutants.reduce((sum, pol) => sum + emissionResults[`emission_maneuvering_main_${pol}`], 0);
      const emission_maneuvering_aux_total = pollutants.reduce((sum, pol) => sum + emissionResults[`emission_maneuvering_aux_${pol}`], 0);
      const emission_anchorage_aux_total = pollutants.reduce((sum, pol) => sum + emissionResults[`emission_anchorage_aux_${pol}`], 0);
      const total_emission = emission_cruising_main_total + emission_cruising_aux_total + emission_maneuvering_main_total + emission_maneuvering_aux_total + emission_anchorage_aux_total;

      fields.push(
        'emission_cruising_main_total', 'emission_cruising_aux_total', 'emission_maneuvering_main_total',
        'emission_maneuvering_aux_total', 'emission_anchorage_aux_total',
        'lf_aux_anchorage', 'lf_aux_cruising', 'lf_aux_maneuvering',
        'lf_main_cruising', 'lf_main_maneuvering',
        'total_emission'
      );

      values.push(
        emission_cruising_main_total, emission_cruising_aux_total, emission_maneuvering_main_total,
        emission_maneuvering_aux_total, emission_anchorage_aux_total,
        lf_anchorage_aux, lf_cruising_aux, lf_maneuvering_aux,
        lf_cruising_main, lf_maneuvering_main,
        total_emission
      );

      // Chia toàn bộ phát thải từ gram -> kg trước khi lưu
      for (let i = 0; i < fields.length; i++) {
        if (
          fields[i].startsWith('ef_main_') ||
          fields[i].startsWith('ef_aux_') ||
          fields[i].startsWith('lf_') ||
          ['main_engine_power', 'auxiliary_engine_power', 'time_at_anchorage', 'time_at_cruising', 'time_at_maneuvering', 'tonnage', 'ship_name'].includes(fields[i])
        ) {
          continue;
        }

        if (typeof values[i] === 'number' && !isNaN(values[i])) {
          values[i] = values[i] / 1000;
        } else {
          values[i] = 0;
        }
      }

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
