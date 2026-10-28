import { obtenerPool } from '../../db';

/**
 * Catálogos de referencia: fueros, tribunales, estados, tipos de causa y los
 * integrantes del estudio.
 *
 * Alimentan los desplegables de filtros y formularios. Son tablas chicas y
 * cambian muy poco, así que se devuelven completas en una sola respuesta: es
 * una petición en lugar de cinco, y el frontend la cachea.
 */

export interface OpcionCatalogo {
  id: string;
  nombre: string;
  codigo?: string;
  /** Para tribunales y tipos de causa: permite filtrar el desplegable por fuero. */
  fuero_id?: string;
  es_final?: boolean;
}

/** Regla de plazo del catálogo: el formulario precarga sus valores. */
export interface OpcionTipoPlazo extends OpcionCatalogo {
  cantidad_dias: number;
  computo: string;
  articulo_referencia: string | null;
  prorrogable: boolean;
}

export interface Catalogos {
  fueros: OpcionCatalogo[];
  estados: OpcionCatalogo[];
  tribunales: OpcionCatalogo[];
  tiposCausa: OpcionCatalogo[];
  tiposDocumento: OpcionCatalogo[];
  profesionales: OpcionCatalogo[];
  tiposPlazo: OpcionTipoPlazo[];
}

export async function obtenerTodos(): Promise<Catalogos> {
  const pool = obtenerPool();

  const [fueros, estados, tribunales, tiposCausa, tiposDocumento, profesionales, tiposPlazo] =
    await Promise.all([
    pool.query<OpcionCatalogo>(
      `SELECT id, nombre, codigo FROM fuero WHERE activo ORDER BY nombre`,
    ),
    pool.query<OpcionCatalogo>(
      `SELECT id, nombre, codigo, es_final FROM estado_causa ORDER BY orden, nombre`,
    ),
    pool.query<OpcionCatalogo>(
      `SELECT id,
              -- La nominación distingue juzgados homónimos ("Civil y Comercial, 1.ª").
              CASE WHEN nominacion IS NULL THEN nombre
                   ELSE nombre || ' — ' || nominacion
              END AS nombre,
              fuero_id
         FROM tribunal
        WHERE activo
        ORDER BY nombre, nominacion`,
    ),
    pool.query<OpcionCatalogo>(
      `SELECT id, nombre, codigo, fuero_id FROM tipo_causa WHERE activo ORDER BY nombre`,
    ),
    pool.query<OpcionCatalogo>(
      `SELECT id, nombre, codigo FROM tipo_documento WHERE activo ORDER BY nombre`,
    ),
    pool.query<OpcionCatalogo>(
      `SELECT id, (apellido || ', ' || nombre) AS nombre
         FROM usuario
        WHERE activo
        ORDER BY apellido, nombre`,
    ),
    pool.query<OpcionTipoPlazo>(
      `SELECT id, nombre, codigo, fuero_id, cantidad_dias, computo,
              articulo_referencia, prorrogable
         FROM tipo_plazo
        WHERE activo
        ORDER BY nombre`,
    ),
  ]);

  return {
    fueros: fueros.rows,
    estados: estados.rows,
    tribunales: tribunales.rows,
    tiposCausa: tiposCausa.rows,
    tiposDocumento: tiposDocumento.rows,
    profesionales: profesionales.rows,
    tiposPlazo: tiposPlazo.rows,
  };
}
