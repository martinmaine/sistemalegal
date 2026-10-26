import { z } from 'zod';
import { config } from '../config';

/**
 * Paginación por página y tamaño, compartida por todos los listados.
 *
 * Se pagina en el servidor y no en el cliente: un estudio con miles de causas
 * no puede recibir la tabla entera para que el navegador la recorte.
 */

export const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
});

export type Paginacion = z.infer<typeof esquemaPaginacion>;

export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  tamano: number;
  /** Se calcula acá y no en el frontend para que todas las vistas coincidan. */
  totalPaginas: number;
}

export function armarPagina<T>(datos: T[], total: number, paginacion: Paginacion): Pagina<T> {
  return {
    datos,
    total,
    pagina: paginacion.pagina,
    tamano: paginacion.tamano,
    totalPaginas: Math.max(1, Math.ceil(total / paginacion.tamano)),
  };
}

/** Desplazamiento SQL correspondiente a la página pedida. */
export function desplazamiento(paginacion: Paginacion): number {
  return (paginacion.pagina - 1) * paginacion.tamano;
}

/** Tope duro de filas, por si alguna consulta no usa paginación. */
export const TOPE_FILAS = config.limiteListados;
