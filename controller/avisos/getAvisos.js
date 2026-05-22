import { executeQuery } from "lightdata-tools";

export async function getAvisos({ db, req }) {
    const { userId } = req.user;
    const q = req.query || {};

    const leidoRaw = q.leido;
    const leido = leidoRaw === undefined || leidoRaw === null || leidoRaw === ""
        ? undefined
        : Number(leidoRaw) === 1
            ? 1
            : 0;

    const limitRaw = Number(q.limit ?? 20);
    const limit = Number.isFinite(limitRaw)
        ? Math.max(1, Math.min(Math.trunc(limitRaw), 20))
        : 20;

    const values = [userId];
    let leidoSql = "";

    if (leido !== undefined) {
        leidoSql = "AND leido = ?";
        values.push(leido);
    }

    const avisos = await executeQuery({
        db,
        query: `
            SELECT
                did,
                fecha,
                user_id,
                titulo,
                mensaje,
                tipo,
                valor,
                autofecha,
                leido
            FROM avisos
            WHERE user_id = ?
              AND superado = 0
              AND elim = 0
              ${leidoSql}
            ORDER BY leido ASC, fecha DESC, id DESC
            LIMIT ${limit}
        `,
        values,
        log: true,
    });

    return {
        success: true,
        message: "Avisos obtenidos correctamente",
        data: (avisos ?? []).map((aviso) => ({
            ...aviso,
            did: String(aviso.did ?? ""),
            user_id: String(aviso.user_id ?? ""),
            tipo: aviso.tipo === null || aviso.tipo === undefined ? "" : String(aviso.tipo),
            valor: aviso.valor === null || aviso.valor === undefined ? "" : String(aviso.valor),
            leido: String(aviso.leido ?? "0"),
        })),
        meta: { timestamp: new Date().toISOString(), limit },
    };
}
