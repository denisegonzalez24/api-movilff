import { Router } from "express";
import { buildHandlerWrapper } from "../src/build_handler_wrapper.js";
import { getAvisos } from "../controller/avisos/getAvisos.js";
import { marcarAvisoLeido } from "../controller/avisos/marcarLeido.js";

const avisos = Router();

avisos.get(
    "/",
    buildHandlerWrapper({
        controller: ({ db, req }) => getAvisos({ db, req }),
    })
);

avisos.put(
    "/leido",
    buildHandlerWrapper({
        controller: ({ db, req }) => marcarAvisoLeido({ db, req }),
    })
);

avisos.put(
    "/:did/leido",
    buildHandlerWrapper({
        controller: ({ db, req }) => marcarAvisoLeido({ db, req }),
    })
);

export default avisos;
