import { toBool01, executeQuery, LightdataORM } from "lightdata-tools";
import { SqlWhere, makeSort } from "../../src/query_utils.js";

export async function getOrdenesTrabajoByUsuario({ db, req, userId, profile }) {
    const q = req.query || {};
    const perfilNum = Number(profile);
    const hasAsignadoQuery = Object.prototype.hasOwnProperty.call(q, "asignado");
    const mergeInsumos = (target, insumos) => {
        for (const insumo of insumos ?? []) {
            const didInsumo = String(insumo?.did_insumo ?? "");
            if (!didInsumo) continue;

            const existente = target.find((item) => String(item.did_insumo) === didInsumo);
            if (existente) {
                existente.cantidad = String(
                    Number(existente.cantidad ?? 0) + Number(insumo.cantidad ?? 0)
                );
                continue;
            }

            target.push({
                did_insumo: didInsumo,
                nombre: insumo?.nombre ?? "",
                cantidad: String(insumo?.cantidad ?? 0),
            });
        }
    };

    const ESTADOS_SIEMPRE_EXCLUIDOS = [4];

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
        let includeAssigned = false;
        const nums = [];

        for (const raw of v.split(",")) {
            const s = raw.trim();
            if (!s) {
                includeAssigned = true;
                continue;
            }

            if (s === "sin_asignar") {
                includeNull = true;
                continue;
            }

            const n = Number(s);
            if (Number.isFinite(n)) nums.push(n);
        }

        return {
            includeAssigned,
            includeNull,
            values: nums.length ? Array.from(new Set(nums)) : [],
        };
    };

    const qp = {
        ...q,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };
    const normalizedSortBy = String(qp.sort_by ?? "fecha").trim();
    const normalizedSortDir =
        String(qp.sort_dir ?? "asc").trim().toLowerCase() === "desc" ? "desc" : "asc";

    const estadosQuery = parseCsvNums(q.estado);
    const tipoFechaRaw = q.tipo_fecha;
    const tipoFecha = Number(tipoFechaRaw);
    const fechaFiltroColumna =
        tipoFecha === 2
            ? "ot.fecha_ultimo_movimiento"
            : tipoFecha === 3
                ? "ot.fecha_asignado"
                : "ot.fecha_inicio";

    // Si mandan estado por query:
    // - se permite 3
    // - se bloquea 4
    // Si NO mandan estado:
    // - por default se excluye 3 y 4
    const estadosPermitidos = Array.isArray(estadosQuery)
        ? estadosQuery.filter((x) => Number(x) !== 4)
        : undefined;

    const filtros = {
        did_cliente: parseCsvNums(q.did_cliente),
        estado: estadosPermitidos,
        asignado: parseAsignado(q.asignado),
        tienda: parseCsvNums(q.tienda),
        urgente: (() => {
            const v = q.urgente;
            if (v === undefined || v === null || v === "") return undefined;
            if (v === true || v === "true" || v === 1 || v === "1") return 1;
            if (v === false || v === "false" || v === 0 || v === "0") return 0;
            return toBool01(v, undefined);
        })(),
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
        producto_id_venta:
            typeof q.producto_id_venta === "string"
                ? q.producto_id_venta.trim()
                : undefined,
    };

    const sortMap = {
        did_cliente: "p.did_cliente",
        fecha: fechaFiltroColumna,
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
        .add("ot.estado IS NOT NULL")
        .add("ot.estado <> 4")
        .add("otp.elim = 0")
        .add("otp.superado = 0")
        .add("p.elim = 0")
        .add("p.superado = 0")
        .add("p.did_cliente IS NOT NULL");

    // Si NO mandan estado en query, excluir también el 3 por default
    if (!Array.isArray(estadosQuery) || !estadosQuery.length) {
        where.add("ot.estado <> 3");
    }

    if (filtros.did_cliente?.length) where.in("p.did_cliente", filtros.did_cliente);
    if (filtros.estado?.length) where.in("ot.estado", filtros.estado);

    const condicionSinAsignar = "(ot.asignado IS NULL OR ot.asignado = '' OR ot.asignado = 0)";
    const condicionConAsignado = "(ot.asignado IS NOT NULL AND ot.asignado <> '' AND ot.asignado <> 0)";

    if (filtros.asignado) {
        const { includeAssigned, includeNull, values } = filtros.asignado;

        // Admin / Coordinador -> ven todo según filtro
        if (perfilNum === 1 || perfilNum === 2) {
            if (includeAssigned && includeNull) {
                where.add(`(${condicionConAsignado} OR ${condicionSinAsignar})`);
            } else if (includeAssigned) {
                where.add(condicionConAsignado);
            } else if (includeNull && values.length) {
                where.add(
                    `(${condicionSinAsignar} OR ot.asignado IN (${values.map(() => "?").join(",")}))`,
                    ...values
                );
            } else if (includeNull) {
                where.add(condicionSinAsignar);
            } else if (values.length) {
                where.in("ot.asignado", values);
            }
        }

        // Armador -> solo asignadas a el
        else if (perfilNum === 3) {
            if (includeAssigned && includeNull) {
                where.add(`(ot.asignado = ? OR ${condicionSinAsignar})`, userId);
            } else if (includeAssigned) {
                where.add("ot.asignado = ?", userId);
            } else if (includeNull && values.length) {
                const valuesFiltrados = values.filter((v) => Number(v) === Number(userId));

                if (valuesFiltrados.length) {
                    where.add(
                        `(${condicionSinAsignar} OR ot.asignado IN (${valuesFiltrados.map(() => "?").join(",")}))`,
                        ...valuesFiltrados
                    );
                } else {
                    where.add(condicionSinAsignar);
                }
            } else if (includeNull) {
                where.add(condicionSinAsignar);
            } else if (values.length) {
                const valuesFiltrados = values.filter((v) => Number(v) === Number(userId));

                if (valuesFiltrados.length) {
                    where.in("ot.asignado", valuesFiltrados);
                } else {
                    // si mando asignados pero ninguno es el, no debe traer nada
                    where.add("1 = 0");
                }
            }
        }
    } else if (hasAsignadoQuery) {
        if (perfilNum === 1 || perfilNum === 2) {
            where.add(condicionConAsignado);
        } else if (perfilNum === 3) {
            where.add("ot.asignado = ?", userId);
        }
    } else if (perfilNum === 3) {
        where.add("ot.asignado = ?", userId);
    }

    if (filtros.tienda?.length) where.in("p.flex", filtros.tienda);

    if (filtros.urgente === 1) {
        where.add("DATE(ot.fecha_inicio) = CURDATE()");
        where.add("ot.fecha_inicio <= DATE_SUB(NOW(), INTERVAL 30 minute)");
    }

    if (filtros.alertada === 1) where.eq("ot.alertada", 1);
    else if (filtros.alertada === 0) where.eq("ot.alertada", 0);

    if (filtros.fecha_from) where.add(`${fechaFiltroColumna} >= ?`, filtros.fecha_from);
    if (filtros.fecha_to) where.add(`${fechaFiltroColumna} <= ?`, filtros.fecha_to);

    if (filtros.id_venta) where.likeCI("p.number", filtros.id_venta);
    if (filtros.producto_id_venta) {
        const term = `%${String(filtros.producto_id_venta).toLowerCase()}%`;
        where.add(
            `(
                LOWER(p.number) LIKE ?
                OR EXISTS (
                    SELECT 1
                    FROM pedidos_productos ppf
                    WHERE ppf.did_pedido = p.did
                      AND ppf.elim = 0
                      AND ppf.superado = 0
                      AND LOWER(ppf.descripcion) LIKE ?
                )
            )`,
            term,
            term
        );
    }

    const { whereSql, params } = where.finalize();

    const ordenesSql = `
        SELECT
            ot.did AS ot_did,
            ot.estado,
            ot.asignado,
            ot.fecha_inicio,
            ot.fecha_ultimo_movimiento,
            ot.fecha_asignado,
            ot.fecha_fin,
            ot.alertada,
            u.nombre AS asignado_nombre,
            otp.did_pedido,
            p.did AS pedido_did,
            p.did_cliente,
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

    const ordenesRowsRaw = await executeQuery({
        db,
        query: ordenesSql,
        values: params,
        log: true,
    });

    const ordenesRows = (ordenesRowsRaw ?? []).filter((row) => {
        const estado = Number(row?.estado);

        if (estado === 4) return false;

        if ((!Array.isArray(estadosQuery) || !estadosQuery.length) && estado === 3) {
            return false;
        }

        return true;
    });

    const didPedidos = Array.from(
        new Set(
            ordenesRows
                .map((x) => x?.did_pedido)
                .filter(Boolean)
        )
    );

    const productosPorPedido = new Map();
    const insumosPorPedido = new Map();

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
                pvv.ean,
                pvv.valores,
                pr.tiene_ie,
                pr.posicion
            FROM pedidos_productos pp
            LEFT JOIN productos pr
                ON pr.did = pp.did_producto
               AND pr.elim = 0
               AND pr.superado = 0
            LEFT JOIN productos_variantes_valores pvv
                ON pvv.did = pp.did_producto_variante_valor
               AND pvv.elim = 0
               AND pvv.superado = 0
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

        const didProductos = Array.from(
            new Set(
                (productosRows ?? [])
                    .map((row) => row?.did_producto)
                    .filter(Boolean)
            )
        );

        const recetasPorProducto = new Map();
        const didValoresVariante = Array.from(
            new Set(
                (productosRows ?? [])
                    .flatMap((row) =>
                        String(row?.valores ?? "")
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                    )
            )
        );
        const nombresValoresMap = new Map();

        if (didProductos.length > 0) {
            const insumosSql = `
                SELECT
                    pi.did_producto,
                    pi.did_insumo,
                    pi.cantidad,
                    i.nombre
                FROM productos_insumos pi
                LEFT JOIN insumos i
                    ON i.did = pi.did_insumo
                   AND i.elim = 0
                   AND i.superado = 0
                WHERE pi.elim = 0
                  AND pi.superado = 0
                  AND pi.did_producto IN (${didProductos.map(() => "?").join(",")})
                ORDER BY pi.did_producto, pi.did_insumo
            `;

            const insumosRows = await executeQuery({
                db,
                query: insumosSql,
                values: didProductos,
                log: true,
            });

            for (const row of insumosRows ?? []) {
                const productoKey = String(row.did_producto ?? "");
                if (!productoKey) continue;
                if (!recetasPorProducto.has(productoKey)) recetasPorProducto.set(productoKey, []);

                recetasPorProducto.get(productoKey).push({
                    did_insumo: String(row.did_insumo ?? ""),
                    nombre: row.nombre ?? "",
                    cantidad_base: Number(row.cantidad ?? 0),
                });
            }
        }

        if (didValoresVariante.length > 0) {
            const valoresSql = `
                SELECT
                    did,
                    nombre
                FROM variantes_categoria_valores
                WHERE elim = 0
                  AND superado = 0
                  AND did IN (${didValoresVariante.map(() => "?").join(",")})
            `;

            const valoresRows = await executeQuery({
                db,
                query: valoresSql,
                values: didValoresVariante,
                log: true,
            });

            for (const row of valoresRows ?? []) {
                nombresValoresMap.set(String(row.did ?? ""), row.nombre ?? "");
            }
        }

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
            if (!insumosPorPedido.has(key)) insumosPorPedido.set(key, []);
            const nombresVariantes = String(r.valores ?? "")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
                .map((did) => nombresValoresMap.get(String(did)) ?? "")
                .filter(Boolean);
            const tituloProducto = [r.descripcion ?? "", ...nombresVariantes]
                .filter(Boolean)
                .join(" ");

            productosPorPedido.get(key).push({
                did: String(r.did_producto ?? ""),
                titulo: tituloProducto,
                ean: String(r.ean ?? ""),
                sku: String(r.seller_sku ?? ""),
                posicion: r.posicion ?? "",
                cantidad: String(r.cantidad ?? "0"),
                did_producto_variante_valor: String(r.did_producto_variante_valor ?? ""),
                foto: r.imagen ?? "https://ff.lightdata.app/assets-app/img/sistema/img-default.png",
                stock: String(r.stock ?? "0"),
                identificadores_especiales: r.data_ie ?? [],
            });

            const recetaProducto = recetasPorProducto.get(String(r.did_producto ?? "")) ?? [];
            const cantidadProducto = Number(r.cantidad ?? 0);

            mergeInsumos(
                insumosPorPedido.get(key),
                recetaProducto.map((insumo) => ({
                    did_insumo: insumo.did_insumo,
                    nombre: insumo.nombre,
                    cantidad: cantidadProducto * Number(insumo.cantidad_base ?? 0),
                }))
            );
        }
    }

    const otMap = new Map();

    for (const s of ordenesRows) {
        const otKey = String(s.ot_did ?? "");
        const pedidoKey = String(s.did_pedido ?? "");

        if (!otMap.has(otKey)) {
            otMap.set(otKey, {
                did: otKey,
                estado: String(s.estado ?? ""),
                asignado: String(s.asignado ?? ""),
                nombre_asignado: s.asignado_nombre ?? "",
                fecha: s.fecha_inicio ?? "",
                fecha_ultimo_movimiento: s.fecha_ultimo_movimiento ?? "",
                fecha_asignado: s.fecha_asignado ?? "",
                // procesado: "0",
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
                did_cliente: String(s.did_cliente ?? ""),
                id_venta: String(s.number ?? ""),
                tienda: String(s.flex) ?? "",
                fecha: s.fecha_pedido ?? s.fecha_inicio ?? "",
                productos: productosPorPedido.get(pedidoKey) ?? [],
            });
            mergeInsumos(ot.insumos, insumosPorPedido.get(pedidoKey) ?? []);
        }
    }

    const data = Array.from(otMap.values()).filter((ot) => {
        const estado = Number(ot?.estado);

        if (estado === 4) return false;

        if ((!Array.isArray(estadosQuery) || !estadosQuery.length) && estado === 3) {
            return false;
        }

        return true;
    });

    const getSortValue = (ot) => {
        const primerPedido = ot?.pedidos?.[0] ?? {};

        switch (normalizedSortBy) {
            case "did_cliente":
                return String(primerPedido?.did_cliente ?? "");
            case "id_venta":
                return String(primerPedido?.id_venta ?? "");
            case "estado":
                return Number(ot?.estado ?? 0);
            case "tienda":
                return String(primerPedido?.tienda ?? "");
            case "asignado":
                return String(ot?.asignado ?? "");
            case "fecha":
            default:
                return new Date(
                    tipoFecha === 2
                        ? ot?.fecha_ultimo_movimiento
                        : tipoFecha === 3
                            ? ot?.fecha_asignado
                            : ot?.fecha
                ).getTime();
        }
    };

    data.sort((a, b) => {
        const aValue = getSortValue(a);
        const bValue = getSortValue(b);

        if (typeof aValue === "number" && typeof bValue === "number") {
            return normalizedSortDir === "desc" ? bValue - aValue : aValue - bValue;
        }

        const compare = String(aValue).localeCompare(String(bValue), "es", {
            numeric: true,
            sensitivity: "base",
        });

        return normalizedSortDir === "desc" ? compare * -1 : compare;
    });

    return {
        success: true,
        message: "Órdenes de Trabajo obtenidas correctamente",
        data,
    };
}
