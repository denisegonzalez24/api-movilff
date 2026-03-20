import { LightdataORM } from "lightdata-tools";

export async function desestimarOrdenTrabajo({ db, req }) {
    const { did } = req.params;
    const { userId } = req.user;

    const { did_usuario, motivo } = req.body;

    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: did },
        data: {
            estado: 4,
            motivo: motivo || null
        },
        quien: userId,
        throwIfNotFound: true
    });
    await LightdataORM.update({
        db,
        table: "pedidos",
        where: { did_ot: did },
        versionKey: "did_ot",
        quien: userId,
        data: {
            did_ot: null,
            armado: 3,
            fecha_armado: new Date(),
            quien_armado: userId,
        },
    });
    return {
        success: true,
        message: "Orden de Trabajo desestimada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
