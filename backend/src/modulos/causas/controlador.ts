import type { Request, Response, NextFunction } from 'express';
import { consultaValidada } from '../../middlewares/validacion';
import { ErrorSolicitud } from '../../comun/errores';
import { registrar } from '../auditoria/servicio';
import * as servicio from './servicio';
import { esquemaIdRuta, type DatosCrearCausa, type FiltrosCausa } from './esquemas';

/**
 * Capa de controlador: traduce HTTP a llamadas al servicio y nada más.
 * Los errores se delegan al manejador central con next(error).
 */

/** Valida el :id de la ruta antes de usarlo. Sin esto, un id mal formado llega al SQL como texto. */
function idDeRuta(req: Request): string {
  const resultado = esquemaIdRuta.safeParse(req.params);
  if (!resultado.success) throw new ErrorSolicitud('El identificador del expediente no es válido.');
  return resultado.data.id;
}

export async function getCausas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await servicio.listarCausas(consultaValidada<FiltrosCausa>(req)));
  } catch (error) {
    next(error);
  }
}

export async function getCausa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await servicio.obtenerDetalle(idDeRuta(req)));
  } catch (error) {
    next(error);
  }
}

export async function getMovimientos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ datos: await servicio.movimientos(idDeRuta(req)) });
  } catch (error) {
    next(error);
  }
}

export async function getPlazos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ datos: await servicio.plazos(idDeRuta(req)) });
  } catch (error) {
    next(error);
  }
}

export async function getDocumentos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ datos: await servicio.documentos(idDeRuta(req)) });
  } catch (error) {
    next(error);
  }
}

export async function getTareas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ datos: await servicio.tareas(idDeRuta(req)) });
  } catch (error) {
    next(error);
  }
}

export async function postCausa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const creada = await servicio.crearCausa(req.body as DatosCrearCausa, req.sesion!.id);

    await registrar(req, {
      entidad: 'causa',
      entidadId: creada.id,
      accion: 'CREAR',
      datosDespues: creada,
    });

    res.status(201).json({ causa: creada });
  } catch (error) {
    next(error);
  }
}
