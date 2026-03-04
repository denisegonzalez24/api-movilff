import crypto from "crypto";
import { CustomException, generateToken, LightdataORM, Status } from "lightdata-tools";
import { companiesService, jwtAudience, jwtIssuer, jwtSecret } from "../../db.js";
import { LightdataORMFix } from "../../src/ormFix.js";

export async function loginEmpresa({ db, req }) {
    const { companyCode } = req.body;



    const company = await companiesService.getByCode(companyCode);


    const [sistemaData] = await LightdataORMFix.select({
        db,
        table: "sistema_empresa",
        where: {
            did: company.did,
        }


    });

    if (
        !sistemaData
    ) {
        throw new CustomException({
            title: "Empresa no encontrada",
            message: "La empresa no se encuentra registrada en el sistema",
            status: Status.notFound,
        });
    }

    return {
        success: true,
        message: "Inicio de sesión exitoso",
        data: {
            company: {
                did: String(company.did),
                codigo: company.codigo,
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
