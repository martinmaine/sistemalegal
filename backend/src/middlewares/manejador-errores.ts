import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Manejador de errores central. En producción no devuelve el detalle del error
 * al cliente —una cadena de conexión en un mensaje de error es una filtración—
 * pero sí lo registra en el log del servicio.
 */

export function manejadorErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error('[error]', mensaje);

  res.status(500).json({
    error: 'Error interno del servidor',
    detalle: config.entorno === 'production' ? undefined : mensaje,
  });
}

export function noEncontrado(req: Request, res: Response): void {
  res.status(404).json({ error: `No existe la ruta ${req.method} ${req.originalUrl}` });
}
