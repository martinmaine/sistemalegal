import type { Request, Response, NextFunction } from 'express';
import * as servicio from './servicio';

/**
 * Capa de controlador: traduce HTTP a llamadas al servicio y nada más.
 * Los errores se delegan al manejador central con next(error).
 */

export async function getCausas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limiteCrudo = req.query.limite;
    const limite = typeof limiteCrudo === 'string' ? Number.parseInt(limiteCrudo, 10) : undefined;
    const listado = await servicio.listarCausas(limite);
    res.json(listado);
  } catch (error) {
    next(error);
  }
}
