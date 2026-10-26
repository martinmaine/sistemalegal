import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { consultaValidada } from '../../middlewares/validacion';
import { ErrorSolicitud } from '../../comun/errores';
import * as servicio from './servicio';
import type { FiltrosPersona } from './esquemas';

const esquemaIdRuta = z.object({ id: z.uuid('Identificador inválido.') });

function idDeRuta(req: Request): string {
  const resultado = esquemaIdRuta.safeParse(req.params);
  if (!resultado.success) throw new ErrorSolicitud('El identificador de la persona no es válido.');
  return resultado.data.id;
}

export async function getPersonas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await servicio.listarPersonas(consultaValidada<FiltrosPersona>(req)));
  } catch (error) {
    next(error);
  }
}

export async function getPersona(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await servicio.obtenerDetalle(idDeRuta(req)));
  } catch (error) {
    next(error);
  }
}
