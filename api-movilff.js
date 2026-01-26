import express, { json, urlencoded } from 'express';
import cors from "cors";
import auth from './routes/auth.route.js';
import { verifyToken } from 'lightdata-tools';


const app = express();

app.use(json({ limit: '50mb' }));
app.use(urlencoded({ limit: '50mb', extended: true }));
app.use(json());
app.use(cors());

const PORT = process.env.PORT;


//rutas
app.use("/api/auth", auth);
// app.use("/api/pedidos_cancelar", pedidosCancelar);
app.use(verifyToken({ jwtSecret, jwtIssuer, jwtAudience }));
// app.use("/api/sincronizacion-envios", sincronizacion);



(async () => {
  try {
    app.listen(PORT, () => {
      logBlue(`Servidor corriendo en el puerto ${PORT}`);
    });

    process.on("SIGINT", async () => {
      process.exit();
    });
  } catch (err) {
    logRed(err);
  }
})();
