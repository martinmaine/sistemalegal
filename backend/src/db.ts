import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConnectionOptions } from 'node:tls';
import { Pool } from 'pg';
import { config } from './config';

/**
 * Pool de conexiones a PostgreSQL.
 *
 * Se crea en el primer uso, no al importar el módulo: así /health responde
 * aunque DATABASE_URL falte, y el error aparece en la respuesta del endpoint.
 *
 * Supabase exige TLS, y el pooler compartido corta las conexiones inactivas,
 * de ahí el `ssl` y el `idleTimeoutMillis` corto.
 */

let pool: Pool | undefined;

export function obtenerPool(): Pool {
  if (!config.urlBaseDatos) {
    throw new Error('Falta DATABASE_URL: la API no tiene a qué base conectarse');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: sinSslmode(config.urlBaseDatos),
      ssl: opcionesTls(config.urlBaseDatos),
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
 * Quita el parámetro `sslmode` de la cadena de conexión.
 *
 * No es un capricho: `pg` interpreta el `sslmode` de la URL y esa configuración
 * **pisa** el objeto `ssl` que se le pasa al Pool, así que la CA se descarta en
 * silencio y la conexión falla con «self-signed certificate in certificate
 * chain» aunque el certificado esté bien. Sacándolo, el TLS se decide en un
 * solo lugar: `opcionesTls()`.
 *
 * Se manipula solo la query string, nunca el usuario ni la contraseña:
 * reescribir la URL entera podría re-codificar caracteres de la contraseña.
 */
export function sinSslmode(url: string): string {
  const inicioQuery = url.indexOf('?');
  if (inicioQuery === -1) return url;

  const base = url.slice(0, inicioQuery);
  const parametros = url
    .slice(inicioQuery + 1)
    .split('&')
    .filter((p) => p.length > 0 && !p.toLowerCase().startsWith('sslmode='));

  return parametros.length > 0 ? `${base}?${parametros.join('&')}` : base;
}

/**
 * Opciones de TLS de la conexión.
 *
 * El pooler de Supabase presenta un certificado firmado por su propia CA, que
 * Node no trae: sin sumarla, la conexión falla con «self-signed certificate in
 * certificate chain».
 *
 * La salida fácil sería desactivar la verificación, y es la que circula en los
 * tutoriales. No se hace: sin verificar el certificado, cualquiera que se
 * interponga en la red puede hacerse pasar por la base, y por acá viajan datos
 * personales alcanzados por la Ley 25.326. Se suma la CA y se sigue verificando.
 *
 * El certificado lo descarga el panel de Supabase (Settings → Database → SSL
 * Configuration). No es un secreto —es la parte pública de la cadena— así que
 * vive en el repositorio y no en una variable de entorno.
 */
function opcionesTls(url: string): ConnectionOptions | undefined {
  if (!requiereTls(url)) return undefined;

  const ca = leerCertificadoCa();
  // Sin CA propia se usan las del sistema: suficiente para un PostgreSQL con
  // certificado de una CA pública, y falla ruidosamente si no es el caso.
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
}

function leerCertificadoCa(): string | undefined {
  // En Render o en cualquier plataforma donde no convenga un archivo, el PEM
  // puede llegar por variable de entorno.
  if (process.env.DATABASE_CA_CERT) return process.env.DATABASE_CA_CERT;

  const ruta = process.env.DATABASE_CA_CERT_PATH ?? join(__dirname, '..', 'certs', 'supabase-ca.crt');
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * El Postgres local de docker compose no tiene TLS; Supabase y Neon lo exigen.
 * La cadena que da el panel ya trae sslmode=require, así que alcanza con mirarla.
 */
function requiereTls(url: string): boolean {
  return (
    url.includes('sslmode=require') ||
    url.includes('supabase.com') ||
    url.includes('supabase.co') ||
    url.includes('neon.tech')
  );
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
