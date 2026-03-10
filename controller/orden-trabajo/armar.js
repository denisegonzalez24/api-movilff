import { LightdataORM } from "lightdata-tools";
import { egresarStock } from "../../src/egresar_stock";


export async function armar({ db, req }) {
    const { userId } = req.user;
    const { did } = req.params;
    const { productos } = req.body ?? {};

    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did },
        quien: userId,
        data: { estado: 3 },
    });

    await LightdataORM.update({
        db,
        table: "pedidos",
        where: { did_ot: did },
        versionKey: "did_ot",
        quien: userId,
        data: {
            armado: 2,
            quien_armado: userId,
            fecha_armado: new Date(),
        },
    });
    const queryDidCliente = await LightdataORM.select({
        db,
        table: "pedidos",
        where: { did_ot: did },
        select: ["did_cliente", "number"],
        log: false,
    });

    const egreso = await egresarStock({
        db,
        productos,
        did_cliente: queryDidCliente[0]?.did_cliente,
        did_ot: did,
        quien: userId,
        modo: "ARMADO",
        fecha: new Date(),
        observacion: `Egreso por armado movil`,
        id_venta: queryDidCliente[0]?.number,
    });

    return {
        success: true,
        message: "Armado actualizado correctamente",
        data: egreso.data,
        meta: { timestamp: new Date().toISOString() },
    };
}
