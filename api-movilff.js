import express from "express";
import cors from "cors";
import auth from "./routes/auth.route.js";
import { logBlue, logRed, verifyToken } from "lightdata-tools";
import { initRedis } from "./db.js";
import preload from "./routes/preload.route.js";
import ordenes from "./routes/ordenes_trabajo.route.js";
import dashboard from "./routes/home.route.js";
import { collectSatMetrics } from "./src/satMetrics.js";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

const PORT = process.env.PORT || 3000;

const jwtSecret = process.env.JWT_SECRET;
const jwtIssuer = process.env.JWT_ISSUER;
const jwtAudience = process.env.JWT_AUDIENCE;

// rutas

app.get('/ping', (req, res) => {
  const start = process.hrtime.bigint();
  const end = process.hrtime.bigint();

  let ms = Number(end - start) / 1_000_000;

  if (ms < 1) ms = 1;

  res.send(Math.round(ms).toString());
});
app.get("/_sat/metrics", async (req, res) => {
  try {
    const data = await collectSatMetrics({
      serviceName: "mi-servicio-x",
      includeProcessCpu: true,
      processCpuSampleMs: 120,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: "error", message: String(e?.message || e) });
  }
});

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
