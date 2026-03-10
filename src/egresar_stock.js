// egresoStockArmadoGlobal.js
import { CustomException, LightdataORM } from "lightdata-tools";
import { createRemito } from "../controller/remito/crear_remito";


/**
 * Modo:
 * - "ARMADO" → usa identificadores_especiales
 * - "EGRESO_DIRECTO" → usa combinaciones normales (did_stock_producto_detalle)
 */
export async function egresarStock({
    db,
    productos,
    quien,
    modo = "",
    did_cliente = null,
    observacion = null,
    fecha = null,
    did_ot = null,
    id_venta = null,
}) {
    if (!productos?.length) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Debes enviar productos con combinaciones"
        });
    }

    const resultados = [];
    const errores = [];

    // ACA ACUMULAMOS TODAS LAS LÍNEAS DEL REMITO
    const remitoItems = [];

    for (const producto of productos) {
        const { did_producto, combinaciones } = producto;

        if (!combinaciones?.length) {
            errores.push({
                did_producto,
                motivo: "El producto no tiene combinaciones"
            });
            continue;
        }

        for (const comb of combinaciones) {
            const {
                did_combinacion,
                cantidad,
                did_stock_producto_detalle,
                identificadores_especiales
            } = comb;

            try {

                // 1) Traer fila vigente de stock_producto
                const spRows = await LightdataORM.select({
                    db,
                    table: "stock_producto",
                    where: {
                        did_producto,
                        did_producto_combinacion: did_combinacion
                    },
                    throwIfNotExists: true,
                });

                const sp = spRows[0];

                if (sp.stock_combinacion < cantidad) {
                    errores.push({
                        did_producto,
                        did_combinacion,
                        motivo: "Stock insuficiente",
                        requerido: cantidad,
                        disponible: sp.stock_combinacion
                    });
                    continue;
                }


                // una linea por data ie
                if (modo === "ARMADO") {
                    if (identificadores_especiales == 0) {
                        const [spRows] = await LightdataORM.select({
                            db,
                            table: "stock_producto",
                            where: {
                                did_producto,
                                did_producto_combinacion: did_combinacion
                            },
                            throwIfNotExists: true,
                            log: true
                        });

                        await LightdataORM.update({
                            db,
                            table: "stock_producto",
                            where: { did: sp.did },
                            data: {
                                stock_combinacion: spRows.stock_combinacion - cantidad,
                                tipo: "EGRESO",
                                cantidad_movimiento: cantidad,
                                observaciones: observacion || null,
                                id_venta: id_venta || undefined
                            },
                            quien,
                        });

                    } else {
                        // se hace asi porque en informe debo mostrar linea por linea de cada lote que se egreso de stock 
                        for (const det of identificadores_especiales || []) {

                            const [spRows] = await LightdataORM.select({
                                db,
                                table: "stock_producto",
                                where: {
                                    did_producto,
                                    did_producto_combinacion: did_combinacion
                                },
                                throwIfNotExists: true,
                                log: true
                            });

                            const insertStock = await LightdataORM.update({
                                db,
                                table: "stock_producto",
                                where: { did: sp.did },
                                data: {
                                    stock_combinacion: spRows.stock_combinacion - det.cantidad,
                                    tipo: "EGRESO",
                                    cantidad_movimiento: det.cantidad,
                                    observaciones: observacion || null,
                                    id_venta: id_venta || undefined
                                },
                                quien,
                            });


                            const rowsDet = await LightdataORM.select({
                                db,
                                table: "stock_producto_detalle",
                                where: { did: det.did },
                                throwIfNotExists: true,
                            });

                            const vigenteDet = rowsDet[0];

                            await LightdataORM.update({
                                db,
                                table: "stock_producto_detalle",
                                where: { did: det.did },
                                data: {
                                    stock: vigenteDet.stock - det.cantidad,
                                    tipo: "EGRESO",
                                    did_producto_variante_stock: insertStock
                                },
                                quien,
                            });

                        }
                    }
                } else {
                    // egreso normal 
                    const [id] = await LightdataORM.update({
                        db,
                        table: "stock_producto", where: { did: sp.did },
                        data: {
                            stock_combinacion: sp.stock_combinacion - cantidad,
                            tipo: "EGRESO",
                            cantidad_movimiento: cantidad,
                            observaciones: observacion || null,
                            id_venta: null
                        },
                        quien,
                    });
                    if (did_stock_producto_detalle) {
                        const detRow = await LightdataORM.select({
                            db,
                            table: "stock_producto_detalle",
                            where: { did: did_stock_producto_detalle },
                            throwIfNotExists: true,
                        });

                        const det = detRow[0];

                        await LightdataORM.update({
                            db,
                            table: "stock_producto_detalle",
                            where: { did: did_stock_producto_detalle },
                            data: {
                                stock: det.stock - cantidad,
                                tipo: "EGRESO",
                                did_producto_variante_stock: id
                            },
                            quien,
                        });
                    }
                }

                remitoItems.push({
                    did_producto,
                    did_combinacion,
                    cantidad
                });


                resultados.push({
                    did_producto,
                    did_combinacion,
                    cantidad,
                    estado: "OK",
                });

            } catch (err) {
                errores.push({
                    did_producto,
                    did_combinacion,
                    error: err.message,
                });
            }
        }
    }

    // 5) CREAR EL REMITO UNA SOLA VEZ (SI CORRESPONDE)
    if (remitoItems.length > 0) {
        await createRemito({
            db,
            did_cliente,
            observaciones: observacion,
            accion: "EGRESO",
            userId: quien,
            fecha,
            remito_dids: remitoItems,
            did_ot,
        });
    }

    return {
        success: true,
        message: "Egreso global ejecutado",
        data: { resultados, errores },
    };
}
