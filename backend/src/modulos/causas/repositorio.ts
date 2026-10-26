import { obtenerPool } from '../../db';
import type { CausaListada } from './tipos';

/**
 * Capa de repositorio: la única que escribe SQL. Las capas de arriba no saben
 * que detrás hay PostgreSQL (ver docs/arquitectura.md, sección 2).
 */

const SQL_LISTAR = `
  SELECT c.id,
         c.numero_expediente,
         c.caratula,
         to_char(c.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
         ec.nombre AS estado,
         f.nombre  AS fuero
    FROM causa c
    JOIN estado_causa ec ON ec.id = c.estado_causa_id
    JOIN fuero        f  ON f.id  = c.fuero_id
   WHERE c.eliminado_en IS NULL
   ORDER BY c.fecha_inicio DESC, c.caratula
   LIMIT $1
`;

export async function listar(limite: number): Promise<CausaListada[]> {
  const { rows } = await obtenerPool().query<CausaListada>(SQL_LISTAR, [limite]);
  return rows;
}

export async function contar(): Promise<number> {
  const { rows } = await obtenerPool().query<{ total: string }>(
    'SELECT count(*) AS total FROM causa WHERE eliminado_en IS NULL',
  );
  return Number.parseInt(rows[0]?.total ?? '0', 10);
}
