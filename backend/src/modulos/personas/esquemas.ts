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

/** Tipos de documento admitidos, iguales a ck_persona_tipo_documento en la migración 004. */
export const TIPOS_DOCUMENTO = ['DNI', 'LC', 'LE', 'CI', 'PASAPORTE', 'CUIT', 'CUIL'] as const;

/** Campo de texto opcional: la cadena vacía del formulario se guarda como NULL, no como ''. */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined);

/**
 * CUIT/CUIL.
 *
 * Se acepta con o sin guiones y se normaliza al formato con guiones, que es
 * como lo escribe el resto del sistema y como entra en VARCHAR(13). Se valida
 * la longitud, no el dígito verificador: rechazar un CUIT real por un cálculo
 * mal implementado es peor que guardar uno con una errata, que el abogado ve.
 */
const cuitOpcional = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/[\s-]/g, ''))
  .refine((valor) => valor === '' || /^\d{11}$/.test(valor), 'El CUIT/CUIL tiene 11 dígitos.')
  .transform((valor) =>
    valor === '' ? undefined : `${valor.slice(0, 2)}-${valor.slice(2, 10)}-${valor.slice(10)}`,
  )
  .optional();

/**
 * Alta y edición de una persona de la agenda.
 *
 * Las reglas de obligatoriedad replican ck_persona_identificacion: una persona
 * física necesita nombre y apellido, una jurídica razón social. Validarlo acá
 * además de en la base permite señalar el campo exacto en el formulario, en
 * lugar de devolver una violación de restricción sin indicar dónde.
 */
export const esquemaPersona = z
  .object({
    tipo_persona: z.enum(['FISICA', 'JURIDICA'], 'Indicá si es una persona física o jurídica.'),
    nombre: opcional(80),
    apellido: opcional(80),
    razon_social: opcional(150),
    tipo_documento: z.enum(TIPOS_DOCUMENTO).optional().or(z.literal('')).transform((v) => v || undefined),
    numero_documento: opcional(20),
    cuit_cuil: cuitOpcional,
    email: z
      .string()
      .trim()
      .max(150)
      .optional()
      .or(z.literal(''))
      .transform((v) => v || undefined)
      .refine(
        (v) => v === undefined || z.email().safeParse(v).success,
        'Ese correo no parece válido.',
      ),
    telefono: opcional(30),
    domicilio: opcional(200),
    localidad: opcional(100),
    provincia: opcional(100),
    observaciones: opcional(5000),
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo_persona === 'FISICA') {
      if (!datos.nombre) {
        ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'El nombre es obligatorio.' });
      }
      if (!datos.apellido) {
        ctx.addIssue({ code: 'custom', path: ['apellido'], message: 'El apellido es obligatorio.' });
      }
    } else if (!datos.razon_social) {
      ctx.addIssue({
        code: 'custom',
        path: ['razon_social'],
        message: 'La razón social es obligatoria.',
      });
    }

    // Un número sin tipo se mostraría como "DOC 12345678", que no dice nada.
    if (datos.numero_documento && !datos.tipo_documento) {
      ctx.addIssue({
        code: 'custom',
        path: ['tipo_documento'],
        message: 'Indicá el tipo de documento.',
      });
    }
  });

export type DatosPersona = z.infer<typeof esquemaPersona>;
