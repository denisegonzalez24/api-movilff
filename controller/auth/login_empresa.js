import crypto from "crypto";
import { CustomException, generateToken, LightdataORM, Status } from "lightdata-tools";
import { companiesService, jwtAudience, jwtIssuer, jwtSecret } from "../../db.js";

export async function loginEmpresa({ db, req }) {
    const { companyCode } = req.body;


    const company = await companiesService.getByCode(companyCode);

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
            company: {
                did: company.did,
                perfil: company.codigo,
                nombre: company.nombre,
                apellido: company.modo_trabajo,
                imagen: sistemaData.imagen || null,
            }
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
