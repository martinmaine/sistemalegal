import { obtenerPool } from '../../db';
import { desplazamiento } from '../../comun/paginacion';
import type { FiltrosPersona, OrdenPersona } from './esquemas';

/**
 * Agenda de personas del estudio: clientes, contrarias, peritos y testigos.
 *
 * Una misma persona puede intervenir en varias causas y con distinto carácter
 * en cada una (decisión de modelado de la migración 004), así que acá se la
 * trata como entidad propia y el vínculo se consulta aparte.
 */

export interface PersonaListada {
  id: string;
  nombre_completo: string;
  tipo_persona: string;
  documento: string | null;
  cuit_cuil: string | null;
  email: string | null;
  telefono: string | null;
  localidad: string | null;
  cantidad_causas: number;
  es_cliente: boolean;
}

export interface CausaDePersona {
  causa_id: string;
  caratula: string;
  numero_expediente: string | null;
  estado: string;
  es_final: boolean;
  fuero: string;
  caracter: string;
  es_cliente: boolean;
  fecha_inicio: string;
}

/** Nombre mostrable: razón social para jurídicas, "Apellido, Nombre" para físicas. */
const NOMBRE_COMPLETO = `COALESCE(p.razon_social, p.apellido || ', ' || p.nombre)`;

const COLUMNAS_ORDEN: Record<OrdenPersona, string> = {
  nombre: NOMBRE_COMPLETO,
  creado_en: 'p.creado_en',
};

function condiciones(filtros: FiltrosPersona): { sql: string; valores: unknown[] } {
  const partes = ['p.eliminado_en IS NULL'];
  const valores: unknown[] = [];

  if (filtros.busqueda) {
    valores.push(`%${filtros.busqueda}%`);
    const i = valores.length;
    partes.push(`(
      fn_sin_acentos(lower(COALESCE(p.razon_social, ''))) LIKE fn_sin_acentos(lower($${i}))
      OR fn_sin_acentos(lower(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, ''))) LIKE fn_sin_acentos(lower($${i}))
      OR p.numero_documento ILIKE $${i}
      OR p.cuit_cuil ILIKE $${i}
      OR p.email ILIKE $${i}
    )`);
  }

  if (filtros.tipo) {
    valores.push(filtros.tipo);
    partes.push(`p.tipo_persona = $${valores.length}`);
  }

  if (filtros.soloClientes) {
    partes.push(`EXISTS (SELECT 1 FROM parte_causa pc WHERE pc.persona_id = p.id AND pc.es_cliente)`);
  }

  return { sql: partes.join('\n     AND '), valores };
}

export async function listar(filtros: FiltrosPersona): Promise<PersonaListada[]> {
  const { sql: donde, valores } = condiciones(filtros);
  const direccion = filtros.direccion === 'asc' ? 'ASC' : 'DESC';
  valores.push(filtros.tamano, desplazamiento(filtros));

  const { rows } = await obtenerPool().query<PersonaListada>(
    `SELECT p.id,
            ${NOMBRE_COMPLETO} AS nombre_completo,
            p.tipo_persona,
            CASE WHEN p.numero_documento IS NULL THEN NULL
                 ELSE COALESCE(p.tipo_documento, 'DOC') || ' ' || p.numero_documento
            END AS documento,
            p.cuit_cuil,
            p.email,
            p.telefono,
            p.localidad,
            (SELECT count(*) FROM parte_causa pc
               JOIN causa c ON c.id = pc.causa_id AND c.eliminado_en IS NULL
              WHERE pc.persona_id = p.id)::int AS cantidad_causas,
            EXISTS (SELECT 1 FROM parte_causa pc
                     WHERE pc.persona_id = p.id AND pc.es_cliente) AS es_cliente
       FROM persona p
      WHERE ${donde}
      ORDER BY ${COLUMNAS_ORDEN[filtros.orden]} ${direccion}
      LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
  );
  return rows;
}

export async function contar(filtros: FiltrosPersona): Promise<number> {
  const { sql: donde, valores } = condiciones(filtros);
  const { rows } = await obtenerPool().query<{ total: string }>(
    `SELECT count(*) AS total FROM persona p WHERE ${donde}`,
    valores,
  );
  return Number.parseInt(rows[0]?.total ?? '0', 10);
}

export interface PersonaDetalle extends PersonaListada {
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  domicilio: string | null;
  provincia: string | null;
  observaciones: string | null;
  creado_en: string;
}

export async function buscarPorId(id: string): Promise<PersonaDetalle | undefined> {
  const { rows } = await obtenerPool().query<PersonaDetalle>(
    `SELECT p.id,
            ${NOMBRE_COMPLETO} AS nombre_completo,
            p.tipo_persona,
            p.nombre,
            p.apellido,
            p.razon_social,
            p.tipo_documento,
            p.numero_documento,
            CASE WHEN p.numero_documento IS NULL THEN NULL
                 ELSE COALESCE(p.tipo_documento, 'DOC') || ' ' || p.numero_documento
            END AS documento,
            p.cuit_cuil,
            p.email,
            p.telefono,
            p.domicilio,
            p.localidad,
            p.provincia,
            p.observaciones,
            p.creado_en,
            (SELECT count(*) FROM parte_causa pc
               JOIN causa c ON c.id = pc.causa_id AND c.eliminado_en IS NULL
              WHERE pc.persona_id = p.id)::int AS cantidad_causas,
            EXISTS (SELECT 1 FROM parte_causa pc
                     WHERE pc.persona_id = p.id AND pc.es_cliente) AS es_cliente
       FROM persona p
      WHERE p.id = $1 AND p.eliminado_en IS NULL`,
    [id],
  );
  return rows[0];
}

export async function causasDe(personaId: string): Promise<CausaDePersona[]> {
  const { rows } = await obtenerPool().query<CausaDePersona>(
    `SELECT c.id AS causa_id,
            c.caratula,
            c.numero_expediente,
            ec.nombre AS estado,
            ec.es_final,
            f.nombre  AS fuero,
            pc.caracter,
            pc.es_cliente,
            to_char(c.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
       FROM parte_causa pc
       JOIN causa c         ON c.id  = pc.causa_id AND c.eliminado_en IS NULL
       JOIN estado_causa ec ON ec.id = c.estado_causa_id
       JOIN fuero f         ON f.id  = c.fuero_id
      WHERE pc.persona_id = $1
      ORDER BY c.fecha_inicio DESC`,
    [personaId],
  );
  return rows;
}
