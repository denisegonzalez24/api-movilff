import { CustomException, LightdataORM } from "lightdata-tools";



export async function asignarOrdenTrabajoQr({ db, req }) {

    const { userId } = req.user;
    const { did_usuario, dataQr } = req.body;

    const now = new Date();
    if (dataQr.didEmpresa !== company.did) {
        throw new CustomException({
            status: 400,
            title: "Empresa no válida",
            message: "El QR no pertenece a una empresa del qr",
        });
    }

    // asocio el qr a un didPedido
    const didPedido = dataQr.didPedido;


    //? chequear si truena cuando el pedido no existe, o si el pedido ya tiene una orden de trabajo asociada
    let didOt = await LightdataORM.select({
        db,
        table: "pedidos",
        where: { did: didPedido },
        select: ["didOt"],
        trowIfNotFound: true,
        quien: userId
    })
    //si es null debo crear el pedido de venta

    if (!didOt) {
        //! verificar pedidos alertados -  esta parte me da duda
        const pedidoAlertado = await LightdataORM.select({
            db,
            table: "pedidos_productos",
            where: {
                did_pedido: did_pedidos,
                did_producto: null
            },
            quien: userId
        });

        did_ot = await LightdataORM.insert({
            db,
            table: "ordenes_trabajo",
            data: {
                estado: "1",
                asignado: did_usuario,
                fecha_inicio: new Date(),
                alertada: pedidoAlertado.length > 0
            },
            quien: userId
        });

        //traigo los pedidos asociados al didPedido y los asocio a la orden de trabajo
        const pedidosData = did_pedidos.map(item => {
            const did_pedido = typeof item === "object" ? item.did_pedido : item;
            if (!did_pedido) throw new Error("Falta did_pedido en alguno de los pedidos");

            return {
                did_orden_trabajo: did_ot,
                did_pedido,
            };
        });

        await LightdataORM.insert({
            db,
            table: "ordenes_trabajo_pedidos",
            data: pedidosData,
            quien: userId,
        });

        await LightdataORM.update({
            db,
            table: "pedidos",
            data: {
                armado: 1,
                quien_armado: userId,
                fecha_armado: new Date(),
                did_ot: did_ot
            },
            where: { did: did_pedidos },
            quien: userId,
        });

    }


    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: didOt },
        data: {
            asignado: did_usuario,
            fecha_asignado: now,
        },
        quien: userId
    });

    return {
        success: true,
        message: "Orden de Trabajo asignada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
