import { CustomException, Status } from "lightdata-tools";
import {
    FCM_TOKENS_HASH,
    buildFcmField,
    hashFcmToken,
    scanFcmTokenEntries,
} from "../../src/fcm.js";
import { redisClient } from "../../db.js";

export async function registrarTokenFcm({ req }) {
    const {
        tokenFcm,
        fcmToken,
        plataforma,
        deviceId,
        deviceModel,
        androidVersion,
        appVersion,
    } = req.body || {};
    const didEmpresa = req.user.companyId;
    const userId = req.user.userId;
    const perfil = req.user.profile;
    const rawToken = fcmToken ?? tokenFcm;

    if (!String(rawToken || "").trim()) {
        throw new CustomException({
            title: "Token FCM requerido",
            message: "Debe enviar fcmToken",
            status: Status.badRequest,
        });
    }

    const token = String(rawToken).trim();
    const tokenHash = hashFcmToken(token);

    const entradasAnteriores = await scanFcmTokenEntries(`*:*:*:${tokenHash}`);
    if (entradasAnteriores.length) {
        await redisClient.hDel(FCM_TOKENS_HASH, entradasAnteriores.map((entry) => entry.field));
    }

    const field = buildFcmField({ didEmpresa, perfil, userId, tokenHash });
    const value = {
        token,
        didEmpresa: String(didEmpresa),
        perfil: String(perfil),
        userId: String(userId),
        plataforma: plataforma ? String(plataforma) : "",
        deviceId: deviceId ? String(deviceId) : "",
        deviceModel: deviceModel ? String(deviceModel) : "",
        androidVersion: androidVersion ? String(androidVersion) : "",
        appVersion: appVersion ? String(appVersion) : "",
        updatedAt: new Date().toISOString(),
    };

    await redisClient.hSet(FCM_TOKENS_HASH, field, JSON.stringify(value));

    return {
        success: true,
        message: "Token FCM registrado correctamente",
        data: {
            field,
            tokenAlias: "fcmToken",
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
