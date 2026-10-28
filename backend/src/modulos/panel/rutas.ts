import { Router, type Request, type Response, type NextFunction } from 'express';
import * as servicio from './servicio';

/**
 * Panel de inicio.
 *
 * No declara un permiso puntual: lo que muestra ya se recorta según los
 * permisos del usuario dentro del servicio. Un empleado sin acceso a costas
 * recibe el mismo endpoint sin el bloque financiero.
 */

export const rutasPanel = Router();

rutasPanel.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await servicio.armarPanel(req.sesion!));
  } catch (error) {
    next(error);
  }
});
