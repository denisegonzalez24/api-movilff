import crypto from "crypto";
import { CustomException, generateToken, LightdataORM, Status } from "lightdata-tools";
import { companiesService, jwtAudience, jwtIssuer, jwtSecret } from "../../db.js";

export async function login({ db, req }) {
    const { username, password, companyCode } = req.body;

    const [user] = await LightdataORM.select({
        db,
        table: "usuarios",
        where: { usuario: username, },
        throwIfNotExists: true,
    });

    const invalid = () =>
        new CustomException({
            title: "Credenciales inválidas",
            message: "Usuario o contraseña incorrectos",
            status: Status.unauthorized,
        });

    const inputHash = crypto.createHash("sha256").update(password).digest("hex").toLowerCase();
    const dbHash = String(user.pass || "").toLowerCase();

    const sameLength = dbHash.length === inputHash.length && dbHash.length > 0;
    if (!sameLength) throw invalid();
    const ok = crypto.timingSafeEqual(
        Buffer.from(dbHash, "utf8"),
        Buffer.from(inputHash, "utf8")
    );
    if (!ok) throw invalid();

    const company = await companiesService.getByCode(companyCode);

    const token = generateToken({
        jwtSecret: jwtSecret,
        issuer: jwtIssuer,
        audience: jwtAudience,
        payload: {
            companyId: company.did,
            userId: user.did,
            profile: user.perfil,
        },
        options: {},
        expiresIn: 3600 * 8,
    });

    const [sistemaData] = await LightdataORM.select({
        db,
        table: "sistema_empresa",
        where: {
            did: company.did,
        }
    });

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
                token: token,
            }
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
