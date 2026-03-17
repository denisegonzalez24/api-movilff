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
            motivo: motivo
        },
        quien: userId,
        throwIfNotFound: true
    });

    return {
        success: true,
        message: "Orden de Trabajo desestimada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
