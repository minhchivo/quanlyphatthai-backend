const db = require('../config/db.config');

exports.viewLNGData = async (req, res) => {
  try {
    const { ship_name } = req.body;
    if (!ship_name) {
      throw new Error('Tên tàu không được để trống.');
    }

    // Lấy dữ liệu từ `summary_data`
    const [shipData] = await db.promise().query(
      'SELECT * FROM summary_data WHERE ship_name = ? LIMIT 1',
      [ship_name]
    );

    if (shipData.length === 0) {
      throw new Error(`Không tìm thấy dữ liệu cho tàu ${ship_name}`);
    }

    const ship = shipData[0];
    const pollutants = ['NOx', 'PM10', 'PM25', 'HC', 'CO', 'CO2', 'SOx', 'N2O', 'CH4'];
    let updatedData = { ...ship };

    // Lấy hệ số phát thải LNG
    for (const pol of pollutants) {
      const polDB = pol === 'PM25' ? 'PM2.5' : pol;
      const [efLNG] = await db.promise().query(
        'SELECT * FROM emission_factors_lng_100 WHERE pollutant = ? LIMIT 1',
        [polDB]
      );

      if (efLNG.length > 0) {
        updatedData[`ef_main_${pol}`] = efLNG[0].main_engine;
        updatedData[`ef_aux_${pol}`] = efLNG[0].aux_engine;
      }
    }

    /**
     * ========== LẤY DỮ LIỆU PHÁT THẢI GỐC ==========
     */
    const [originalEmissionData] = await db.promise().query(
      'SELECT * FROM emission_estimations WHERE ship_name = ? LIMIT 1',
      [ship_name]
    );

    if (originalEmissionData.length === 0) {
      throw new Error(`Không tìm thấy dữ liệu phát thải gốc cho tàu ${ship_name}`);
    }

    const originalData = originalEmissionData[0];

    /**
     * ========== TÍNH PHÁT THẢI LNG ==========
     */
    const {
      cruising_distance,
      maneuvering_distance,
      anchorage_hours,
      main_engine_power,
      auxiliary_engine_power,
      lf_cruising_main,
      lf_maneuvering_main,
      lf_cruising_aux,
      lf_maneuvering_aux,
      lf_anchorage_aux,
    } = updatedData;

    let emissionResults = {};

    // --- Giai đoạn 1: Hành trình - Máy chính ---
    pollutants.forEach((pol) => {
      const efMain = updatedData[`ef_main_${pol}`] || 0;
      const emission = (cruising_distance * main_engine_power * lf_cruising_main * efMain) / 1000;
      emissionResults[`E1_cruising_main_${pol}`] = emission;
    });

    // --- Giai đoạn 2: Điều động - Máy chính ---
    pollutants.forEach((pol) => {
      const efMain = updatedData[`ef_main_${pol}`] || 0;
      const emission = (maneuvering_distance * main_engine_power * lf_maneuvering_main * efMain) / 1000;
      emissionResults[`E2_maneuvering_main_${pol}`] = emission;
    });

    // --- Giai đoạn 3: Hành trình - Máy phụ ---
    pollutants.forEach((pol) => {
      const efAux = updatedData[`ef_aux_${pol}`] || 0;
      const emission = (cruising_distance * auxiliary_engine_power * lf_cruising_aux * efAux) / 1000;
      emissionResults[`E3_cruising_aux_${pol}`] = emission;
    });

    // --- Giai đoạn 4: Điều động - Máy phụ ---
    pollutants.forEach((pol) => {
      const efAux = updatedData[`ef_aux_${pol}`] || 0;
      const emission = (maneuvering_distance * auxiliary_engine_power * lf_maneuvering_aux * efAux) / 1000;
      emissionResults[`E4_maneuvering_aux_${pol}`] = emission;
    });

    // --- Giai đoạn 5: Neo đậu - Máy phụ ---
    pollutants.forEach((pol) => {
      const efAux = updatedData[`ef_aux_${pol}`] || 0;
      const emission = (anchorage_hours * auxiliary_engine_power * lf_anchorage_aux * efAux) / 1000;
      emissionResults[`E5_anchorage_aux_${pol}`] = emission;
    });

    /**
     * ========== TÍNH TỔNG PHÁT THẢI LNG ==========
     */
    const sumEmissions = (phasePrefix) => {
      return pollutants.reduce((sum, pol) => sum + (emissionResults[`${phasePrefix}_${pol}`] || 0), 0);
    };

    const E1_total = sumEmissions('E1_cruising_main');
    const E2_total = sumEmissions('E2_maneuvering_main');
    const E3_total = sumEmissions('E3_cruising_aux');
    const E4_total = sumEmissions('E4_maneuvering_aux');
    const E5_total = sumEmissions('E5_anchorage_aux');
    const total_emission = E1_total + E2_total + E3_total + E4_total + E5_total;

    /**
     * ========== TÍNH TỔNG PHÁT THẢI GỐC ==========
     */
    const originalTotalByPollutant = {};
    pollutants.forEach((pol) => {
      originalTotalByPollutant[pol] =
        (originalData[`emission_cruising_main_${pol}`] || 0) +
        (originalData[`emission_maneuvering_main_${pol}`] || 0) +
        (originalData[`emission_cruising_aux_${pol}`] || 0) +
        (originalData[`emission_maneuvering_aux_${pol}`] || 0) +
        (originalData[`emission_anchorage_aux_${pol}`] || 0);
    });

    const original_total_emission = originalData.total_emission;

    /**
     * ========== TÍNH TỔNG PHÁT THẢI LNG CHO TỪNG LOẠI KHÍ ==========
     */
    const totalByPollutant = {};
    pollutants.forEach((pol) => {
      totalByPollutant[pol] =
        (emissionResults[`E1_cruising_main_${pol}`] || 0) +
        (emissionResults[`E2_maneuvering_main_${pol}`] || 0) +
        (emissionResults[`E3_cruising_aux_${pol}`] || 0) +
        (emissionResults[`E4_maneuvering_aux_${pol}`] || 0) +
        (emissionResults[`E5_anchorage_aux_${pol}`] || 0);
    });

    res.json({
      ship_name,
      original_total_emission,
      total_emission,
      original_total_by_pollutant: originalTotalByPollutant,
      total_by_pollutant: totalByPollutant,
    });

  } catch (error) {
    console.error('❌ Lỗi khi tính toán phát thải:', error.message);
    res.status(500).json({ message: error.message });
  }
};
