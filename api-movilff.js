import express from "express";
import cors from "cors";
import auth from "./routes/auth.route.js";
import { logBlue, logRed, verifyToken } from "lightdata-tools";
import { initRedis } from "./db.js";
import preload from "./routes/preload.route.js";
import ordenes from "./routes/ordenes_trabajo.route.js";
import dashboard from "./routes/home.route.js";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

const PORT = process.env.PORT || 3000;

const jwtSecret = process.env.JWT_SECRET;
const jwtIssuer = process.env.JWT_ISSUER;
const jwtAudience = process.env.JWT_AUDIENCE;

// rutas
app.use("/api/auth", auth);
app.use(verifyToken({ jwtSecret, jwtIssuer, jwtAudience }));
app.use("/api/preload", preload);
app.use("/api/ordenes-trabajo", ordenes);
app.use("/api/home", dashboard);

const start = async () => {
  try {
    await initRedis();           // <- CLAVE
    app.listen(PORT, () => {
      logBlue(`Servidor corriendo en el puerto ${PORT}`);
    });
  } catch (err) {
    logRed(err);
    process.exit(1);
  }
};

start();
