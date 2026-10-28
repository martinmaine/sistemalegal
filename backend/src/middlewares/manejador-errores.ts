import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { ErrorHttp } from '../comun/errores';

/**
 * Manejador de errores central.
 *
 * Distingue dos clases de error:
 *
 *  - ErrorHttp: condición prevista (falta un permiso, el recurso no existe, el
 *    formulario tiene campos mal). Su mensaje está escrito para el usuario, así
 *    que viaja al cliente también en producción.
 *  - Cualquier otro: un fallo que no anticipamos. En producción se responde un
 *    500 sin detalle —el mensaje podría contener una cadena de conexión— y el
 *    detalle queda en el log del servicio.
 */

export function manejadorErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ErrorHttp) {
    // Los 4xx son parte del funcionamiento normal: no ensucian el log de errores.
    if (error.estado >= 500) console.error('[error]', error.codigo, error.message);

    res.status(error.estado).json({
      error: error.message,
      codigo: error.codigo,
      detalles: error.detalles,
    });
    return;
  }

  const mensaje = error instanceof Error ? error.message : String(error);
  console.error('[error]', mensaje);

  res.status(500).json({
    error: 'Error interno del servidor',
    codigo: 'ERROR_INTERNO',
    detalle: config.entorno === 'production' ? undefined : mensaje,
  });
}

export function noEncontrado(req: Request, res: Response): void {
  res.status(404).json({
    error: `No existe la ruta ${req.method} ${req.originalUrl}`,
    codigo: 'RUTA_INEXISTENTE',
  });
}
