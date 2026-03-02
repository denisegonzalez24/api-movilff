import crypto from "crypto";
import { CustomException, generateToken, LightdataORM, Status } from "lightdata-tools";
import { companiesService, jwtAudience, jwtIssuer, jwtSecret, redisClient } from "../../db.js";
import { LightdataORMFix } from "../../src/ormFix.js";

const ACCESS_TTL_SECONDS = 60 * 15;           // 15 minutos
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

// ✅ Hash fijo en Redis (como tu screenshot)
const REFRESH_HASH_KEY = "tokenFF";

function randomRefreshToken(bytes = 48) {
    return crypto.randomBytes(bytes).toString("base64url");
}

// ✅ Fingerprint para no guardar el refresh token en claro como field
function refreshFingerprint(refreshToken) {
    return crypto
        .createHmac("sha256", jwtSecret) // ideal: usar un secreto separado REFRESH_PEPPER
        .update(String(refreshToken))
        .digest("hex");
}

function invalidCredentials() {
    return new CustomException({
        title: "Credenciales inválidas",
        message: "Usuario o contraseña incorrectos",
        status: Status.unauthorized,
    });
}

export async function login({ db, req }) {
    const { username, password, companyCode } = req.body;

    const [user] = await LightdataORMFix.select({
        db,
        table: "usuarios",
        where: { usuario: username },
        status: Status.unauthorized,

    });

    // if (user == null) {

    //     throw new CustomException({
    //         title: "Credenciales inválidas",
    //         message: "Usuario o contraseña incorrectos",
    //         status: Status.unauthorized,
    //     });
    // }

    const inputHash = crypto.createHash("sha256").update(password).digest("hex").toLowerCase();
    const dbHash = String(user.pass || "").toLowerCase();

    const sameLength = dbHash.length === inputHash.length && dbHash.length > 0;
    if (!sameLength) throw invalidCredentials();

    const ok = crypto.timingSafeEqual(Buffer.from(dbHash, "utf8"), Buffer.from(inputHash, "utf8"));
    if (!ok) throw invalidCredentials();

    const company = await companiesService.getByCode(companyCode);

    const token = generateToken({
        jwtSecret,
        issuer: jwtIssuer,
        audience: jwtAudience,
        payload: {
            companyId: company.did,
            userId: user.did,
            profile: user.perfil,
            type: "access",
        },
        options: { expiresIn: ACCESS_TTL_SECONDS },
    });

    // 🔁 refresh token (cliente) + fingerprint (field en hash)
    const refreshToken = randomRefreshToken();
    const fp = refreshFingerprint(refreshToken);

    const session = {
        companyId: company.did,
        userId: user.did,
        profile: user.perfil,
        exp: Date.now() + REFRESH_TTL_SECONDS * 1000, // ✅ expiración por campo (manual)
    };

    // ✅ Guardar en HASH: key fija tokenFF, field=fp, value=session JSON
    await redisClient.hSet(REFRESH_HASH_KEY, fp, JSON.stringify(session));

    return {
        success: true,
        message: "Inicio de sesión exitoso",
        data: {
            user: {
                did: user.did,
                perfil: user.perfil,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                username: user.usuario,
                imagen: user.imagen || null,
                token,
                refreshToken, // ✅ al cliente siempre le devolvés el token real
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}

export async function refresh({ req }) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new CustomException({
            title: "Falta refresh token",
            message: "refreshToken requerido",
            status: Status.badRequest,
        });
    }
    console.log("dasdasd");

    const fp = refreshFingerprint(refreshToken);

    // ✅ Buscar en HASH
    const sessionStr = await redisClient.hGet(REFRESH_HASH_KEY, fp);

    if (!sessionStr) {
        throw new CustomException({
            title: "Refresh inválido",
            message: "Refresh token inválido o vencido",
            status: Status.unauthorized,
        });
    }

    const session = JSON.parse(sessionStr);

    // ✅ Expiración por campo (porque Redis Hash no tiene TTL por field)
    if (!session?.exp || Date.now() > session.exp) {
        await redisClient.hDel(REFRESH_HASH_KEY, fp);
        throw new CustomException({
            title: "Refresh inválido",
            message: "Refresh token inválido o vencido",
            status: Status.unauthorized,
        });
    }

    // ✅ Rotación: invalida el refresh usado
    await redisClient.hDel(REFRESH_HASH_KEY, fp);

    const newAccessToken = generateToken({
        jwtSecret,
        issuer: jwtIssuer,
        audience: jwtAudience,
        payload: {
            companyId: session.companyId,
            userId: session.userId,
            profile: session.profile,
            type: "access",
        },
        options: { expiresIn: ACCESS_TTL_SECONDS },
    });

    const newRefreshToken = randomRefreshToken();
    const newFp = refreshFingerprint(newRefreshToken);

    const newSession = {
        companyId: session.companyId,
        userId: session.userId,
        profile: session.profile,
        exp: Date.now() + REFRESH_TTL_SECONDS * 1000,
    };

    await redisClient.hSet(REFRESH_HASH_KEY, newFp, JSON.stringify(newSession));

    return {
        success: true,
        message: "Token renovado",
        data: {
            token: newAccessToken,
            refreshToken: newRefreshToken,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}

export async function logout({ req }) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new CustomException({
            title: "Falta refresh token",
            message: "refreshToken requerido",
            status: Status.badRequest,
        });
    }

    const fp = refreshFingerprint(refreshToken);
    await redisClient.hDel(REFRESH_HASH_KEY, fp);

    return {
        success: true,
        message: "Sesión cerrada",
        meta: { timestamp: new Date().toISOString() },
    };
}