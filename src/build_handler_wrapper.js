import { buildHandler, getFFProductionDbConfig } from "lightdata-tools";
import { companiesServiceFixed, companiesServiceTMS, hostFulFillement, portFulFillement } from "../db.js";


export function buildHandlerWrapper({
    required,
    optional,
    headers,
    status,
    companyResolver2,
    getDbConfig2,
    controller,
    log,
    pool,
}) {
    return buildHandler({
        required,
        optional,
        headers,
        status,
        controller,
        companyResolver: companyResolver2 || (({ req }) => companiesServiceFixed.getById(req.user.companyId)),
        getDbConfig: getDbConfig2 || (({ company }) => getFFProductionDbConfig({ companyId: company.did, host: hostFulFillement, port: portFulFillement })),
        log: log || (() => { }),
        pool,
    });
}