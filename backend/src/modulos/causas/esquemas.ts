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

/**
 * Edición de la causa.
 *
 * Es un reemplazo completo, no un parche: el formulario envía todos los campos
 * y lo que no viene se borra. Con un parche parcial, "vaciar el tribunal" y "no
 * tocar el tribunal" llegan idénticos al servidor.
 */
export const esquemaEditarCausa = esquemaCrearCausa
  .extend({
    fecha_cierre: z.iso
      .date('Indicá una fecha de cierre válida.')
      .optional()
      .or(z.literal(''))
      .transform((v) => v || undefined),
  })
  // La base ya tiene ck_causa_fechas, pero una violación de restricción llega
  // como error genérico: validarlo acá permite señalar el campo exacto.
  // Las fechas son YYYY-MM-DD, así que comparar los textos equivale a comparar
  // las fechas y evita construir Date (que correría el día por zona horaria).
  .refine((datos) => !datos.fecha_cierre || datos.fecha_cierre >= datos.fecha_inicio, {
    message: 'La fecha de cierre no puede ser anterior a la de inicio.',
    path: ['fecha_cierre'],
  });

export type DatosEditarCausa = z.infer<typeof esquemaEditarCausa>;

/** Caracteres procesales admitidos, iguales a ck_parte_caracter en la migración 004. */
export const CARACTERES_PARTE = [
  'ACTOR',
  'DEMANDADO',
  'CODEMANDADO',
  'TERCERO',
  'PERITO',
  'TESTIGO',
] as const;

export const esquemaAgregarParte = z.object({
  persona_id: z.uuid('Elegí una persona de la agenda.'),
  caracter: z.enum(CARACTERES_PARTE, 'Elegí el carácter con que interviene.'),
  es_cliente: z.coerce.boolean().default(false),
  observaciones: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
});

export type DatosAgregarParte = z.infer<typeof esquemaAgregarParte>;

/** Roles del estudio en la causa, iguales a ck_profesional_rol en la migración 004. */
export const ROLES_PROFESIONAL = ['TITULAR', 'PATROCINANTE', 'APODERADO', 'COLABORADOR'] as const;

export const esquemaAgregarProfesional = z.object({
  usuario_id: z.uuid('Elegí un integrante del estudio.'),
  rol_en_causa: z.enum(ROLES_PROFESIONAL, 'Elegí el rol en la causa.'),
});

export type DatosAgregarProfesional = z.infer<typeof esquemaAgregarProfesional>;

/** Identificador del vínculo (parte o profesional) dentro de la causa. */
export const esquemaIdVinculo = z.object({
  id: z.uuid('Identificador inválido.'),
  vinculoId: z.uuid('Identificador inválido.'),
});
