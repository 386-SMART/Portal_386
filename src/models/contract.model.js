const db = require('../../conexiondb');

async function getContractsByCompany(empresaId) {
    const [contratos] = await db.execute(`
      SELECT 
          c.id_contrato,
          c.nombre_contrato,
          c.fecha_inicio,
          c.fecha_fin,
          c.categoria AS tipo_contrato,
          c.id_relacion,
          COUNT(eq.id_equipo) AS total_equipos
      FROM Contrato c
      LEFT JOIN Equipo eq ON c.id_contrato = eq.id_contrato
      WHERE c.id_empresa = ?
      GROUP BY c.id_contrato
      ORDER BY c.fecha_inicio DESC
    `, [empresaId]);
    return contratos;
}

module.exports = {
    getContractsByCompany
};
