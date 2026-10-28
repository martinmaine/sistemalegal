import { armarPagina, type Pagina } from '../../comun/paginacion';
import { ErrorConflicto, ErrorNoEncontrado, ErrorSolicitud } from '../../comun/errores';
import * as repositorio from './repositorio';
import * as plazosRepositorio from '../plazos/repositorio';
import type { PlazoListado } from '../plazos/tipos';
import type {
  DatosAgregarParte,
  DatosAgregarProfesional,
  DatosCrearCausa,
  DatosCrearMovimiento,
  DatosEditarCausa,
  FiltrosCausa,
} from './esquemas';
import type {
  CausaDetalle,
  CausaListada,
  DocumentoCausa,
  MovimientoCausa,
  ParteCausa,
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

/**
 * Plazos del expediente.
 *
 * Delega en el módulo de plazos en lugar de tener su propia consulta: la
 * pestaña del expediente y la agenda muestran lo mismo, y con dos consultas
 * distintas terminarían mostrando columnas distintas del mismo plazo.
 */
export async function plazos(id: string): Promise<PlazoListado[]> {
  await exigirCausa(id);
  return plazosRepositorio.listar({
    causa: id,
    vigencia: 'todos',
    pagina: 1,
    tamano: 200,
    orden: 'fecha_vencimiento',
    direccion: 'asc',
  });
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

/** Devuelve el antes y el después: la auditoría guarda ambos para poder comparar. */
export interface ResultadoEdicion {
  antes: CausaDetalle;
  despues: CausaDetalle;
}

export async function editarCausa(id: string, datos: DatosEditarCausa): Promise<ResultadoEdicion> {
  const antes = await repositorio.buscarPorId(id);
  if (!antes) throw new ErrorNoEncontrado('No encontramos ese expediente.');

  // Se excluye la propia causa: guardar sin cambiar el número no es un duplicado.
  if (datos.numero_expediente && (await repositorio.existeExpedienteEnOtra(datos.numero_expediente, id))) {
    throw new ErrorConflicto('Ya existe otro expediente con ese número.', {
      numero_expediente: ['Ya existe otro expediente con ese número.'],
    });
  }

  const actualizo = await repositorio.actualizar(id, datos);
  if (!actualizo) throw new ErrorNoEncontrado('No encontramos ese expediente.');

  const despues = await repositorio.buscarPorId(id);
  if (!despues) throw new ErrorNoEncontrado('El expediente se guardó pero no se pudo leer.');
  return { antes, despues };
}

export async function eliminarCausa(id: string): Promise<CausaDetalle> {
  const antes = await repositorio.buscarPorId(id);
  if (!antes) throw new ErrorNoEncontrado('No encontramos ese expediente.');

  const elimino = await repositorio.eliminar(id);
  if (!elimino) throw new ErrorNoEncontrado('No encontramos ese expediente.');
  return antes;
}

export async function agregarParte(causaId: string, datos: DatosAgregarParte): Promise<ParteCausa> {
  await exigirCausa(causaId);

  // uq_parte_causa cubre (causa, persona, carácter): la misma persona puede ser
  // actor en una causa y testigo en otra, e incluso tener dos caracteres en la
  // misma, pero no el mismo dos veces.
  if (await repositorio.existeParte(causaId, datos.persona_id, datos.caracter)) {
    throw new ErrorConflicto('Esa persona ya figura en el expediente con ese carácter.', {
      persona_id: ['Esa persona ya figura con ese carácter.'],
    });
  }

  const id = await repositorio.agregarParte(causaId, datos);
  const parte = await repositorio.buscarParte(causaId, id);
  if (!parte) throw new ErrorNoEncontrado('La parte se agregó pero no se pudo leer.');
  return parte;
}

export async function quitarParte(causaId: string, parteId: string): Promise<ParteCausa> {
  await exigirCausa(causaId);

  const parte = await repositorio.buscarParte(causaId, parteId);
  if (!parte) throw new ErrorNoEncontrado('Esa parte no figura en el expediente.');

  await repositorio.quitarParte(causaId, parteId);
  return parte;
}

export async function agregarProfesional(
  causaId: string,
  datos: DatosAgregarProfesional,
): Promise<ProfesionalCausa> {
  await exigirCausa(causaId);

  // Se valida contra la base y no solo contra el desplegable: el desplegable
  // ofrece únicamente integrantes activos, pero la API es alcanzable sin pasar
  // por la pantalla.
  if (!(await repositorio.esProfesionalAsignable(datos.usuario_id))) {
    throw new ErrorSolicitud('Ese integrante del estudio no existe o está dado de baja.', {
      usuario_id: ['No es un integrante activo del estudio.'],
    });
  }

  if (await repositorio.estaAsignado(causaId, datos.usuario_id)) {
    throw new ErrorConflicto('Esa persona ya está asignada al expediente.', {
      usuario_id: ['Ya está asignada a este expediente.'],
    });
  }

  const id = await repositorio.agregarProfesional(causaId, datos);
  const profesional = await repositorio.buscarProfesional(causaId, id);
  if (!profesional) throw new ErrorNoEncontrado('La asignación se guardó pero no se pudo leer.');
  return profesional;
}

export async function quitarProfesional(causaId: string, vinculoId: string): Promise<ProfesionalCausa> {
  await exigirCausa(causaId);

  const profesional = await repositorio.buscarProfesional(causaId, vinculoId);
  if (!profesional) throw new ErrorNoEncontrado('Esa asignación no existe en el expediente.');

  // Un expediente sin nadie a cargo desaparece de "mis causas", deja de tener a
  // quién notificarle un vencimiento y no se le pueden delegar tareas. Antes de
  // quedar vacío conviene asignar a otra persona.
  if ((await repositorio.contarProfesionales(causaId)) <= 1) {
    throw new ErrorConflicto(
      'El expediente quedaría sin nadie a cargo. Asigná a otra persona antes de quitar a esta.',
    );
  }

  await repositorio.quitarProfesional(causaId, vinculoId);
  return profesional;
}

export async function agregarMovimiento(
  causaId: string,
  datos: DatosCrearMovimiento,
  usuarioId: string,
): Promise<MovimientoCausa> {
  await exigirCausa(causaId);

  const id = await repositorio.agregarMovimiento(causaId, datos, usuarioId);
  const movimiento = await repositorio.buscarMovimiento(causaId, id);
  if (!movimiento) throw new ErrorNoEncontrado('El movimiento se guardó pero no se pudo leer.');
  return movimiento;
}

export async function quitarMovimiento(
  causaId: string,
  movimientoId: string,
): Promise<MovimientoCausa> {
  await exigirCausa(causaId);

  const movimiento = await repositorio.buscarMovimiento(causaId, movimientoId);
  if (!movimiento) throw new ErrorNoEncontrado('Ese movimiento no existe en el expediente.');

  if (movimiento.origen !== 'MANUAL') {
    // Un movimiento importado refleja lo que publicó el tribunal; borrarlo a
    // mano dejaría el expediente diciendo algo distinto de la fuente.
    throw new ErrorConflicto('Solo se pueden borrar los movimientos cargados a mano.');
  }

  await repositorio.quitarMovimiento(causaId, movimientoId);
  return movimiento;
}
