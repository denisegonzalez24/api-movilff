import { Router } from "express";
import { buildHandlerWrapper } from "../src/build_handler_wrapper.js";
import { registrarTokenFcm } from "../controller/fcm/registrarToken.js";
import { enviarMensajeFcm } from "../controller/fcm/enviarMensaje.js";

const fcm = Router();

fcm.post(
    "/token",
    buildHandlerWrapper({
        optional: ["fcmToken", "deviceId", "deviceModel", "androidVersion", "appVersion", "plataforma", "tokenFcm"],
        controller: ({ req }) => registrarTokenFcm({ req }),
    })
);

fcm.post(
    "/mensaje",
    buildHandlerWrapper({
        required: ["titulo", "mensaje"],
        optional: ["didEmpresa", "perfil", "userId", "data"],
        controller: ({ req }) => enviarMensajeFcm({ req }),
    })
);

export default fcm;
