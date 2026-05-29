import { CustomException, LightdataORM } from "lightdata-tools";



export async function asignarOrdenTrabajoQr({ db, req, company }) {

    const { userId, companyId } = req.user;
    const { did_usuario, dataQr } = req.body;

    const now = new Date();
    console.log("dataQr", dataQr);
    console.log("companyId", companyId);
    const didEmpresaQr = Number(dataQr.didEmpresa);
    if (didEmpresaQr !== companyId) {
        throw new CustomException({
            status: 400,
            title: "Empresa no válida",
            message: "El QR no pertenece a una empresa del qr",
        });
    }

    // asocio el qr a un didPedido
    const didPedido = Number(dataQr.didPedido);

    //? chequear si truena cuando el pedido no existe, o si el pedido ya tiene una orden de trabajo asociada
    let didOt = await LightdataORM.select({
        db,
        table: "pedidos",
        where: { did: didPedido },
        select: ["didOt", "didCliente", "armado", "quienArmado", "alertado"],
        trowIfNotFound: true,
        quien: userId
    })

    if (didOt.alertad == 1) {
        throw new CustomException({
            title: "Pedido Alertado",
            message: "El pedido tiene productos alertados, no se puede asignar la orden de trabajo",
            status: 400,
        });
    }
    const didCliente = didOt.didCliente;
    const didArmador = didOt.didArmador;
    const armado = didOt.armado;
    const quienArmado = didOt.quienArmado;
    const alertado = didOt.alertado;
    didOt = didOt.didOt;
    console.log("didOt", didOt);
    console.log("didCliente", didCliente);
    //si es null debo crear el pedido de venta

    if (!didOt) {

        //! revisar si vale la pena verificar aca o no
        /*
        const pedidoAlertado = await LightdataORM.select({
            db,
            table: "pedidos_productos",
            where: {
                did_pedido: didPedido,
                did_producto: null
            },
            quien: userId
        });
        if (pedidoAlertado.length > 0) {
            throw new CustomException({
                status: 400,
                title: "Pedido Alertado",
                message: "El pedido tiene productos alertados, no se puede asignar la orden de trabajo",
            });
        }
*/
        //traigo los pedidos asociados al didPedido y los asocio a la orden de trabajo
        didOt = await LightdataORM.insert({
            db,
            table: "ordenes_trabajo",
            data: { estado: 1, fecha_inicio: new Date(), fecha_asignado: new Date(), asignado: did_usuario },
            quien: userId
        });

        await LightdataORM.insert({
            db,
            table: "ordenes_trabajo_pedidos",
            data: { did_orden_trabajo: didOt, did_pedido: didPedido, },
            quien: userId,
        });

        await LightdataORM.update({
            db,
            table: "pedidos",
            data: {
                armado: 1,
                quien_armado: userId,
                fecha_armado: new Date(),
                did_ot: didOt
            },
            where: { did: didPedido },
            quien: userId,
        });

        return {
            success: true,
            message: "Orden de Trabajo asignada correctamente",
            data: { didOt, didCliente },
            meta: { timestamp: new Date().toISOString() },
        };
    } else {


        //si estaba armado actulizar
        if (quienArmado != did_usuario) {
            updateArmado = await LightdataORM.update({
                db,
                table: "pedidos",
                data: {
                    armado: 1,
                    quien_armado: did_usuario, fecha_armado: new Date(),
                },
                where: { did: didPedido },
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
            data: { didOt, didCliente },
            meta: { timestamp: new Date().toISOString() },
        };
    }
}
