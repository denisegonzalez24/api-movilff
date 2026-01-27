import { Router } from "express";

import { buildHandlerWrapper } from "../src/build_handler_wrapper.js";
import { home } from "../controller/home/home.js";


const dashboard = Router();

dashboard.get(
    '/',
    buildHandlerWrapper({
        controller: async ({ db, req }) => await home({ db, req }),
    })
);


export default dashboard;
