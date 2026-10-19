import { config } from '../../config';
import * as repositorio from './repositorio';
import type { CausaListada } from './tipos';

/**
 * Capa de servicio: reglas de negocio. Hoy solo acota el límite del listado;
 * cuando entren permisos por rol y filtros, el lugar es este.
 */

export interface ListadoCausas {
  total: number;
  causas: CausaListada[];
}

export async function listarCausas(limitePedido?: number): Promise<ListadoCausas> {
  const limite = acotarLimite(limitePedido);
  const [causas, total] = await Promise.all([repositorio.listar(limite), repositorio.contar()]);
  return { total, causas };
}

/** Un límite inválido o desmedido no es un error del usuario: se acota y sigue. */
export function acotarLimite(limitePedido?: number): number {
  if (limitePedido === undefined || Number.isNaN(limitePedido) || limitePedido < 1) {
    return config.limiteListados;
  }
  return Math.min(limitePedido, config.limiteListados);
}
