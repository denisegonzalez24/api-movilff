import { CustomException, LightdataORM, logPurple } from "lightdata-tools";



export async function asignarOrdenTrabajoQr({ db, req, company }) {

    console.log("asignarOrdenTrabajoQr", { body: req.body, user: req.user });

    const { userId } = req.user;
    const { did_usuario, dataQr } = req.body;
    const companyId = Number(req.user.companyId);
    const now = new Date();
    const didEmpresaQr = Number(dataQr.didempresa);

    //! veifico si el qr pertenece a la epresa
    if (didEmpresaQr !== companyId) {
        throw new CustomException({
            status: 400,
            title: "Empresa no válida",
            message: "El QR no pertenece a la empresa",
        });
    }

    // asocio el qr a un didPedido
    const didPedido = Number(dataQr.didpedido);

    //? chequear si truena cuando el pedido no existe, o si el pedido ya tiene una orden de trabajo asociada
    //tomo pedido
    let [pedido] = await LightdataORM.select({
        db,
        table: "pedidos",
        where: { did: didPedido },
        select: ["did_ot", "did_cliente", "armado", "quien_armado", "alertado"],
        trowIfNotFound: true,
        quien: userId,
        log: true
    })
    //verifico: mismo asignado, estado pedido invalido, alertado = 1
    if (pedido.quien_armado == did_usuario) {
        throw new CustomException({
            title: "Pedido ya asignado",
            message: "El pedido ya está asignado a este usuario",
            status: 400,
        });
    }
    if (pedido.armado == 2 || pedido.armado == 3) {
        throw new CustomException({
            title: "Pedido armado o cancelado",
            message: "El pedido ya está en proceso de armado o ha sido cancelado, no se puede asignar la orden de trabajo",
            status: 400,
        });
    }
    if (pedido.alertado == 1) {
        throw new CustomException({
            title: "Pedido Alertado",
            message: "El pedido tiene productos alertados, no se puede asignar la orden de trabajo",
            status: 400,
        });
    }
    const didCliente = pedido.did_cliente;
    const didArmador = pedido.did_armador;
    const armado = pedido.armado;
    const quienArmado = pedido.quien_armado;
    const alertado = pedido.alertado;
    let didOt = pedido.did_ot;
    console.log("didOt", didOt);
    console.log("didCliente", didCliente);
    //si es null debo crear el pedido de venta

    if (!didOt) {
        logPurple("No tiene orden de trabajo, se creará una nueva");

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
            data: { estado: 1, fecha_inicio: now, fecha_asignado: now, asignado: did_usuario, alertada: 0 },
            quien: userId,
            log: true
        });

        await LightdataORM.insert({
            db,
            table: "ordenes_trabajo_pedidos",
            data: { did_orden_trabajo: didOt, did_pedido: didPedido, },
            quien: userId,
            log: true
        });

        await LightdataORM.update({
            db,
            table: "pedidos",
            data: {
                armado: 1,
                quien_armado: userId,
                fecha_armado: now,
                did_ot: didOt
            },
            where: { did: didPedido },
            quien: userId,
            log: true
        });

        return {
            success: true,
            message: "Orden de Trabajo asignada correctamente",
            data: { didOt, didCliente },
            meta: { timestamp: new Date().toISOString() },
        };
    } else {

        logPurple("La orden de trabajo ya existe, se actualizará el armado si es necesario y se reasignará la orden de trabajo");

        //si estaba armado actulizar
        if (quienArmado != did_usuario) {
            let updateArmado = await LightdataORM.update({
                db,
                table: "pedidos",
                data: {
                    armado: 1,
                    quien_armado: did_usuario, fecha_armado: now,
                },
                where: { did: didPedido },
                quien: userId,
                log: true
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
            quien: userId,
            log: true
        });

        return {
            success: true,
            message: "Orden de Trabajo asignada correctamente",
            data: { didOt, didCliente },
            meta: { timestamp: new Date().toISOString() },
        };
    }
}
