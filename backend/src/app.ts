import express, { type Express } from 'express';
import cors from 'cors';
import { config, origenAutorizado } from './config';
import { verificarBase } from './db';
import { rutasCausas } from './modulos/causas/rutas';
import { manejadorErrores, noEncontrado } from './middlewares/manejador-errores';

/**
 * Construcción de la app Express, separada del arranque del servidor para
 * poder probarla sin ocupar un puerto.
 */

export function crearApp(): Express {
  const app = express();

  app.use(
    cors({
      origin(origen, callback) {
        // Sin cabecera Origin: curl, health checks de Render, pruebas. Se permite.
        if (!origen) return callback(null, true);
        if (origenAutorizado(origen)) return callback(null, true);
        return callback(new Error(`Origen no autorizado: ${origen}`));
      },
    }),
  );
  app.use(express.json());

  /**
   * Health check de Render.
   *
   * Devuelve 200 incluso si la base no responde, y el estado real va en el
   * cuerpo. Si devolviera 500, Render reiniciaría el servicio cada vez que Neon
   * se autosuspende en la capa gratuita, que es justo lo que no queremos.
   */
  app.get('/health', async (_req, res) => {
    const base = await verificarBase().catch((error: unknown) => ({
      conectada: false as const,
      error: error instanceof Error ? error.message : String(error),
    }));

    res.json({
      estado: 'ok',
      entorno: config.entorno,
      base: base.conectada ? 'conectada' : 'sin-conexion',
      detalleBase: base.conectada ? undefined : base.error,
      momento: new Date().toISOString(),
    });
  });

  app.use('/api/causas', rutasCausas);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
