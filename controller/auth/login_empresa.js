import crypto from "crypto";
import { CustomException, generateToken, LightdataORM, Status } from "lightdata-tools";
import { companiesService, jwtAudience, jwtIssuer, jwtSecret } from "../../db.js";
import { LightdataORMFix } from "../../src/ormFix.js";

export async function loginEmpresa({ db, req }) {
    const { companyCode } = req.body;

    const company = await companiesService.getByCode(companyCode);
    // console.log(company);

    if (!company) {
        throw new CustomException({
            title: "Empresa no encontrada",
            message: "La empresa no se encuentra registrada en el sistema",
            status: Status.notFound,
        });
    }

    const [sistemaData] = await LightdataORMFix.select({
        db,
        table: "sistema_empresa",
        where: {
            did: company.did,
        },
    });

    const identificadoresEspeciales = await LightdataORMFix.select({
        db,
        table: "identificadores_especiales",
        log: true,
    });

    //console.log(identificadoresEspeciales);

    if (!sistemaData) {
        throw new CustomException({
            title: "Empresa no encontrada",
            message: "La empresa no se encuentra registrada en el sistema",
            status: Status.notFound,
        });
    }

    const identificadores = (identificadoresEspeciales || []).map((i) => {
        let parsedData = i.data;
        // data viene como string JSON en tu ejemplo
        if (typeof parsedData === "string") {
            try {
                parsedData = JSON.parse(parsedData);
            } catch {
                // si no es JSON válido, lo dejamos como string
            }
        }

        return {
            did: String(i.did),
            nombre: i.nombre,
            data: parsedData,
        };
    });

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
            },
            identificadoresEspeciales: identificadores,
        },
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
}