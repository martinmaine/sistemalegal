import type { Request, Response, NextFunction } from 'express';
import { consultaValidada } from '../../middlewares/validacion';
import { ErrorSolicitud } from '../../comun/errores';
import { registrar } from '../auditoria/servicio';
import * as servicio from './servicio';
import {
  esquemaIdRuta,
  esquemaIdVinculo,
  type DatosAgregarParte,
  type DatosAgregarProfesional,
  type DatosCrearCausa,
  type DatosCrearMovimiento,
  type DatosEditarCausa,
  type FiltrosCausa,
} from './esquemas';

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

/** Valida los dos identificadores de una ruta anidada (/causas/:id/partes/:vinculoId). */
function idsDeVinculo(req: Request): { causaId: string; vinculoId: string } {
  const resultado = esquemaIdVinculo.safeParse(req.params);
  if (!resultado.success) throw new ErrorSolicitud('El identificador no es válido.');
  return { causaId: resultado.data.id, vinculoId: resultado.data.vinculoId };
}

export async function putCausa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { antes, despues } = await servicio.editarCausa(idDeRuta(req), req.body as DatosEditarCausa);

    await registrar(req, {
      entidad: 'causa',
      entidadId: despues.id,
      accion: 'ACTUALIZAR',
      datosAntes: antes,
      datosDespues: despues,
    });

    res.json({ causa: despues });
  } catch (error) {
    next(error);
  }
}

export async function deleteCausa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const eliminada = await servicio.eliminarCausa(idDeRuta(req));

    await registrar(req, {
      entidad: 'causa',
      entidadId: eliminada.id,
      accion: 'ELIMINAR',
      datosAntes: eliminada,
    });

    res.json({ causa: eliminada });
  } catch (error) {
    next(error);
  }
}

export async function postParte(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const causaId = idDeRuta(req);
    const parte = await servicio.agregarParte(causaId, req.body as DatosAgregarParte);

    await registrar(req, {
      entidad: 'parte_causa',
      entidadId: parte.id,
      accion: 'CREAR',
      datosDespues: { causa_id: causaId, ...parte },
    });

    res.status(201).json({ parte });
  } catch (error) {
    next(error);
  }
}

export async function deleteParte(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { causaId, vinculoId } = idsDeVinculo(req);
    const parte = await servicio.quitarParte(causaId, vinculoId);

    await registrar(req, {
      entidad: 'parte_causa',
      entidadId: parte.id,
      accion: 'ELIMINAR',
      datosAntes: { causa_id: causaId, ...parte },
    });

    res.json({ parte });
  } catch (error) {
    next(error);
  }
}

export async function postProfesional(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const causaId = idDeRuta(req);
    const profesional = await servicio.agregarProfesional(causaId, req.body as DatosAgregarProfesional);

    await registrar(req, {
      entidad: 'profesional_causa',
      entidadId: profesional.id,
      accion: 'CREAR',
      datosDespues: { causa_id: causaId, ...profesional },
    });

    res.status(201).json({ profesional });
  } catch (error) {
    next(error);
  }
}

export async function deleteProfesional(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { causaId, vinculoId } = idsDeVinculo(req);
    const profesional = await servicio.quitarProfesional(causaId, vinculoId);

    await registrar(req, {
      entidad: 'profesional_causa',
      entidadId: profesional.id,
      accion: 'ELIMINAR',
      datosAntes: { causa_id: causaId, ...profesional },
    });

    res.json({ profesional });
  } catch (error) {
    next(error);
  }
}

export async function postMovimiento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const causaId = idDeRuta(req);
    const movimiento = await servicio.agregarMovimiento(
      causaId,
      req.body as DatosCrearMovimiento,
      req.sesion!.id,
    );

    await registrar(req, {
      entidad: 'movimiento_causa',
      entidadId: movimiento.id,
      accion: 'CREAR',
      datosDespues: { causa_id: causaId, ...movimiento },
    });

    res.status(201).json({ movimiento });
  } catch (error) {
    next(error);
  }
}

export async function deleteMovimiento(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { causaId, vinculoId } = idsDeVinculo(req);
    const movimiento = await servicio.quitarMovimiento(causaId, vinculoId);

    await registrar(req, {
      entidad: 'movimiento_causa',
      entidadId: movimiento.id,
      accion: 'ELIMINAR',
      datosAntes: { causa_id: causaId, ...movimiento },
    });

    res.json({ movimiento });
  } catch (error) {
    next(error);
  }
}
