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

    return {
        success: true,
        message: "Orden de Trabajo desasignada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
