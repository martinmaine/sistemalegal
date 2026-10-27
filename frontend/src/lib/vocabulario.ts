/**
 * Vocabulario del dominio: los valores que la base admite y cómo se nombran en
 * pantalla.
 *
 * Son listas cerradas definidas por restricciones CHECK en las migraciones, no
 * tablas de catálogo, así que no hay endpoint que las devuelva. Se replican acá
 * con el comentario que dice de dónde salen: si alguna cambia, cambia por una
 * migración y este archivo se actualiza con ella.
 *
 * El texto visible nunca es el código. "CODEMANDADO" es lo que guarda la base;
 * "Codemandado" es lo que lee el abogado.
 */

export interface OpcionVocabulario {
  valor: string;
  texto: string;
}

/** `ck_parte_caracter` — migración 004. Carácter procesal de una parte. */
export const CARACTERES_PARTE: OpcionVocabulario[] = [
  { valor: 'ACTOR', texto: 'Actor' },
  { valor: 'DEMANDADO', texto: 'Demandado' },
  { valor: 'CODEMANDADO', texto: 'Codemandado' },
  { valor: 'TERCERO', texto: 'Tercero' },
  { valor: 'PERITO', texto: 'Perito' },
  { valor: 'TESTIGO', texto: 'Testigo' },
];

/** `ck_profesional_rol` — migración 004. Rol de un integrante del estudio en la causa. */
export const ROLES_PROFESIONAL: OpcionVocabulario[] = [
  { valor: 'TITULAR', texto: 'Titular' },
  { valor: 'PATROCINANTE', texto: 'Patrocinante' },
  { valor: 'APODERADO', texto: 'Apoderado' },
  { valor: 'COLABORADOR', texto: 'Colaborador' },
];

/** `ck_persona_tipo_documento` — migración 004. */
export const TIPOS_DOCUMENTO: OpcionVocabulario[] = [
  { valor: 'DNI', texto: 'DNI' },
  { valor: 'LC', texto: 'Libreta cívica' },
  { valor: 'LE', texto: 'Libreta de enrolamiento' },
  { valor: 'CI', texto: 'Cédula de identidad' },
  { valor: 'PASAPORTE', texto: 'Pasaporte' },
  { valor: 'CUIT', texto: 'CUIT' },
  { valor: 'CUIL', texto: 'CUIL' },
];

export const TIPOS_PERSONA: OpcionVocabulario[] = [
  { valor: 'FISICA', texto: 'Persona física' },
  { valor: 'JURIDICA', texto: 'Persona jurídica' },
];

/** Busca el texto visible de un código. Si no lo conoce, devuelve el código tal cual. */
function texto(lista: OpcionVocabulario[], codigo: string | null | undefined): string {
  if (!codigo) return '—';
  return lista.find((opcion) => opcion.valor === codigo)?.texto ?? codigo;
}

export const caracterLegible = (codigo: string | null | undefined) => texto(CARACTERES_PARTE, codigo);
export const rolLegible = (codigo: string | null | undefined) => texto(ROLES_PROFESIONAL, codigo);
export const tipoPersonaLegible = (codigo: string | null | undefined) => texto(TIPOS_PERSONA, codigo);
