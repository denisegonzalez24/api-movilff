import { Router } from "express";
import { preloader } from "../controller/preload/preloader.js";
import { buildHandlerWrapper } from "../src/build_handler_wrapper.js";


const preload = Router();

preload.get(
    '/',
    buildHandlerWrapper({
        controller: async ({ db, req }) => await preloader({ db, req }),
    })
);


export default preload;
