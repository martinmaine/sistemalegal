import { armarPagina, type Pagina } from '../../comun/paginacion';
import { ErrorNoEncontrado } from '../../comun/errores';
import * as repositorio from './repositorio';
import type { FiltrosPersona } from './esquemas';
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
