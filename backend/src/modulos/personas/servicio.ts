import { armarPagina, type Pagina } from '../../comun/paginacion';
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores';
import * as repositorio from './repositorio';
import type { DatosPersona, FiltrosPersona } from './esquemas';
import type { CausaDePersona, PersonaDetalle, PersonaListada } from './repositorio';

/** Capa de servicio del módulo de personas. */

export async function listarPersonas(filtros: FiltrosPersona): Promise<Pagina<PersonaListada>> {
  const [datos, total] = await Promise.all([repositorio.listar(filtros), repositorio.contar(filtros)]);
  return armarPagina(datos, total, filtros);
}

export interface DetallePersona {
  persona: PersonaDetalle;
  causas: CausaDePersona[];
}

export async function obtenerDetalle(id: string): Promise<DetallePersona> {
  const persona = await repositorio.buscarPorId(id);
  if (!persona) throw new ErrorNoEncontrado('No encontramos esa persona en la agenda.');

  return { persona, causas: await repositorio.causasDe(id) };
}

/** El documento solo se puede chequear si vienen las dos partes. */
async function exigirDocumentoLibre(datos: DatosPersona, exceptoId?: string): Promise<void> {
  if (!datos.tipo_documento || !datos.numero_documento) return;

  if (await repositorio.existeDocumento(datos.tipo_documento, datos.numero_documento, exceptoId)) {
    throw new ErrorConflicto('Ya hay alguien en la agenda con ese documento.', {
      numero_documento: ['Ya hay alguien en la agenda con ese documento.'],
    });
  }
}

export async function crearPersona(datos: DatosPersona): Promise<PersonaDetalle> {
  await exigirDocumentoLibre(datos);

  const id = await repositorio.crear(datos);
  const creada = await repositorio.buscarPorId(id);
  if (!creada) throw new ErrorNoEncontrado('La persona se creó pero no se pudo leer.');
  return creada;
}

export interface ResultadoEdicionPersona {
  antes: PersonaDetalle;
  despues: PersonaDetalle;
}

export async function editarPersona(id: string, datos: DatosPersona): Promise<ResultadoEdicionPersona> {
  const antes = await repositorio.buscarPorId(id);
  if (!antes) throw new ErrorNoEncontrado('No encontramos esa persona en la agenda.');

  await exigirDocumentoLibre(datos, id);

  const actualizo = await repositorio.actualizar(id, datos);
  if (!actualizo) throw new ErrorNoEncontrado('No encontramos esa persona en la agenda.');

  const despues = await repositorio.buscarPorId(id);
  if (!despues) throw new ErrorNoEncontrado('La persona se guardó pero no se pudo leer.');
  return { antes, despues };
}

export async function eliminarPersona(id: string): Promise<PersonaDetalle> {
  const persona = await repositorio.buscarPorId(id);
  if (!persona) throw new ErrorNoEncontrado('No encontramos esa persona en la agenda.');

  // Quitarla de la agenda la haría desaparecer del listado de partes de los
  // expedientes en trámite, que es justo donde hace falta saber a quién se
  // demanda. Primero se la desvincula de la causa; después se la da de baja.
  const vigentes = await repositorio.contarCausasVigentes(id);
  if (vigentes > 0) {
    throw new ErrorConflicto(
      vigentes === 1
        ? 'Interviene en un expediente en trámite. Quitala de ese expediente antes de darla de baja.'
        : `Interviene en ${vigentes} expedientes en trámite. Quitala de esos expedientes antes de darla de baja.`,
    );
  }

  await repositorio.eliminar(id);
  return persona;
}
