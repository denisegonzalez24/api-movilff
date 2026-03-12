import { executeQuery, LightdataORM } from "lightdata-tools";

export async function home({ db, req }) {
  const user = req?.user ?? req?.usuario ?? null;

  // Estados reales
  const PENDIENTES = [1, 2]; // Pendiente + En curso
  const COMPLETADOS = [3]; // Terminada (por ahora se cuenta)

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

  const [
    {
      total = 0,
      pendientes_total = 0,
      completados_total = 0,
      pvs_hoy_total = 0,
    } = {},
  ] = await executeQuery({
    db,
    query: totalsSql,
    values: [...PENDIENTES, ...COMPLETADOS],
    log: true,
  });

  // --------------------
  // PENDIENTES POR ASIGNADO
  // --------------------
  const sinAsignarSql = `
  SELECT COUNT(*) AS cantidad
  FROM ordenes_trabajo
  ${baseWhere}
    AND estado IN (${PENDIENTES.map(() => "?").join(",")})
    AND (asignado IS NULL OR asignado = '' OR asignado = 0);
`;

  const [{ cantidad_sin_asignar = 0 } = {}] = await executeQuery({
    db,
    query: sinAsignarSql.replace("COUNT(*) AS cantidad", "COUNT(*) AS cantidad_sin_asignar"),
    values: [...PENDIENTES],
    log: true,
  });

  // --------------------
  // PEDIDOS SUGERIDOS (2 OT más antiguas pendientes)
  // 1) Traemos las 2 OTs sugeridas + did_pedido + datos del pedido
  // 2) Traemos TODOS los productos de esos pedidos y los agrupamos
  // --------------------
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
    ON u.did = ot.asignado and u.superado = 0 and u.elim = 0
  LEFT JOIN pedidos p
    ON p.did = otp.did_pedido 
   AND p.elim = 0
   AND p.superado = 0
  WHERE ot.elim = 0
    AND ot.superado = 0
    
    AND ot.estado IN (${PENDIENTES.map(() => "?").join(",")})
  ORDER BY ot.id DESC
  LIMIT 2
`;

  const sugeridos = await executeQuery({
    db,
    query: sugeridosSql,
    values: [...PENDIENTES],

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

    // mapear stock por did_producto_variante_valor


    for (const r of productosRows ?? []) {
      if (r.tiene_ie == 1) {
        const stockRows = await LightdataORM.select({
          db,
          table: "stock_producto_detalle",
          where: { did_producto_combinacion: r.did_producto_variante_valor },
          select: ["did", "stock", "data_ie"],
          log: true,
        });

        const stockActual = stockRows?.[0]?.stock ?? 0;
        const didStock = stockRows?.[0]?.did ?? 0;
        let dataIE = stockRows?.[0]?.data_ie ?? [];

        if (typeof dataIE === "string") {
          try {
            dataIE = JSON.parse(dataIE);
          } catch (error) {
            dataIE = [];
          }
        }

        if (!Array.isArray(dataIE)) {
          dataIE = [];
        }

        dataIE = dataIE.map((item) => ({
          ...item,
          stock: stockActual,
          did_stock: String(didStock),
        }));

        r.stock = stockActual;
        r.data_ie = dataIE;
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
        foto: r.imagen ?? "https://ff.lightdata.app/assets-app/img/sistema/img-default.png",
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

    // Evitar repetir el mismo pedido si la query trajera duplicados
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

  // --------------------
  // RESPONSE
  // --------------------
  return {
    success: true,
    message: "Home PVs obtenida correctamente",
    data: {
      total_hoy: String(total),
      pendientes_total: String(pendientes_total),
      completados_total: String(completados_total),

      ot_urgentes: "0",

      sin_asignar: String(cantidad_sin_asignar),
      avisos: [],

      // nuevo formato:
      ot_sugeridas,
    },
  };
}