import { Router } from "express";




import { buildHandlerWrapper } from "../src/build_handler_wrapper.js";
import { getFilteredOrdenesTrabajoByClienteFiltered } from "../controller/orden-trabajo/getOrdenDeTrabajo.js";
import { desasignarOrdenTrabajo } from "../controller/orden-trabajo/desasignar.js";
import { asignarOrdenTrabajo } from "../controller/orden-trabajo/asignar.js";

const ordenes = Router();



ordenes.get(
    "/",
    buildHandlerWrapper({
        controller: async ({ db, req }) => getFilteredOrdenesTrabajoByClienteFiltered({ db, req }),
    })
);

ordenes.put(
    "/:did/asignar",
    buildHandlerWrapper({
        requiredParams: ["did"],
        optional: ["did_usuario"],
        controller: ({ db, req }) => asignarOrdenTrabajo({ db, req }),
    })
);

ordenes.put(
    "/:did/desasignar",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => desasignarOrdenTrabajo({ db, req }),
    })
);
/*
ordenes.get(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => getFilteredOrdenesTrabajoByDid({ db, req }),
    })
);
ordenes.get(
    "/multiple/:dids",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => getFilteredOrdenesTrabajoByDids({ db, req }),
    })
);


ordenes.put(
    "/:did/asignar",
    buildHandlerWrapper({
        requiredParams: ["did"],
        optional: ["did_usuario"],
        controller: ({ db, req }) => asignarOrdenTrabajo({ db, req }),
    })
);

ordenes.put(
    "/:did/desasignar",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => desasignarOrdenTrabajo({ db, req }),
    })
);

ordenes.put(
    "/:did/armar",
    buildHandlerWrapper({
        requiredParams: ["did"],
        required: ["productos"],
        controller: ({ db, req }) => armar({ db, req }),
    })
);

ordenes.put(
    "/:did/desestimar",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => desestimar({ db, req }),
    })
);
*/
export default ordenes;
