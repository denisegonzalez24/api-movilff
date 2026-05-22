import { CustomException, executeQuery, LightdataORM, Status } from "lightdata-tools";

export async function marcarAvisoLeido({ db, req }) {
    const { userId } = req.user;
    const body = req.body || {};
    const didsInput = Array.isArray(body)
        ? body
        : Array.isArray(body.dids)
            ? body.dids
            : Array.isArray(body.did)
                ? body.did
                : req.params.did
                    ? [req.params.did]
                    : [];

    const dids = Array.from(
        new Set(
            didsInput
                .map((did) => String(did ?? "").trim())
                .filter(Boolean)
        )
    );

    if (!dids.length) {
        throw new CustomException({
            title: "Avisos requeridos",
            message: "Debe enviar al menos un did de aviso",
            status: Status.badRequest,
        });
    }

    const avisos = await executeQuery({
        db,
        query: `
            SELECT did, leido
            FROM avisos
            WHERE did IN (${dids.map(() => "?").join(",")})
              AND user_id = ?
              AND superado = 0
              AND elim = 0
        `,
        values: [...dids, userId],
        log: true,
    });

    const didsEncontrados = new Set((avisos ?? []).map((aviso) => String(aviso.did ?? "")));
    const didsFaltantes = dids.filter((did) => !didsEncontrados.has(String(did)));

    if (didsFaltantes.length) {
        throw new CustomException({
            title: "Avisos no encontrados",
            message: "Uno o mas avisos no existen o no pertenecen al usuario autenticado",
            status: Status.notFound,
        });
    }

    const didsParaActualizar = (avisos ?? [])
        .filter((aviso) => Number(aviso.leido) !== 1)
        .map((aviso) => String(aviso.did ?? ""))
        .filter(Boolean);

    if (didsParaActualizar.length) {
        await LightdataORM.update({
            db,
            table: "avisos",
            where: { did: didsParaActualizar },
            data: { leido: 1 },
            quien: userId,
            throwIfNotFound: true,
        });
    }

    return {
        success: true,
        message: "Avisos marcados como leidos correctamente",
        data: {
            dids,
            actualizados: didsParaActualizar.length,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
