import { CustomException, executeQuery, LightdataORM, Status } from "lightdata-tools";

export async function marcarAvisoLeido({ db, req }) {
    const { did } = req.params;
    const { userId } = req.user;

    if (!String(did || "").trim()) {
        throw new CustomException({
            title: "Aviso requerido",
            message: "Debe enviar el did del aviso",
            status: Status.badRequest,
        });
    }

    const [aviso] = await executeQuery({
        db,
        query: `
            SELECT did, leido
            FROM avisos
            WHERE did = ?
              AND user_id = ?
              AND superado = 0
              AND elim = 0
            LIMIT 1
        `,
        values: [did, userId],
        log: true,
    });

    if (!aviso) {
        throw new CustomException({
            title: "Aviso no encontrado",
            message: "No se encontro el aviso para el usuario autenticado",
            status: Status.notFound,
        });
    }

    if (Number(aviso.leido) !== 1) {
        await LightdataORM.update({
            db,
            table: "avisos",
            where: { did },
            data: { leido: 1 },
            quien: userId,
            throwIfNotFound: true,
        });
    }

    return {
        success: true,
        message: "Aviso marcado como leido correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
