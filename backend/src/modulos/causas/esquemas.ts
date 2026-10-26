import { z } from 'zod';
import { esquemaPaginacion } from '../../comun/paginacion';

/**
 * Entrada válida del módulo de causas.
 *
 * El orden se valida contra una lista cerrada: el nombre de columna termina en
 * un ORDER BY, y ahí un valor libre sería inyección de SQL. Que sea un enum de
 * Zod significa que el valor inválido se rechaza antes de llegar al repositorio.
 */

export const ORDENES_CAUSA = [
  'fecha_inicio',
  'caratula',
  'numero_expediente',
  'estado',
  'proximo_vencimiento',
] as const;

export type OrdenCausa = (typeof ORDENES_CAUSA)[number];

export const esquemaFiltrosCausa = esquemaPaginacion.extend({
  /** Texto libre: busca en número de expediente y carátula, sin distinguir tildes. */
  busqueda: z.string().trim().max(200).optional(),
  estado: z.uuid('Estado inválido.').optional(),
  fuero: z.uuid('Fuero inválido.').optional(),
  tribunal: z.uuid('Tribunal inválido.').optional(),
  responsable: z.uuid('Responsable inválido.').optional(),
  /** 'activas' esconde las causas en estado final; es el filtro que se usa a diario. */
  vigencia: z.enum(['todas', 'activas', 'cerradas']).default('todas'),
  orden: z.enum(ORDENES_CAUSA).default('fecha_inicio'),
  direccion: z.enum(['asc', 'desc']).default('desc'),
});

export type FiltrosCausa = z.infer<typeof esquemaFiltrosCausa>;

const textoObligatorio = (max: number, mensaje: string) =>
  z.string().trim().min(1, mensaje).max(max, `Máximo ${max} caracteres.`);

export const esquemaCrearCausa = z.object({
  caratula: textoObligatorio(300, 'La carátula es obligatoria.'),
  // Puede faltar mientras la causa está en preparación, sin radicar.
  numero_expediente: z.string().trim().max(50).optional().or(z.literal('')).transform((v) => v || undefined),
  fuero_id: z.uuid('Elegí un fuero.'),
  estado_causa_id: z.uuid('Elegí un estado.'),
  tribunal_id: z.uuid().optional().or(z.literal('')).transform((v) => v || undefined),
  tipo_causa_id: z.uuid().optional().or(z.literal('')).transform((v) => v || undefined),
  fecha_inicio: z.iso.date('Indicá una fecha de inicio válida.'),
  monto_reclamado: z.coerce.number().min(0, 'El monto no puede ser negativo.').optional(),
  moneda: z.string().trim().length(3).default('ARS'),
  observaciones: z.string().trim().max(5000).optional().or(z.literal('')).transform((v) => v || undefined),
});

export type DatosCrearCausa = z.infer<typeof esquemaCrearCausa>;

export const esquemaIdRuta = z.object({ id: z.uuid('Identificador inválido.') });
