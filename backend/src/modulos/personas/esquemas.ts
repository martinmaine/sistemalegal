import { z } from 'zod';
import { esquemaPaginacion } from '../../comun/paginacion';

export const ORDENES_PERSONA = ['nombre', 'creado_en'] as const;
export type OrdenPersona = (typeof ORDENES_PERSONA)[number];

export const esquemaFiltrosPersona = esquemaPaginacion.extend({
  busqueda: z.string().trim().max(200).optional(),
  tipo: z.enum(['FISICA', 'JURIDICA']).optional(),
  /** Solo quienes son cliente del estudio en alguna causa. */
  soloClientes: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
  orden: z.enum(ORDENES_PERSONA).default('nombre'),
  direccion: z.enum(['asc', 'desc']).default('asc'),
});

export type FiltrosPersona = z.infer<typeof esquemaFiltrosPersona>;
