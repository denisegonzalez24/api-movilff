import { LightdataORM } from "lightdata-tools";

export async function desasignarOrdenTrabajoQr({ db, req, company }) {
    const { userId, companyId } = req.user;
    const { motivo, dataQr } = req.body;
    const didPedido = Number(dataQr.didPedido);
    const now = new Date();

    const didEmpresaQr = Number(dataQr.didEmpresa);
    if (didEmpresaQr !== companyId) {
        throw new CustomException({
            status: 400,
            title: "Empresa no válida",
            message: "El QR no pertenece a una empresa del qr",
        });
    }


    const didOt = await LightdataORM.select({
        db,
        table: "ordenes_trabajo_pedidos",
        where: { did_pedido: didPedido },
        select: ["did_orden_trabajo"],
        trowIfNotFound: true
    });

    //todo queda estado 0
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

    //?  armado = 1 significaque la es una pv, estado de armado en proceso
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
