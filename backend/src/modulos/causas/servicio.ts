import { armarPagina, type Pagina } from '../../comun/paginacion';
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores';
import * as repositorio from './repositorio';
import type { DatosCrearCausa, FiltrosCausa } from './esquemas';
import type {
  CausaDetalle,
  CausaListada,
  DocumentoCausa,
  MovimientoCausa,
  ParteCausa,
  PlazoCausa,
  ProfesionalCausa,
  TareaCausa,
} from './tipos';

/** Capa de servicio: reglas de negocio del módulo de causas. */

export async function listarCausas(filtros: FiltrosCausa): Promise<Pagina<CausaListada>> {
  // El conteo y el listado se piden en paralelo: son dos consultas
  // independientes y esperarlas en serie duplicaría la latencia del listado.
  const [datos, total] = await Promise.all([repositorio.listar(filtros), repositorio.contar(filtros)]);
  return armarPagina(datos, total, filtros);
}

export interface DetalleCompleto {
  causa: CausaDetalle;
  partes: ParteCausa[];
  profesionales: ProfesionalCausa[];
}

/**
 * Detalle de la cabecera del expediente.
 *
 * Trae partes y profesionales porque son listas cortas que la pantalla muestra
 * siempre. Los movimientos, plazos, documentos y tareas viven en pestañas y se
 * piden aparte: pueden ser largos y no tiene sentido traerlos si nadie los abre.
 */
export async function obtenerDetalle(id: string): Promise<DetalleCompleto> {
  const causa = await repositorio.buscarPorId(id);
  if (!causa) throw new ErrorNoEncontrado('No encontramos ese expediente.');

  const [partes, profesionales] = await Promise.all([
    repositorio.partesDe(id),
    repositorio.profesionalesDe(id),
  ]);

  return { causa, partes, profesionales };
}

/** Confirma que la causa existe antes de devolver el contenido de una pestaña. */
async function exigirCausa(id: string): Promise<void> {
  const causa = await repositorio.buscarPorId(id);
  if (!causa) throw new ErrorNoEncontrado('No encontramos ese expediente.');
}

export async function movimientos(id: string): Promise<MovimientoCausa[]> {
  await exigirCausa(id);
  return repositorio.movimientosDe(id);
}

export async function plazos(id: string): Promise<PlazoCausa[]> {
  await exigirCausa(id);
  return repositorio.plazosDe(id);
}

export async function documentos(id: string): Promise<DocumentoCausa[]> {
  await exigirCausa(id);
  return repositorio.documentosDe(id);
}

export async function tareas(id: string): Promise<TareaCausa[]> {
  await exigirCausa(id);
  return repositorio.tareasDe(id);
}

export async function crearCausa(datos: DatosCrearCausa, usuarioId: string): Promise<CausaDetalle> {
  // La base ya tiene un índice único sobre numero_expediente, así que esto no
  // es lo que garantiza la unicidad: es lo que permite responder un mensaje
  // claro en el campo correcto en lugar de un error de restricción.
  if (datos.numero_expediente && (await repositorio.existeExpediente(datos.numero_expediente))) {
    throw new ErrorConflicto('Ya existe un expediente con ese número.', {
      numero_expediente: ['Ya existe un expediente con ese número.'],
    });
  }

  const id = await repositorio.crear(datos, usuarioId);
  const creada = await repositorio.buscarPorId(id);
  if (!creada) throw new ErrorNoEncontrado('La causa se creó pero no se pudo leer.');
  return creada;
}
