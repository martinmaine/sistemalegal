import { crearApp } from './app';
import { config } from './config';
import { cerrarPool } from './db';

/** Arranque del servicio. */

const servidor = crearApp().listen(config.puerto, () => {
  console.log(`[api] escuchando en el puerto ${config.puerto} (${config.entorno})`);
  if (!config.urlBaseDatos) {
    console.warn('[api] atención: DATABASE_URL no está definida, /api/causas va a fallar');
  }
});

/** Render envía SIGTERM al redesplegar: cerrar el pool evita conexiones colgadas en Neon. */
for (const senal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(senal, () => {
    console.log(`[api] ${senal} recibido, cerrando`);
    servidor.close(() => {
      void cerrarPool().finally(() => process.exit(0));
    });
  });
}
