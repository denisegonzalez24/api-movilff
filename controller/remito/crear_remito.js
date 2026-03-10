import { LightdataORM } from "lightdata-tools";

export async function createRemito({ db, did_cliente, observaciones, accion, remito_dids, userId, fecha, did_ot }) {

    const remitosItemsA = Array.isArray(remito_dids) ? remito_dids : [];

    // const fecha = new Date();

    /* await LightdataORM.select({
         db,
         table: "remitos",
         where: { codigo },
         throwIfExists: true,
     });*/

    const [newId] = await LightdataORM.insert({
        db,
        table: "remitos",
        data: { did_cliente, observaciones, accion, fecha, did_ot },
        quien: userId,

    });
    if (remitosItemsA.length > 0) {
        const data = remitosItemsA.map(item => ({
            did: newId,
            did_remito: newId,
            did_producto: item.did_producto,
            did_combinacion: item.did_combinacion || null,
            cantidad: item.cantidad || "1",
            //     data: JSON.stringify(item.data || {}),
            quien: userId,
        }));


        await LightdataORM.insert({
            db,
            table: "remitos_items",
            quien: userId,
            data,

        });
    }

    return {
        success: true,
        message: "Remito creado correctamente",
        data: {
            did: newId,
            did_cliente,
            observaciones,
            accion,
            remitoItems: Array.from(remitosItemsA)
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
