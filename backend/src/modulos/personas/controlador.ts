import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { consultaValidada } from '../../middlewares/validacion';
import { ErrorSolicitud } from '../../comun/errores';
import { registrar } from '../auditoria/servicio';
import * as servicio from './servicio';
import type { DatosPersona, FiltrosPersona } from './esquemas';

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

export async function postPersona(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const persona = await servicio.crearPersona(req.body as DatosPersona);

    await registrar(req, {
      entidad: 'persona',
      entidadId: persona.id,
      accion: 'CREAR',
      datosDespues: persona,
    });

    res.status(201).json({ persona });
  } catch (error) {
    next(error);
  }
}

export async function putPersona(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { antes, despues } = await servicio.editarPersona(idDeRuta(req), req.body as DatosPersona);

    await registrar(req, {
      entidad: 'persona',
      entidadId: despues.id,
      accion: 'ACTUALIZAR',
      datosAntes: antes,
      datosDespues: despues,
    });

    res.json({ persona: despues });
  } catch (error) {
    next(error);
  }
}

export async function deletePersona(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const persona = await servicio.eliminarPersona(idDeRuta(req));

    await registrar(req, {
      entidad: 'persona',
      entidadId: persona.id,
      accion: 'ELIMINAR',
      datosAntes: persona,
    });

    res.json({ persona });
  } catch (error) {
    next(error);
  }
}
