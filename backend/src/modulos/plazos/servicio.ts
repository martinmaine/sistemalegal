import { armarPagina, type Pagina } from '../../comun/paginacion';
import { ErrorConflicto, ErrorNoEncontrado, ErrorSolicitud } from '../../comun/errores';
import { computarPlazo, type ResultadoComputo } from './computo';
import * as repositorio from './repositorio';
import type {
  DatosCrearPlazo,
  DatosCumplirPlazo,
  DatosEditarPlazo,
  DatosSimularPlazo,
  DatosSuspenderPlazo,
  FiltrosPlazo,
} from './esquemas';
import type { DetallePlazo, PlazoDetalle, PlazoListado } from './tipos';

/**
 * Reglas del módulo de plazos.
 *
 * Acá se decide **cuándo** se computa; el cómo vive en `computo.ts`, que es una
 * función pura y no sabe que existe una base de datos.
 */

/** Hoy en formato `YYYY-MM-DD`, en la zona horaria del servidor. */
function hoy(): string {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Corre el motor con el calendario de la causa.
 *
 * Un error del motor —una fecha imposible, una suspensión sin reanudar— es un
 * problema del dato cargado, no una falla del servidor: se traduce a un 400
 * con el mensaje que el motor escribió, que ya explica qué revisar.
 */
async function computar(
  causaId: string,
  insumos: DatosSimularPlazo,
  plazoId?: string,
): Promise<ResultadoComputo> {
  const jurisdiccionId = await repositorio.jurisdiccionDeCausa(causaId);
  if (!jurisdiccionId) throw new ErrorNoEncontrado('No encontramos ese expediente.');

  const [inhabiles, suspensiones] = await Promise.all([
    repositorio.inhabilesDesde(jurisdiccionId, insumos.fecha_notificacion),
    plazoId ? repositorio.suspensionesParaComputo(plazoId) : Promise.resolve([]),
  ]);

  try {
    return computarPlazo({
      fechaNotificacion: insumos.fecha_notificacion,
      fechaInicioComputo: insumos.fecha_inicio_computo,
      cantidadDias: insumos.cantidad_dias,
      computo: insumos.computo,
      inhabiles,
      suspensiones,
    });
  } catch (fallo) {
    throw new ErrorSolicitud(
      fallo instanceof Error ? fallo.message : 'No se pudo calcular el vencimiento.',
    );
  }
}

/** Previsualización: el formulario muestra la fecha antes de guardar nada. */
export async function simular(
  causaId: string,
  insumos: DatosSimularPlazo,
): Promise<ResultadoComputo> {
  return computar(causaId, insumos);
}

/**
 * Listado de plazos.
 *
 * Un plazo pendiente cuya fecha ya pasó **sigue siendo pendiente**: el abogado
 * todavía tiene que hacer algo con él. Que esté vencido se deduce de la fecha
 * —`dias_restantes` viene negativo— y la pantalla lo muestra en rojo arriba de
 * todo. Marcarlo automáticamente como VENCIDO lo sacaría del filtro de plazos
 * abiertos, que es exactamente la pantalla donde no puede faltar.
 *
 * El estado VENCIDO queda para cuando alguien decide cerrarlo como incumplido,
 * que es una decisión del estudio y no un efecto del paso del tiempo.
 */
export async function listarPlazos(filtros: FiltrosPlazo): Promise<Pagina<PlazoListado>> {
  const [datos, total] = await Promise.all([
    repositorio.listar(filtros),
    repositorio.contar(filtros),
  ]);
  return armarPagina(datos, total, filtros);
}

async function exigirPlazo(id: string): Promise<PlazoDetalle> {
  const plazo = await repositorio.buscarPorId(id);
  if (!plazo) throw new ErrorNoEncontrado('No encontramos ese plazo.');
  return plazo;
}

/**
 * Detalle con la explicación del cómputo.
 *
 * La explicación se rehace en el momento, con el calendario y las suspensiones
 * de ahora. Si el resultado no coincide con lo guardado, se informa en lugar de
 * pisar el dato: que el calendario haya cambiado después de computar un plazo
 * es algo que el abogado tiene que ver, no algo que el sistema deba resolver
 * solo.
 */
export async function obtenerDetalle(id: string): Promise<DetallePlazo> {
  const plazo = await exigirPlazo(id);
  const suspensiones = await repositorio.suspensionesDe(id);

  try {
    const resultado = await computar(
      plazo.causa_id,
      {
        fecha_notificacion: plazo.fecha_notificacion,
        fecha_inicio_computo: plazo.fecha_inicio_computo,
        cantidad_dias: plazo.cantidad_dias,
        computo: plazo.computo as 'HABIL' | 'CORRIDO',
        tipo_plazo_id: plazo.tipo_plazo_id ?? undefined,
      },
      id,
    );

    return {
      plazo,
      suspensiones,
      computo: {
        explicacion: resultado.explicacion,
        dias: resultado.dias,
        fecha_vencimiento_calculada: resultado.fechaVencimiento,
        coincide_con_lo_guardado: resultado.fechaVencimiento === plazo.fecha_vencimiento,
      },
    };
  } catch (fallo) {
    // El plazo existe y hay que poder verlo aunque su cómputo no se pueda
    // rehacer; se muestra lo guardado y se dice por qué falta la explicación.
    return {
      plazo,
      suspensiones,
      computo: null,
      error_computo: fallo instanceof Error ? fallo.message : 'No se pudo rehacer el cómputo.',
    };
  }
}

export async function crearPlazo(
  causaId: string,
  datos: DatosCrearPlazo,
  usuarioId: string,
): Promise<PlazoDetalle> {
  const resultado = await computar(causaId, datos);

  const id = await repositorio.crear(
    causaId,
    {
      ...datos,
      fecha_inicio_computo: resultado.fechaInicioComputo,
      fecha_vencimiento: resultado.fechaVencimiento,
    },
    usuarioId,
  );

  return exigirPlazo(id);
}

export interface ResultadoEdicionPlazo {
  antes: PlazoDetalle;
  despues: PlazoDetalle;
}

export async function editarPlazo(
  id: string,
  datos: DatosEditarPlazo,
): Promise<ResultadoEdicionPlazo> {
  const antes = await exigirPlazo(id);

  if (antes.estado === 'CUMPLIDO') {
    throw new ErrorConflicto(
      'Este plazo ya está cumplido. Si el dato quedó mal, reabrilo antes de corregirlo.',
    );
  }

  // Cambiar los insumos obliga a recalcular: guardar la fecha vieja junto a
  // días nuevos dejaría un plazo que no se explica a sí mismo.
  const resultado = await computar(antes.causa_id, datos, id);

  await repositorio.actualizar(id, {
    ...datos,
    fecha_inicio_computo: resultado.fechaInicioComputo,
    fecha_vencimiento: resultado.fechaVencimiento,
  });

  return { antes, despues: await exigirPlazo(id) };
}

export async function cumplirPlazo(
  id: string,
  datos: DatosCumplirPlazo,
): Promise<ResultadoEdicionPlazo> {
  const antes = await exigirPlazo(id);

  if (antes.estado === 'CUMPLIDO') {
    throw new ErrorConflicto('Este plazo ya figura como cumplido.');
  }
  if (antes.estado === 'CANCELADO') {
    throw new ErrorConflicto('Este plazo está cancelado.');
  }

  const fecha = datos.fecha_cumplimiento ?? hoy();
  if (fecha < antes.fecha_notificacion) {
    throw new ErrorSolicitud('El cumplimiento no puede ser anterior a la notificación.', {
      fecha_cumplimiento: ['No puede ser anterior a la notificación.'],
    });
  }

  await repositorio.marcarCumplido(id, fecha, datos.observaciones);
  return { antes, despues: await exigirPlazo(id) };
}

/** Un plazo cumplido se puede reabrir si se cargó por error. Queda auditado. */
export async function reabrirPlazo(id: string): Promise<ResultadoEdicionPlazo> {
  const antes = await exigirPlazo(id);

  if (antes.estado !== 'CUMPLIDO' && antes.estado !== 'CANCELADO') {
    throw new ErrorConflicto('Este plazo ya está abierto.');
  }

  await repositorio.cambiarEstado(id, 'PENDIENTE');
  return { antes, despues: await exigirPlazo(id) };
}

export async function suspenderPlazo(
  id: string,
  datos: DatosSuspenderPlazo,
  usuarioId: string,
): Promise<ResultadoEdicionPlazo> {
  const antes = await exigirPlazo(id);

  if (antes.estado !== 'PENDIENTE') {
    throw new ErrorConflicto('Solo se puede suspender un plazo pendiente.');
  }
  if (datos.fecha_desde < antes.fecha_inicio_computo) {
    throw new ErrorSolicitud('La suspensión no puede empezar antes que el cómputo.', {
      fecha_desde: ['No puede ser anterior al inicio del cómputo.'],
    });
  }

  await repositorio.suspender(id, datos, usuarioId);
  await recalcularVencimiento(id, antes);

  return { antes, despues: await exigirPlazo(id) };
}

export async function reanudarPlazo(id: string, fechaHasta: string): Promise<ResultadoEdicionPlazo> {
  const antes = await exigirPlazo(id);

  const abierta = await repositorio.suspensionAbierta(id);
  if (!abierta) throw new ErrorConflicto('Este plazo no tiene una suspensión abierta.');

  if (fechaHasta < abierta.fecha_desde) {
    throw new ErrorSolicitud('La reanudación no puede ser anterior al comienzo de la suspensión.', {
      fecha_hasta: ['No puede ser anterior al comienzo de la suspensión.'],
    });
  }

  await repositorio.reanudar(id, fechaHasta);
  await recalcularVencimiento(id, antes);

  return { antes, despues: await exigirPlazo(id) };
}

/**
 * Vuelve a computar el vencimiento con las suspensiones vigentes.
 *
 * Si el cómputo falla —por ejemplo, una suspensión sin fecha de reanudación,
 * que detiene el plazo indefinidamente— se deja el vencimiento como está: el
 * plazo queda en estado SUSPENDIDO, que es lo que la pantalla muestra, y la
 * fecha se recalcula al reanudarlo.
 */
async function recalcularVencimiento(id: string, plazo: PlazoDetalle): Promise<void> {
  try {
    const resultado = await computar(
      plazo.causa_id,
      {
        fecha_notificacion: plazo.fecha_notificacion,
        fecha_inicio_computo: plazo.fecha_inicio_computo,
        cantidad_dias: plazo.cantidad_dias,
        computo: plazo.computo as 'HABIL' | 'CORRIDO',
        tipo_plazo_id: plazo.tipo_plazo_id ?? undefined,
      },
      id,
    );
    await repositorio.actualizarVencimiento(id, resultado.fechaVencimiento);
  } catch {
    // Previsto: una suspensión abierta no tiene vencimiento calculable.
  }
}

export async function eliminarPlazo(id: string): Promise<PlazoDetalle> {
  const plazo = await exigirPlazo(id);
  await repositorio.eliminar(id);
  return plazo;
}
