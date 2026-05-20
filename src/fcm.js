import crypto from "crypto";
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { CustomException, Status } from "lightdata-tools";
import { redisClient } from "../db.js";

export const FCM_TOKENS_HASH = "fcmTokens";

export function hashFcmToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex").slice(0, 16);
}

export function buildFcmField({ didEmpresa, perfil, userId, tokenHash }) {
    return [didEmpresa, perfil, userId, tokenHash].map((value) => String(value).trim()).join(":");
}

function parsePrivateKey(value) {
    return String(value || "").replace(/\\n/g, "\n");
}

export function getFirebaseMessaging() {
    if (!getApps().length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

        if (projectId && clientEmail && privateKey) {
            initializeApp({
                credential: cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
        } else {
            initializeApp({
                credential: applicationDefault(),
            });
        }
    }

    return getMessaging();
}

export async function scanFcmTokenEntries(pattern) {
    const entries = [];

    for await (const item of redisClient.hScanIterator(FCM_TOKENS_HASH, {
        MATCH: pattern,
        COUNT: 500,
    })) {
        const field = item?.field ?? item?.[0];
        const value = item?.value ?? item?.[1];

        if (!field || !value) continue;

        try {
            entries.push({ field, value: JSON.parse(value) });
        } catch {
            entries.push({ field, value: { token: value } });
        }
    }

    return entries;
}

export function requireFcmTarget({ userId, perfil }) {
    if (userId || perfil) return;

    throw new CustomException({
        title: "Destino requerido",
        message: "Debe enviar userId o perfil para mandar el mensaje FCM",
        status: Status.badRequest,
    });
}

export function normalizeFcmData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;

    return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [String(key), String(value)])
    );
}

