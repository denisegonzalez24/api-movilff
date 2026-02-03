import { toBool01, pickNonEmpty, executeQuery } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta } from "../../src/query_utils.js";

export async function getFilteredOrdenesTrabajoByClienteFiltered({ db, req }) {
    const q = req.query || {};
    // NO MANDAR ESTADO 3 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
    // ---- helpers robustos para CSVs ---
    const parseCsvNums = (v) => {
        if (v === "sin_asignar") return null;

        if (typeof v === "string") {
            const out = [];
            for (const raw of v.split(",")) {
                const s = String(raw).trim();
                if (!s) continue;
                if (/^(null|undefined)$/i.test(s)) continue;
                const n = Number(s);
                if (Number.isFinite(n)) out.push(n);
            }
            return out.length ? Array.from(new Set(out)) : undefined;
        }

        if (Number.isFinite(Number(v))) return [Number(v)];
        return undefined;
    };

    const parseAsignado = (v) => {
        if (typeof v !== "string" || !v.trim()) return undefined;

        let includeNull = false;
        const nums = [];

        for (const raw of v.split(",")) {
            const s = raw.trim();
            if (!s) continue;

            if (s === "sin_asignar") {
                includeNull = true;
                continue;
            }

            const n = Number(s);
            if (Number.isFinite(n)) nums.push(n);
        }

        return {
            includeNull,
            values: nums.length ? Array.from(new Set(nums)) : [],
        };
    };

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    // ---- filtros (multi-valor) ----
    const filtros = {
        did_cliente: parseCsvNums(q.did_cliente), // p.did_cliente IN (...)
        estado: parseCsvNums(q.estado), // ot.estado IN (...)
        asignado: parseAsignado(q.asignado), // ot.asignado IN (.., NULL)
        origen: parseCsvNums(q.origen), // p.flex IN (...)

        alertada: (() => {
            const v = q.alertada;
            if (v === undefined || v === null || v === "") return undefined;
            if (v === true || v === "true" || v === 1 || v === "1") return 1;
            if (v === false || v === "false" || v === 0 || v === "0") return 0;
            return toBool01(v, undefined);
        })(),

        fecha_from:
            typeof q.fecha_from === "string" && q.fecha_from.trim()
                ? `${q.fecha_from.trim()} 00:00:00`
                : undefined,
        fecha_to:
            typeof q.fecha_to === "string" && q.fecha_to.trim()
                ? `${q.fecha_to.trim()} 23:59:59`
                : undefined,

        id_venta: typeof q.id_venta === "string" ? q.id_venta.trim() : undefined,
    };

    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    // ordenar por: did_cliente, fecha, id_venta, estado, origen y asignado
    const sortMap = {
        did_cliente: "p.did_cliente",
        fecha: "ot.fecha_inicio",
        id_venta: "p.number",
        estado: "ot.estado",
        origen: "p.flex",
        asignado: "ot.asignado",
    };
    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "fecha",
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    const where = new SqlWhere()
        .add("ot.elim = 0")
        .add("ot.superado = 0")
        .add("p.did_cliente IS NOT NULL")
        .add("ot.estado <> 3");


    // multi-valor
    if (filtros.did_cliente?.length) where.in("p.did_cliente", filtros.did_cliente);
    if (filtros.estado?.length) where.in("ot.estado", filtros.estado);

    if (filtros.asignado) {
        const { includeNull, values } = filtros.asignado;

        if (includeNull && values.length) {
            where.add(
                `(ot.asignado IS NULL OR ot.asignado IN (${values.map(() => "?").join(",")}))`,
                ...values
            );
        } else if (includeNull) {
            where.add("ot.asignado IS NULL");
        } else if (values.length) {
            where.in("ot.asignado", values);
        }
    }

    if (filtros.origen?.length) where.in("p.flex", filtros.origen);

    // alertada tri-state
    if (filtros.alertada === 1) where.eq("ot.alertada", 1);
    else if (filtros.alertada === 0) where.eq("ot.alertada", 0);

    // fechas
    if (filtros.fecha_from) where.add("ot.fecha_inicio >= ?", filtros.fecha_from);
    if (filtros.fecha_to) where.add("ot.fecha_inicio <= ?", filtros.fecha_to);

    // id_venta (p.number) LIKE CI
    if (filtros.id_venta) where.likeCI("p.number", filtros.id_venta);

    const { whereSql, params } = where.finalize();

    // ✅ Pedidos con productos ADENTRO de cada pedido
    const dataSql = `
  SELECT 
    ot.did,
    ot.estado,
    ot.asignado,
    ot.fecha_inicio,
    ot.fecha_fin,
    ot.alertada,

    COALESCE(
      JSON_ARRAYAGG(
        DISTINCT JSON_OBJECT(
          'did', p.did,
          'flex', p.flex,
          'estado', p.status,
          'did_cliente', p.did_cliente,
          'id_venta', p.number,
          'productos', COALESCE(
            (
              SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                  'did_producto', pp.did_producto,
                  'seller_sku', pp.seller_sku,
                  'identificadores_especiales', pr.dids_ie,             
                  'producto_nombre', pr.titulo,
                  'posicion', pr.posicion,
                  'imagen',pr.imagen,
                  'ean',pr.ean
                )
              )
              FROM pedidos_productos pp
              LEFT JOIN productos pr ON pr.did = pp.did_producto
              WHERE pp.did_pedido = p.id
            ),
            JSON_ARRAY()
          )
        )
      ),
      JSON_ARRAY()
    ) AS pedidos

  FROM ordenes_trabajo AS ot
  LEFT JOIN ordenes_trabajo_pedidos AS otp 
    ON ot.did = otp.did_orden_trabajo
  LEFT JOIN pedidos AS p
    ON otp.did_pedido = p.id
  ${whereSql}
  GROUP BY ot.did
  ${orderSql}, ot.did ASC
  LIMIT ? OFFSET ?;
`;

    const countSql = `
  SELECT COUNT(DISTINCT ot.did) AS total
  FROM ordenes_trabajo AS ot
  LEFT JOIN ordenes_trabajo_pedidos AS otp 
    ON ot.did = otp.did_orden_trabajo
  LEFT JOIN pedidos AS p
    ON otp.did_pedido = p.id
  ${whereSql};
`;

    const rows = await executeQuery({
        db,
        query: dataSql,
        values: [...params, pageSize, offset],
        log: true,
    });

    const [{ total = 0 } = {}] = await executeQuery({
        db,
        query: countSql,
        values: params,
    });

    const parsedRows = rows.map((r) => ({
        ...r,
        pedidos: typeof r.pedidos === "string" ? JSON.parse(r.pedidos) : (r.pedidos ?? []),
    }));

    const filtersForMeta = pickNonEmpty({
        ...(filtros.did_cliente?.length ? { did_cliente: filtros.did_cliente } : {}),
        ...(filtros.estado?.length ? { estado: filtros.estado } : {}),
        ...(filtros.asignado ? { asignado: q.asignado } : {}),
        ...(filtros.origen?.length ? { origen: filtros.origen } : {}),
        ...(filtros.alertada !== undefined ? { alertada: filtros.alertada } : {}),
        ...(q.fecha_from ? { fecha_from: q.fecha_from } : {}),
        ...(q.fecha_to ? { fecha_to: q.fecha_to } : {}),
        ...(filtros.id_venta ? { id_venta: filtros.id_venta } : {}),
    });

    return {
        success: true,
        message: "Órdenes de Trabajo obtenidas correctamente",
        data: parsedRows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
