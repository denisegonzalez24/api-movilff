import { Router } from "express";
import { companiesService, companiesServiceFixed } from "../db.js";
import { login, logout, refresh } from "../controller/auth/login.js";
import { buildHandlerWrapper } from "../src/build_handler_wrapper.js";
import { loginEmpresa } from "../controller/auth/login_empresa.js";


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
            const company = await companiesServiceFixed.getByCode(companyCode);
            return company;
        },
        controller: ({ req, db }) => login({ db, req }),
    })
);
auth.post("/login/refresh", async (req, res, next) => {
    try {
        const result = await refresh({ req });
        res.json(result);
    } catch (e) {
        next(e);
    }
});



auth.post("/logout", async (req, res, next) => {
    try {
        const result = await logout({ req });
        res.json(result);
    } catch (e) {
        next(e);
    }
});


export default auth;
