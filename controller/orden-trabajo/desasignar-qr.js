import { LightdataORM } from "lightdata-tools";

export async function desasignarOrdenTrabajoQr({ db, req }) {
    const { userId } = req.user;
    const { motivo, dataQr } = req.body;
    const didPedido = Number(dataQr.didPedido);
    const now = new Date();

    const didOt = await LightdataORM.select({
        db,
        table: "ordenes_trabajo_pedidos",
        where: { did_pedido: didPedido },
        select: ["did_orden_trabajo"],
        trowIfNotFound: true
    });

    //? que es armado = 1, 2,3 etc
    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: didOt.did_orden_trabajo },
        data: {
            asignado: 0,
            motivo: motivo || null,
            fecha_asignado: now,
        },
        quien: userId,
        throwIfNotFound: true
    });

    //? que es armado = 1, 2,3 etc por ahora lo dejo en 1
    await LightdataORM.update({
        db,
        table: "pedidos",
        where: { did: didPedido },
        data: {
            armado: 1,
            quien_armado: 0,
            fecha_asignado: null,
        },
        quien: userId,
        throwIfNotFound: true
    });


    return {
        success: true,
        message: "Orden de Trabajo desasignada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
