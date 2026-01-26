import { Router } from "express";
import { companiesService } from "../db.js";
import { login } from "../controller/auth/login.js";
import { buildHandlerWrapper } from "../src/build_handler_wrapper.js";


const auth = Router();

auth.post(
    '/login/empresa',
    buildHandlerWrapper({
        required: ['companyCode'],
        companyResolver2: async ({ req }) => {
            const { companyCode } = req.body;
            const company = await companiesService.getByCode(companyCode);
            return company;
        },
        controller: ({ req, db }) => loginEmpresa({ db, req }),
    })
);

auth.post(
    '/login/user',
    buildHandlerWrapper({
        required: ['username', 'password', 'companyCode'],
        companyResolver2: async ({ req }) => {
            const { companyCode } = req.body;
            const company = await companiesService.getByCode(companyCode);
            return company;
        },
        controller: ({ req, db }) => login({ db, req }),
    })
);

export default auth;
