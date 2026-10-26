import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, origenAutorizado } from './config';
import { verificarBase } from './db';
import { requiereSesion } from './middlewares/autenticacion';
import { rutasAuth } from './modulos/auth/rutas';
import { rutasCausas } from './modulos/causas/rutas';
import { rutasCatalogos } from './modulos/catalogos/rutas';
import { rutasPanel } from './modulos/panel/rutas';
import { rutasPersonas } from './modulos/personas/rutas';
import { manejadorErrores, noEncontrado } from './middlewares/manejador-errores';

/**
 * Construcción de la app Express, separada del arranque del servidor para
 * poder probarla sin ocupar un puerto.
 */

export function crearApp(): Express {
  const app = express();

  // Render y Vercel ponen un proxy delante: sin esto, req.ip sería siempre la
  // del proxy y el límite de intentos de login se aplicaría a todo el mundo
  // junto. Se confía en un solo salto, no en toda la cadena de X-Forwarded-For.
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin(origen, callback) {
        // Sin cabecera Origin: curl, health checks de Render, pruebas. Se permite.
        if (!origen) return callback(null, true);
        if (origenAutorizado(origen)) return callback(null, true);
        return callback(new Error(`Origen no autorizado: ${origen}`));
      },
      // El refresh token viaja en cookie: sin esto el navegador no la manda.
      credentials: true,
    }),
  );
  // Tope de tamaño: sin límite explícito, un cuerpo enorme es una forma barata
  // de tumbar el servicio. Los archivos no viajan por acá, van por subida directa.
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  /**
   * Health check de Render.
   *
   * Devuelve 200 incluso si la base no responde, y el estado real va en el
   * cuerpo. Si devolviera 500, Render reiniciaría el servicio cada vez que la
   * base se pausa en la capa gratuita, que es justo lo que no queremos.
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

  app.use('/api/auth', rutasAuth);

  // Todo lo que sigue exige sesión. Se aplica acá y no ruta por ruta para que
  // agregar un módulo nuevo no pueda olvidarse de protegerlo.
  app.use('/api', requiereSesion);
  app.use('/api/panel', rutasPanel);
  app.use('/api/causas', rutasCausas);
  app.use('/api/personas', rutasPersonas);
  app.use('/api/catalogos', rutasCatalogos);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
