import { z } from 'zod';
import { esquemaPaginacion } from '../../comun/paginacion';

/** Entrada válida del módulo de plazos. */

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined);

const uuidOpcional = (mensaje: string) =>
  z
    .uuid(mensaje)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined);

/**
 * Los insumos del cálculo.
 *
 * `cantidad_dias` y `computo` viajan siempre, aunque se haya elegido un tipo
 * de plazo del catálogo: la tabla `plazo` los guarda por su cuenta para que la
 * fila sea autosuficiente, y así un cambio posterior en el catálogo no altera
 * un plazo ya computado. `tipo_plazo_id` queda como la norma que lo funda.
 */
const insumosComputo = {
  tipo_plazo_id: uuidOpcional('Tipo de plazo inválido.'),
  fecha_notificacion: z.iso.date('Indicá la fecha de notificación.'),
  /** Si se omite, el motor usa el día hábil siguiente a la notificación. */
  fecha_inicio_computo: z.iso
    .date('Fecha de inicio inválida.')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  cantidad_dias: z.coerce
    .number()
    .int('Los días tienen que ser un número entero.')
    .min(1, 'El plazo tiene que ser de al menos un día.')
    .max(3650, 'Ese plazo es demasiado largo; revisá el dato.'),
  computo: z.enum(['HABIL', 'CORRIDO'], 'Indicá si se cuentan días hábiles o corridos.'),
};

/** Previsualización: calcula sin guardar, para que el formulario muestre la fecha. */
export const esquemaSimularPlazo = z.object(insumosComputo);
export type DatosSimularPlazo = z.infer<typeof esquemaSimularPlazo>;

export const esquemaCrearPlazo = z.object({
  ...insumosComputo,
  descripcion: z
    .string()
    .trim()
    .min(1, 'Describí qué hay que hacer antes del vencimiento.')
    .max(300, 'Máximo 300 caracteres.'),
  responsable_id: uuidOpcional('Responsable inválido.'),
  observaciones: opcional(5000),
});

export type DatosCrearPlazo = z.infer<typeof esquemaCrearPlazo>;

/**
 * Edición.
 *
 * Es el mismo conjunto de insumos: cambiar cualquiera obliga a recalcular el
 * vencimiento, y el motor se encarga. El estado no se toca acá; para eso están
 * las acciones de cumplir, suspender y reanudar, que registran además el
 * cuándo y el porqué.
 */
export const esquemaEditarPlazo = esquemaCrearPlazo;
export type DatosEditarPlazo = DatosCrearPlazo;

export const ORDENES_PLAZO = ['fecha_vencimiento', 'creado_en', 'caratula'] as const;
export type OrdenPlazo = (typeof ORDENES_PLAZO)[number];

export const esquemaFiltrosPlazo = esquemaPaginacion.extend({
  /** Rango de vencimiento. Es como se arma la agenda: "qué vence esta semana". */
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  estado: z.enum(['PENDIENTE', 'CUMPLIDO', 'VENCIDO', 'SUSPENDIDO', 'CANCELADO']).optional(),
  responsable: z.uuid('Responsable inválido.').optional(),
  causa: z.uuid('Expediente inválido.').optional(),
  /** 'abiertos' = pendientes y suspendidos, que es lo que hay que vigilar. */
  vigencia: z.enum(['todos', 'abiertos', 'cerrados']).default('abiertos'),
  orden: z.enum(ORDENES_PLAZO).default('fecha_vencimiento'),
  direccion: z.enum(['asc', 'desc']).default('asc'),
});

export type FiltrosPlazo = z.infer<typeof esquemaFiltrosPlazo>;

export const esquemaCumplirPlazo = z.object({
  /** Si se omite, se toma el día de hoy. */
  fecha_cumplimiento: z.iso
    .date('Fecha de cumplimiento inválida.')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  observaciones: opcional(5000),
});

export type DatosCumplirPlazo = z.infer<typeof esquemaCumplirPlazo>;

export const esquemaSuspenderPlazo = z
  .object({
    fecha_desde: z.iso.date('Indicá desde cuándo se suspende.'),
    /** Vacío mientras no se sepa cuándo se reanuda. */
    fecha_hasta: z.iso
      .date('Fecha de reanudación inválida.')
      .optional()
      .or(z.literal(''))
      .transform((v) => v || undefined),
    motivo: z
      .string()
      .trim()
      .min(1, 'Indicá por qué se suspende; queda asentado en el expediente.')
      .max(200, 'Máximo 200 caracteres.'),
  })
  .refine((datos) => !datos.fecha_hasta || datos.fecha_hasta >= datos.fecha_desde, {
    message: 'La reanudación no puede ser anterior al comienzo de la suspensión.',
    path: ['fecha_hasta'],
  });

export type DatosSuspenderPlazo = z.infer<typeof esquemaSuspenderPlazo>;

export const esquemaReanudarPlazo = z.object({
  fecha_hasta: z.iso.date('Indicá desde cuándo vuelve a correr el plazo.'),
});

export type DatosReanudarPlazo = z.infer<typeof esquemaReanudarPlazo>;

export const esquemaIdRuta = z.object({ id: z.uuid('Identificador inválido.') });
