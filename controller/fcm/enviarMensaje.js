import { CustomException, Status } from "lightdata-tools";
import {
    FCM_TOKENS_HASH,
    getFirebaseMessaging,
    normalizeFcmData,
    requireFcmTarget,
    scanFcmTokenEntries,
} from "../../src/fcm.js";
import { redisClient } from "../../db.js";

function isInvalidFcmTokenError(error) {
    const code = String(error?.errorInfo?.code || error?.code || "");
    return [
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
    ].includes(code);
}

function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

export async function enviarMensajeFcm({ req }) {
    const { didEmpresa: didEmpresaBody, perfil, userId, titulo, mensaje, data } = req.body;
    const didEmpresa = didEmpresaBody || req.user.companyId;

    requireFcmTarget({ userId, perfil });

    if (!String(titulo || "").trim() || !String(mensaje || "").trim()) {
        throw new CustomException({
            title: "Mensaje incompleto",
            message: "Debe enviar titulo y mensaje",
            status: Status.badRequest,
        });
    }

    const pattern = userId
        ? `${didEmpresa}:*:${userId}:*`
        : `${didEmpresa}:${perfil}:*:*`;

    const entries = await scanFcmTokenEntries(pattern);
    const tokens = Array.from(
        new Set(
            entries
                .map((entry) => String(entry?.value?.token || "").trim())
                .filter(Boolean)
        )
    );

    if (!tokens.length) {
        return {
            success: true,
            message: "No hay tokens FCM registrados para el destino indicado",
            data: {
                tokensEncontrados: 0,
                enviados: 0,
                fallidos: 0,
            },
            meta: { timestamp: new Date().toISOString() },
        };
    }

    const messaging = getFirebaseMessaging();
    const responses = [];
    const fieldsInvalidos = [];

    for (const tokenChunk of chunkArray(tokens, 500)) {
        const response = await messaging.sendEachForMulticast({
            tokens: tokenChunk,
            notification: {
                title: String(titulo),
                body: String(mensaje),
            },
            data: normalizeFcmData(data),
        });

        responses.push(response);

        response.responses.forEach((item, index) => {
            if (!item.success && isInvalidFcmTokenError(item.error)) {
                const tokenInvalido = tokenChunk[index];
                for (const entry of entries) {
                    if (String(entry?.value?.token || "") === tokenInvalido) {
                        fieldsInvalidos.push(entry.field);
                    }
                }
            }
        });
    }

    if (fieldsInvalidos.length) {
        await redisClient.hDel(FCM_TOKENS_HASH, Array.from(new Set(fieldsInvalidos)));
    }

    const enviados = responses.reduce((acc, item) => acc + Number(item.successCount || 0), 0);
    const fallidos = responses.reduce((acc, item) => acc + Number(item.failureCount || 0), 0);

    return {
        success: true,
        message: "Mensaje FCM procesado correctamente",
        data: {
            tokensEncontrados: tokens.length,
            enviados,
            fallidos,
            tokensEliminados: fieldsInvalidos.length,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
