import { executeQuery } from "lightdata-tools";

export async function home({ db, req }) {
    const user = req?.user ?? req?.usuario ?? null;

    // Estados reales
    const PENDIENTES = [1, 2]; // Pendiente + En curso
    const COMPLETADOS = [3];  // Terminada (por ahora se cuenta)

    const baseWhere = `
    WHERE elim = 0
      AND superado = 0
  `;

    // --------------------
    // TOTALES
    // --------------------
    const totalsSql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN estado IN (${PENDIENTES.map(() => "?").join(",")}) THEN 1 ELSE 0 END) AS pendientes_total,
      SUM(CASE WHEN estado IN (${COMPLETADOS.map(() => "?").join(",")}) THEN 1 ELSE 0 END) AS completados_total,
      SUM(CASE WHEN DATE(fecha_inicio) = CURDATE() THEN 1 ELSE 0 END) AS pvs_hoy_total
    FROM ordenes_trabajo
    ${baseWhere};
  `;

    const [{
        total = 0,
        pendientes_total = 0,
        completados_total = 0,
        pvs_hoy_total = 0,
    } = {}] = await executeQuery({
        db,
        query: totalsSql,
        values: [...PENDIENTES, ...COMPLETADOS],
        log: true,
    });

    // --------------------
    // PENDIENTES POR ASIGNADO
    // --------------------
    const porAsignadoSql = `
    SELECT
      COALESCE(CAST(asignado AS CHAR), 'sin_asignar') AS asignado,
      COUNT(*) AS cantidad
    FROM ordenes_trabajo
    ${baseWhere}
      AND estado IN (${PENDIENTES.map(() => "?").join(",")})
    GROUP BY asignado
    ORDER BY cantidad DESC;
  `;

    const pendientes_por_asignado = await executeQuery({
        db,
        query: porAsignadoSql,
        values: [...PENDIENTES],
        log: true,
    });

    // --------------------
    // PVs SUGERIDOS (2 más antiguos pendientes)
    // --------------------
    const sugeridosSql = `
    SELECT
      did,
      estado,
      asignado,
      fecha_inicio,
      fecha_fin,
      alertada
    FROM ordenes_trabajo
    ${baseWhere}
      AND estado IN (${PENDIENTES.map(() => "?").join(",")})
    ORDER BY fecha_inicio ASC
    LIMIT 2;
  `;

    const pvs_sugeridos = await executeQuery({
        db,
        query: sugeridosSql,
        values: [...PENDIENTES],
        log: true,
    });

    // --------------------
    // RESPONSE
    // --------------------
    return {
        success: true,
        message: "Home PVs obtenida correctamente",
        data: {
            user,
            total,
            pendientes_total,
            completados_total,
            pvs_hoy_total,
            pendientes_por_asignado,
            pvs_sugeridos,
        },
    };
}
