import { Router, type Request, type Response, type NextFunction } from 'express';
import * as repositorio from './repositorio';

/**
 * Catálogos de referencia.
 *
 * No exige un permiso puntual más allá de tener sesión: son datos públicos del
 * Poder Judicial y la nómina del propio estudio, y cualquier pantalla del
 * sistema los necesita para armar sus desplegables.
 */

export const rutasCatalogos = Router();

rutasCatalogos.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await repositorio.obtenerTodos());
  } catch (error) {
    next(error);
  }
});
