import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { ErrorSolicitud } from '../comun/errores';

/**
 * Validación de la entrada en el borde HTTP.
 *
 * Todo lo que llega del cliente pasa por acá antes de tocar un servicio: el
 * resto del backend trabaja con datos ya tipados y verificados. El resultado
 * validado **reemplaza** al crudo, de modo que no quede forma de leer sin
 * querer el valor sin validar.
 */

/** Convierte los problemas de Zod en { campo: [mensajes] }, que es lo que el formulario necesita. */
function porCampo(problemas: readonly { path: PropertyKey[]; message: string }[]): Record<string, string[]> {
  const mapa: Record<string, string[]> = {};
  for (const problema of problemas) {
    const campo = problema.path.map(String).join('.') || '_';
    (mapa[campo] ??= []).push(problema.message);
  }
  return mapa;
}

export function validarCuerpo<T>(esquema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const resultado = esquema.safeParse(req.body);
    if (!resultado.success) {
      next(new ErrorSolicitud('Revisá los datos del formulario.', porCampo(resultado.error.issues)));
      return;
    }
    req.body = resultado.data;
    next();
  };
}

/**
 * Valida la query string.
 *
 * En Express 5 `req.query` es un getter sin setter, así que el resultado no se
 * puede asignar encima: se deja en `req.consulta`, que los controladores leen.
 */
export function validarConsulta<T>(esquema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const resultado = esquema.safeParse(req.query);
    if (!resultado.success) {
      next(new ErrorSolicitud('Los filtros de la búsqueda no son válidos.', porCampo(resultado.error.issues)));
      return;
    }
    req.consulta = resultado.data;
    next();
  };
}

/** Lee la consulta ya validada. El tipo lo aporta quien llama, que sabe qué esquema usó. */
export function consultaValidada<T>(req: Request): T {
  return req.consulta as T;
}
