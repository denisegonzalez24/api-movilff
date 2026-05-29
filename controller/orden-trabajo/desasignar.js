import { LightdataORM } from "lightdata-tools";

export async function desasignarOrdenTrabajo({ db, req }) {
    const { did } = req.params;
    const { userId, motivo } = req.body;
    const now = new Date();

    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: did },
        data: {
            asignado: 0,
            motivo: motivo || null,
            fecha_asignado: now,
        },
        quien: userId || 0,
        throwIfNotFound: true
    });

    const didPedido = await LightdataORM.select({
        db,
        table: "ordenes_trabajo_pedidos",
        where: { did_orden_trabajo: did },
        select: ["did_pedido"]
    });

    await LightdataORM.update({
        db,
        table: "pedidos",
        where: { did: didPedido },
        data: {
            armado: 1,
            quien_armado: 0,
            fecha_asignado: null,
        },
        quien: userId
    });


    return {
        success: true,
        message: "Orden de Trabajo desasignada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
