import { Router } from "express";
import { getArmadores, preloader } from "../controller/preload/preloader.js";
import { buildHandlerWrapper } from "../src/build_handler_wrapper.js";


const preload = Router();

preload.get(
    '/',
    buildHandlerWrapper({
        controller: async ({ db, req }) => await preloader({ db, req }),
    })
);

preload.get(
    '/armadores',
    buildHandlerWrapper({
        controller: async ({ db }) => await getArmadores({ db }),
    })
);


export default preload;
