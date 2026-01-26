import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { createOrdenTrabajo } from "../controller/orden-trabajo/create_orden_trabajo.js";
import { editOrdenTrabajo } from "../controller/orden-trabajo/edit_orden_trabajo.js";
import { deleteOrdenTrabajo } from "../controller/orden-trabajo/delete_orden_trabajo.js";
import { changeEstadoAOrdenDeTrabajo } from "../controller/orden-trabajo/change_estado_a_orden_de_trabajo.js";
import { getFilteredOrdenesTrabajoByClienteFiltered } from "../controller/orden-trabajo/get_ordenes_trabajo_by_cliente_filtered.js";
import { getFilteredOrdenesTrabajoByDid } from "../controller/orden-trabajo/get_orden_trabajo_by_id.js";
import { desasignarOrdenTrabajo } from "../controller/orden-trabajo/desasignar.js";
import { informeArmado } from "../controller/orden-trabajo/informe_armado.js";
import { armar } from "../controller/orden-trabajo/armar.js";
import { desestimar } from "../controller/orden-trabajo/desestimar.js";
import { asignarOrdenTrabajo } from "../controller/orden-trabajo/asignar.js";
import { getFilteredOrdenesTrabajoByDids } from "../controller/orden-trabajo/getFilteredOrdenesTrabajoByDids.js";

const ordenes = Router();

ordenes.post(
    "/",
    buildHandlerWrapper({
        optional: ["estado", "did_usuario", "did_pedidos"],
        controller: async ({ db, req }) => createOrdenTrabajo({ db, req }),
    })
);

ordenes.put(
    "/cambiar-estado",
    buildHandlerWrapper({
        required: ["estado", "dids_ots"],
        controller: ({ db, req }) => changeEstadoAOrdenDeTrabajo({ db, req }),
    })
);

ordenes.put(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        optional: ["estado", "asignada", "pedidos", "fecha_fin"],
        controller: ({ db, req }) => editOrdenTrabajo({ db, req }),
    })
);

ordenes.delete(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => deleteOrdenTrabajo({ db, req }),
    })
);


ordenes.get(
    "/",
    buildHandlerWrapper({
        controller: async ({ db, req }) => getFilteredOrdenesTrabajoByClienteFiltered({ db, req }),
    })
);


ordenes.get(
    "/informe-armado",
    buildHandlerWrapper({
        requiredParams: ['fecha_from', 'fecha_to'],
        controller: ({ db, req }) => informeArmado({ db, req }),

    })
);
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

export default ordenes;
