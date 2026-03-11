import { toBool01, executeQuery, LightdataORM } from "lightdata-tools";
import { SqlWhere, makeSort } from "../../src/query_utils.js";

export async function getOrdenesTrabajoByUsuario({ db, req, userId, profile }) {
    const q = req.query || {};
    const perfilNum = Number(profile);

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
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    const filtros = {
        did_cliente: parseCsvNums(q.did_cliente),
        estado: parseCsvNums(q.estado),
        asignado: parseAsignado(q.asignado),
        tienda: parseCsvNums(q.tienda),
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

    const sortMap = {
        did_cliente: "p.did_cliente",
        fecha: "ot.fecha_inicio",
        id_venta: "p.number",
        estado: "ot.estado",
        tienda: "p.flex",
        asignado: "ot.asignado",
    };
    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "fecha",
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    if (perfilNum === 4) {
        return {
            success: true,
            message: "Órdenes de Trabajo obtenidas correctamente",
            data: [],
        };
    }

    const where = new SqlWhere()
        .add("ot.elim = 0")
        .add("ot.superado = 0")
        .add("ot.estado <> 3")
        .add("otp.elim = 0")
        .add("otp.superado = 0")
        .add("p.elim = 0")
        .add("p.superado = 0")
        .add("p.did_cliente IS NOT NULL");

    if (filtros.did_cliente?.length) where.in("p.did_cliente", filtros.did_cliente);
    if (filtros.estado?.length) where.in("ot.estado", filtros.estado);

    if (filtros.asignado) {
        const { includeNull, values } = filtros.asignado;

        if (perfilNum === 1 || perfilNum === 2) {
            if (includeNull && values.length) {
                where.add(
                    `(ot.asignado IS NULL OR ot.asignado = '' OR ot.asignado = 0 OR ot.asignado IN (${values.map(() => "?").join(",")}))`,
                    ...values
                );
            } else if (includeNull) {
                where.add("(ot.asignado IS NULL OR ot.asignado = '' OR ot.asignado = 0)");
            } else if (values.length) {
                where.in("ot.asignado", values);
            }
        } else if (perfilNum === 3) {
            if (includeNull && values.length) {
                where.add(
                    `(
                        (ot.asignado IS NULL OR ot.asignado = '' OR ot.asignado = 0)
                        OR
                        (ot.quien = ? AND ot.asignado IN (${values.map(() => "?").join(",")}))
                    )`,
                    userId,
                    ...values
                );
            } else if (includeNull) {
                where.add("(ot.asignado IS NULL OR ot.asignado = '' OR ot.asignado = 0)");
            } else if (values.length) {
                where.add(
                    `(ot.quien = ? AND ot.asignado IN (${values.map(() => "?").join(",")}))`,
                    userId,
                    ...values
                );
            }
        }
    } else {
        if (perfilNum === 3) {
            where.add("ot.quien = ?", userId);
        }
    }

    if (filtros.tienda?.length) where.in("p.flex", filtros.tienda);

    if (filtros.alertada === 1) where.eq("ot.alertada", 1);
    else if (filtros.alertada === 0) where.eq("ot.alertada", 0);

    if (filtros.fecha_from) where.add("ot.fecha_inicio >= ?", filtros.fecha_from);
    if (filtros.fecha_to) where.add("ot.fecha_inicio <= ?", filtros.fecha_to);

    if (filtros.id_venta) where.likeCI("p.number", filtros.id_venta);

    const { whereSql, params } = where.finalize();

    const ordenesSql = `
        SELECT
            ot.did AS ot_did,
            ot.estado,
            ot.asignado,
            ot.fecha_inicio,
            ot.fecha_fin,
            ot.alertada,
            u.nombre AS asignado_nombre,

            otp.did_pedido,

            p.did AS pedido_did,
            p.number,
            p.flex,
            p.fecha_venta AS fecha_pedido

        FROM ordenes_trabajo ot
        LEFT JOIN ordenes_trabajo_pedidos otp
            ON otp.did_orden_trabajo = ot.did
        LEFT JOIN usuarios u
            ON u.did = ot.asignado
           AND u.superado = 0
           AND u.elim = 0
        LEFT JOIN pedidos p
            ON p.did = otp.did_pedido
        ${whereSql}
        ${orderSql}, ot.did ASC, p.did ASC
    `;

    const ordenesRows = await executeQuery({
        db,
        query: ordenesSql,
        values: params,
        log: true,
    });

    const didPedidos = Array.from(
        new Set(
            (ordenesRows ?? [])
                .map((x) => x?.did_pedido)
                .filter(Boolean)
        )
    );

    const productosPorPedido = new Map();

    if (didPedidos.length > 0) {
        const productosSql = `
            SELECT
                pp.did_pedido,
                pp.did_producto,
                pp.codigo,
                pp.descripcion,
                pp.cantidad,
                pp.did_producto_variante_valor,
                pp.seller_sku,
                pr.imagen,
                pr.tiene_ie,
                pr.posicion
            FROM pedidos_productos pp
            LEFT JOIN productos pr
                ON pr.did = pp.did_producto
               AND pr.elim = 0
               AND pr.superado = 0
            WHERE pp.elim = 0
              AND pp.superado = 0
              AND pp.did_pedido IN (${didPedidos.map(() => "?").join(",")})
            ORDER BY pp.did_pedido, pp.did_producto
        `;

        const productosRows = await executeQuery({
            db,
            query: productosSql,
            values: didPedidos,
            log: true,
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

                const stockActual = stockRows?.[0]?.stock ?? 0;
                const didStock = stockRows?.[0]?.did ?? 0;
                let dataIE = stockRows?.[0]?.data_ie ?? [];

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
                foto: r.imagen ?? "assets/images/auri.jpg",
                stock: String(r.stock ?? "0"),
                identificadores_especiales: r.data_ie ?? [],
            });
        }
    }

    const otMap = new Map();

    for (const s of ordenesRows ?? []) {
        const otKey = String(s.ot_did ?? "");
        const pedidoKey = String(s.did_pedido ?? "");

        if (!otMap.has(otKey)) {
            otMap.set(otKey, {
                did: otKey,
                asignado: String(s.asignado ?? ""),
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

    const data = Array.from(otMap.values());

    return {
        success: true,
        message: "Órdenes de Trabajo obtenidas correctamente",
        data,
    };
}