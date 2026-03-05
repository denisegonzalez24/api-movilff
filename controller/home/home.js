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

      otp.did_pedido,

      p.number,
      p.flex,
  
      p.fecha_venta AS fecha_pedido
    FROM ordenes_trabajo ot
    LEFT JOIN ordenes_trabajo_pedidos otp
      ON otp.did = ot.did
     AND otp.elim = 0
     AND otp.superado = 0
    LEFT JOIN pedidos p
      ON p.did = otp.did_pedido
     AND p.elim = 0
     AND p.superado = 0
    WHERE ot.elim = 0
      AND ot.superado = 0
      AND ot.estado IN (${PENDIENTES.map(() => "?").join(",")})
    ORDER BY ot.id DESC
    LIMIT 2;
  `;

  const sugeridos = await executeQuery({
    db,
    query: sugeridosSql,
    values: [...PENDIENTES],
    log: true,
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
      log: true,
    });

    // mapear stock por did_producto_variante_valor


    for (const r of productosRows ?? []) {
      if (productosRows.tiene_ie == 1) {
        const stock = await LightdataORM.select({
          db,
          table: "stock_producto_detalle",
          where: { did_producto_variante_valor: r.did_producto_variante_valor },
          select: ["stock", data_ie]
        });
        //agregar a r el stock encontrado
        r.stock = stock?.[0]?.stock_combinacion ?? 0;
        r.data_ie = stock?.[0]?.data_ie ?? null;
      } else {
        const stock = await LightdataORM.select({
          db,
          table: "stock_producto",
          where: { did_producto: r.did_producto },
          select: ["stock_combinacion"]
        });
        r.stock = stock?.[0]?.stock_combinacion ?? 0;
        r.data_ie = null;
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
        foto: r.imagen ?? "assets/images/auri.jpg",
        stock: String(r.stock ?? "0"),
        identificadores_especiales: r.data_ie ?? [], // lo completas con tu lógica actual
      });
    }
  }

  const pedidos_sugeridos = (sugeridos ?? []).map((s) => {
    const pedidoKey = String(s.did_pedido ?? "");
    return {
      did: String(s.ot_did ?? ""),
      id_venta: String(s.number ?? ""),
      asignado: String(s.asignado ?? ""),
      tienda: s.flex ?? "",
      //  nombre: s.nombre ?? "",
      fecha: s.fecha_pedido ?? s.fecha_inicio ?? "",

      procesado: "0",
      productos: productosPorPedido.get(pedidoKey) ?? [],
      insumos: [], // lo completas con tu lógica actual
      avisos: [], // lo completas con tu lógica actual
    };
  });

  // --------------------
  // RESPONSE
  // --------------------
  return {
    success: true,
    message: "Home PVs obtenida correctamente",
    data: {
      total,
      pendientes_total,
      completados_total,
      pvs_hoy_total,
      pendientes_por_asignado,

      // nuevo formato:
      pedidos_sugeridos,
    },
  };
}