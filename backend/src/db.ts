import { Pool } from 'pg';
import { config } from './config';

/**
 * Pool de conexiones a PostgreSQL.
 *
 * Se crea en el primer uso, no al importar el módulo: así /health responde
 * aunque DATABASE_URL falte, y el error aparece en la respuesta del endpoint.
 *
 * Neon exige TLS y corta las conexiones inactivas cuando el proyecto se
 * autosuspende, de ahí el `ssl` y el `idleTimeoutMillis` corto.
 */

let pool: Pool | undefined;

export function obtenerPool(): Pool {
  if (!config.urlBaseDatos) {
    throw new Error('Falta DATABASE_URL: la API no tiene a qué base conectarse');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.urlBaseDatos,
      // Verificación del certificado activada. Si alguna vez falla contra el
      // pooler de Neon, la solución es sumar su CA al almacén de confianza, no
      // desactivar la verificación: eso deja la conexión abierta a un intermediario.
      ssl: requiereTls(config.urlBaseDatos) ? { rejectUnauthorized: true } : undefined,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function cerrarPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * El Postgres local de docker compose no tiene TLS; Neon y Supabase lo exigen.
 * La cadena de Neon ya trae sslmode=require, así que alcanza con mirarla.
 */
function requiereTls(url: string): boolean {
  return url.includes('sslmode=require') || url.includes('neon.tech') || url.includes('supabase');
}

export type EstadoBase = { conectada: true; version: string } | { conectada: false; error: string };

export async function verificarBase(): Promise<EstadoBase> {
  try {
    const { rows } = await obtenerPool().query<{ version: string }>('SELECT version() AS version');
    return { conectada: true, version: rows[0]?.version ?? 'desconocida' };
  } catch (error) {
    return { conectada: false, error: error instanceof Error ? error.message : String(error) };
  }
}
