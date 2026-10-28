import type { Request, Response, NextFunction } from 'express';
import { consultaValidada } from '../../middlewares/validacion';
import { ErrorSolicitud } from '../../comun/errores';
import { registrar } from '../auditoria/servicio';
import * as servicio from './servicio';
import { esquemaIdRuta } from './esquemas';
import type {
  DatosCrearPlazo,
  DatosCumplirPlazo,
  DatosEditarPlazo,
  DatosReanudarPlazo,
  DatosSimularPlazo,
  DatosSuspenderPlazo,
  FiltrosPlazo,
} from './esquemas';

function idDeRuta(req: Request, que = 'plazo'): string {
  const resultado = esquemaIdRuta.safeParse(req.params);
  if (!resultado.success) throw new ErrorSolicitud(`El identificador del ${que} no es válido.`);
  return resultado.data.id;
}

export async function getPlazos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await servicio.listarPlazos(consultaValidada<FiltrosPlazo>(req)));
  } catch (error) {
    next(error);
  }
}

export async function getPlazo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await servicio.obtenerDetalle(idDeRuta(req)));
  } catch (error) {
    next(error);
  }
}

/**
 * Previsualización del cómputo.
 *
 * No escribe nada, así que no se audita: es la misma información que el
 * usuario obtendría mirando un calendario.
 */
export async function postSimulacion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const resultado = await servicio.simular(
      idDeRuta(req, 'expediente'),
      req.body as DatosSimularPlazo,
    );

    res.json({
      fecha_inicio_computo: resultado.fechaInicioComputo,
      fecha_vencimiento: resultado.fechaVencimiento,
      explicacion: resultado.explicacion,
      dias: resultado.dias,
      corrido_por_inhabil: resultado.corridoPorInhabil,
    });
  } catch (error) {
    next(error);
  }
}

export async function postPlazo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const causaId = idDeRuta(req, 'expediente');
    const plazo = await servicio.crearPlazo(causaId, req.body as DatosCrearPlazo, req.sesion!.id);

    await registrar(req, {
      entidad: 'plazo',
      entidadId: plazo.id,
      accion: 'CREAR',
      datosDespues: plazo,
    });

    res.status(201).json({ plazo });
  } catch (error) {
    next(error);
  }
}

export async function putPlazo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { antes, despues } = await servicio.editarPlazo(
      idDeRuta(req),
      req.body as DatosEditarPlazo,
    );

    await registrar(req, {
      entidad: 'plazo',
      entidadId: despues.id,
      accion: 'ACTUALIZAR',
      datosAntes: antes,
      datosDespues: despues,
    });

    res.json({ plazo: despues });
  } catch (error) {
    next(error);
  }
}

export async function postCumplir(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { antes, despues } = await servicio.cumplirPlazo(
      idDeRuta(req),
      req.body as DatosCumplirPlazo,
    );

    await registrar(req, {
      entidad: 'plazo',
      entidadId: despues.id,
      accion: 'ACTUALIZAR',
      datosAntes: antes,
      datosDespues: despues,
    });

    res.json({ plazo: despues });
  } catch (error) {
    next(error);
  }
}

export async function postReabrir(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { antes, despues } = await servicio.reabrirPlazo(idDeRuta(req));

    await registrar(req, {
      entidad: 'plazo',
      entidadId: despues.id,
      accion: 'ACTUALIZAR',
      datosAntes: antes,
      datosDespues: despues,
    });

    res.json({ plazo: despues });
  } catch (error) {
    next(error);
  }
}

export async function postSuspender(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { antes, despues } = await servicio.suspenderPlazo(
      idDeRuta(req),
      req.body as DatosSuspenderPlazo,
      req.sesion!.id,
    );

    await registrar(req, {
      entidad: 'plazo',
      entidadId: despues.id,
      accion: 'ACTUALIZAR',
      datosAntes: antes,
      datosDespues: despues,
    });

    res.json({ plazo: despues });
  } catch (error) {
    next(error);
  }
}

export async function postReanudar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fecha_hasta } = req.body as DatosReanudarPlazo;
    const { antes, despues } = await servicio.reanudarPlazo(idDeRuta(req), fecha_hasta);

    await registrar(req, {
      entidad: 'plazo',
      entidadId: despues.id,
      accion: 'ACTUALIZAR',
      datosAntes: antes,
      datosDespues: despues,
    });

    res.json({ plazo: despues });
  } catch (error) {
    next(error);
  }
}

export async function deletePlazo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plazo = await servicio.eliminarPlazo(idDeRuta(req));

    await registrar(req, {
      entidad: 'plazo',
      entidadId: plazo.id,
      accion: 'ELIMINAR',
      datosAntes: plazo,
    });

    res.json({ plazo });
  } catch (error) {
    next(error);
  }
}
