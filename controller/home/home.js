import { executeQuery, LightdataORM } from "lightdata-tools";

export async function home({ db, req, userId, profile }) {
  const didUsuario = userId;
  const perfil = profile;

  console.log(userId, profile);

  // Estados reales
  const PENDIENTES = [1, 2]; // Pendiente + En curso
  const COMPLETADOS = [3]; // Terminada

  const esPerfilTres = perfil == 3;

  // --------------------
  // TOTAL HOY
  // perfil 3 => solo las mías
  // --------------------
  let totalHoySql = `
    SELECT COUNT(*) AS total_hoy
    FROM ordenes_trabajo
    WHERE elim = 0
      AND superado = 0
      AND DATE(fecha_inicio) = CURDATE()
  `;

  const totalHoyValues = [];

  if (esPerfilTres) {
    totalHoySql += ` AND asignado = ?`;
    totalHoyValues.push(didUsuario);
  }

  const [totalHoyRow = {}] = await executeQuery({
    db,
    query: totalHoySql,
    values: totalHoyValues,
    log: true,
  });

  const total_hoy = Number(totalHoyRow?.total_hoy ?? 0);

  // --------------------
  // PENDIENTES TOTAL
  // perfil 3 => asignadas a mí + sin asignar
  // --------------------
  let pendientesSql = `
    SELECT COUNT(*) AS pendientes_total
    FROM ordenes_trabajo
    WHERE elim = 0
      AND superado = 0
      AND DATE(fecha_inicio) = CURDATE()
      AND estado IN (${PENDIENTES.map(() => "?").join(",")})
  `;

  const pendientesValues = [...PENDIENTES];

  if (esPerfilTres) {
    pendientesSql += `
      AND (
        asignado = ?
        OR asignado IS NULL
        OR asignado = ''
        OR asignado = 0
      )
    `;
    pendientesValues.push(didUsuario);
  }

  const [pendientesRow = {}] = await executeQuery({
    db,
    query: pendientesSql,
    values: pendientesValues,
    log: true,
  });

  const pendientes_total = Number(pendientesRow?.pendientes_total ?? 0);

  // --------------------
  // COMPLETADOS TOTAL
  // perfil 3 => solo las mías
  // --------------------
  let completadosSql = `
    SELECT COUNT(*) AS completados_total
    FROM ordenes_trabajo
    WHERE elim = 0
      AND superado = 0
      AND DATE(fecha_inicio) = CURDATE()
      AND estado IN (${COMPLETADOS.map(() => "?").join(",")})
  `;

  const completadosValues = [...COMPLETADOS];

  if (esPerfilTres) {
    completadosSql += ` AND asignado = ?`;
    completadosValues.push(didUsuario);
  }

  const [completadosRow = {}] = await executeQuery({
    db,
    query: completadosSql,
    values: completadosValues,
    log: true,
  });

  const completados_total = Number(completadosRow?.completados_total ?? 0);

  // --------------------
  // PENDIENTES SIN ASIGNAR
  // --------------------
  const sinAsignarSql = `
    SELECT COUNT(*) AS cantidad_sin_asignar
    FROM ordenes_trabajo
    WHERE elim = 0
      AND superado = 0
      AND DATE(fecha_inicio) = CURDATE()
      AND estado IN (${PENDIENTES.map(() => "?").join(",")})
      AND (asignado IS NULL OR asignado = '' OR asignado = 0);
  `;

  const [sinAsignarRow = {}] = await executeQuery({
    db,
    query: sinAsignarSql,
    values: [...PENDIENTES],
    log: true,
  });

  const cantidad_sin_asignar = Number(sinAsignarRow?.cantidad_sin_asignar ?? 0);

  // --------------------
  // PEDIDOS SUGERIDOS
  // perfil 3 => asignadas a mí + sin asignar
  // --------------------
  let sugeridosWhere = `
    WHERE ot.elim = 0
      AND ot.superado = 0
      AND DATE(ot.fecha_inicio) = CURDATE()
      AND ot.estado IN (${PENDIENTES.map(() => "?").join(",")})
  `;

  const sugeridosValues = [...PENDIENTES];

  if (esPerfilTres) {
    sugeridosWhere += `
      AND (
        ot.asignado = ?
        OR ot.asignado IS NULL
        OR ot.asignado = ''
        OR ot.asignado = 0
      )
    `;
    sugeridosValues.push(didUsuario);
  }

  const sugeridosSql = `
    SELECT
      ot.did AS ot_did,
      ot.estado,
      ot.asignado,
      ot.fecha_inicio,
      ot.fecha_fin,
      ot.alertada,
      u.nombre AS asignado_nombre,

      otp.did_pedido,

      p.number,
      p.flex,

      p.fecha_venta AS fecha_pedido
    FROM ordenes_trabajo ot
    LEFT JOIN ordenes_trabajo_pedidos otp
      ON otp.did_orden_trabajo = ot.did
     AND otp.elim = 0
     AND otp.superado = 0
    LEFT JOIN usuarios u
      ON u.did = ot.asignado
     AND u.superado = 0
     AND u.elim = 0
    LEFT JOIN pedidos p
      ON p.did = otp.did_pedido
     AND p.elim = 0
     AND p.superado = 0
    ${sugeridosWhere}
    ORDER BY ot.id DESC
    LIMIT 2
  `;

  const sugeridos = await executeQuery({
    db,
    query: sugeridosSql,
    values: sugeridosValues,
  });

  const didPedidos = (sugeridos ?? [])
    .map((x) => x?.did_pedido)
    .filter(Boolean);

  // Mapa: did_pedido -> productos[]
  const productosPorPedido = new Map();

  if (didPedidos.length > 0) {
    const productosSql = `
      SELECT
        pp.did_pedido,
        pp.did_producto,
        pp.codigo,
        pr.imagen,
        pp.descripcion,
        pp.cantidad,
        pp.did_producto_variante_valor,
        pr.tiene_ie,
        pp.seller_sku,
        pr.posicion
      FROM pedidos_productos pp
      LEFT JOIN productos pr
        ON pr.did = pp.did_producto
       AND pr.elim = 0
       AND pr.superado = 0
      WHERE pp.elim = 0
        AND pp.superado = 0
        AND pp.did_pedido IN (${didPedidos.map(() => "?").join(",")})
      ORDER BY pp.did_pedido, pp.did_producto;
    `;

    const productosRows = await executeQuery({
      db,
      query: productosSql,
      values: didPedidos,
    });

    for (const r of productosRows ?? []) {
      if (r.tiene_ie == 1) {
        const stockRows = await LightdataORM.select({
          db,
          table: "stock_producto_detalle",
          where: { did_producto_combinacion: r.did_producto_variante_valor },
          select: ["did", "stock", "data_ie"],
          log: true,
        });

        const identificadoresEspeciales = (stockRows ?? []).map((row) => {
          let dataIE = row?.data_ie ?? [];

          if (typeof dataIE === "string") {
            try {
              dataIE = JSON.parse(dataIE);
            } catch {
              dataIE = [];
            }
          }

          if (!Array.isArray(dataIE)) {
            dataIE = [];
          }

          dataIE = dataIE.map((item) => ({
            ...item,
            did: String(item?.did ?? ""),
          }));

          return {
            did_stock: String(row?.did ?? ""),
            stock: String(row?.stock ?? "0"),
            data_ie: dataIE,
          };
        });

        r.stock = String(
          (stockRows ?? []).reduce((acc, row) => acc + Number(row?.stock ?? 0), 0)
        );
        r.data_ie = identificadoresEspeciales;
      } else {
        const stockRows = await LightdataORM.select({
          db,
          table: "stock_producto",
          where: { did_producto: r.did_producto },
          select: ["stock_combinacion"],
        });

        r.stock = stockRows?.[0]?.stock_combinacion ?? 0;
        r.data_ie = [];
      }

      const key = String(r.did_pedido);
      if (!productosPorPedido.has(key)) productosPorPedido.set(key, []);

      productosPorPedido.get(key).push({
        did: String(r.did_producto ?? ""),
        titulo: r.descripcion ?? "",
        ean: String(r.codigo ?? ""),
        sku: String(r.seller_sku ?? ""),
        posicion: r.posicion ?? "",
        cantidad: String(r.cantidad ?? "0"),
        did_producto_variante_valor: String(r.did_producto_variante_valor ?? ""),
        foto:
          r.imagen ??
          "https://ff.lightdata.app/assets-app/img/sistema/img-default.png",
        stock: String(r.stock ?? "0"),
        identificadores_especiales: r.data_ie ?? [],
      });
    }
  }

  const otMap = new Map();

  for (const s of sugeridos ?? []) {
    const otKey = String(s.ot_did ?? "");
    const pedidoKey = String(s.did_pedido ?? "");

    if (!otMap.has(otKey)) {
      otMap.set(otKey, {
        did: otKey,
        asignado: String(s.asignado ?? ""),
        estado: String(s.estado ?? ""),
        nombre_asignado: s.asignado_nombre ?? "",
        fecha: s.fecha_inicio ?? "",
        procesado: "0",
        pedidos: [],
        insumos: [],
      });
    }

    const ot = otMap.get(otKey);

    const yaExistePedido = ot.pedidos.some(
      (p) => String(p.did_pedido) === pedidoKey
    );

    if (!yaExistePedido && pedidoKey) {
      ot.pedidos.push({
        did_pedido: pedidoKey,
        id_venta: String(s.number ?? ""),
        tienda: s.flex ?? "",
        fecha: s.fecha_pedido ?? s.fecha_inicio ?? "",
        productos: productosPorPedido.get(pedidoKey) ?? [],
      });
    }
  }

  const ot_sugeridas = Array.from(otMap.values());

  return {
    success: true,
    message: "Home PVs obtenida correctamente",
    data: {
      total_hoy: String(total_hoy),
      pendientes_total: String(pendientes_total),
      completados_total: String(completados_total),
      ot_urgentes: "0",
      sin_asignar: String(cantidad_sin_asignar),
      avisos: [],
      ot_sugeridas,
    },
  };
}