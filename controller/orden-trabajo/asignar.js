import { LightdataORM } from "lightdata-tools";

export async function asignarOrdenTrabajo({ db, req }) {
    const { did } = req.params;
    const { userId } = req.user;
    const { did_usuario } = req.body;

    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: did },
        data: { asignado: did_usuario },
        quien: userId,
        throwIfNotFound: true
    });

    return {
        success: true,
        message: "Orden de Trabajo asignada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
