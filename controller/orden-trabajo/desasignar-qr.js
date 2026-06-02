import { CustomException, LightdataORM, logPurple } from "lightdata-tools";

export async function desasignarOrdenTrabajoQr({ db, req, company }) {
    logPurple("desasignarOrdenTrabajoQr", { body: req.body, user: req.user });
    const { userId } = req.user;
    const { motivo, dataQr } = req.body;
    const didPedido = Number(dataQr.didpedido);
    const now = new Date();

    const didEmpresaQr = Number(dataQr.didempresa);
    const companyId = Number(req.user.companyId);
    if (didEmpresaQr !== companyId) {
        throw new CustomException({
            status: 400,
            title: "Empresa no válida",
            message: "El QR no pertenece a una empresa del qr",
        });
    }


    const [ordenPedido] = await LightdataORM.select({
        db,
        table: "ordenes_trabajo_pedidos",
        where: { did_pedido: didPedido },
        select: ["did_orden_trabajo", "did_cliente"],
        trowIfNotFound: true,
        log: true
    });

    const didOt = ordenPedido.did_orden_trabajo;

    const [ot] = await LightdataORM.select({
        db,
        table: "ordenes_trabajo",
        where: { did: didOt },
        select: ["asignado", "estado", "did"]
    });
    if (ot.estado == 3) {
        throw new CustomException({
            status: 409,
            title: "Orden de trabajo finalizada",
            message: "No se puede desasignar una orden que ya fue armada",
        });
    }

    if (!ot.did) {
        throw new CustomException({
            status: 404,
            title: "Pedido de venta no encontrado",
            message: "No se encontró un PV asociado la pedido",
        });
    }
    //!verificar si no esta armado
    if (ot.asignado == 0) {
        throw new CustomException({
            status: 409,
            title: "Orden de trabajo no asignada",
            message: "No se puede desasignar una orden no asignada",
        });
    }


    //todo queda estado 0
    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: didOt },
        data: {
            asignado: 0,
            motivo: motivo || null,
            fecha_asignado: null,
        },
        quien: userId,
        log: true
    });

    //?  armado = 1 significaque la es una pv, estado de armado en proceso
    //todo definir si aca queda = 0 O 1
    await LightdataORM.update({
        db,
        table: "pedidos",
        where: { did: didPedido },
        data: {
            armado: 1,
            quien_armado: 0,
            fecha_armado: null,
        },
        quien: userId,
        throwIfNotFound: true,
        log: true
    });


    return {
        success: true,
        message: "Orden de Trabajo desasignada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
