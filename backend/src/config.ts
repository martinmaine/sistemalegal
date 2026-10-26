import 'dotenv/config';

/**
 * Configuración del servicio, leída una sola vez desde variables de entorno.
 *
 * Nada sensible vive en el repositorio (ver docs/arquitectura.md, sección 6).
 * `urlBaseDatos` puede faltar a propósito: la API tiene que poder arrancar y
 * responder /health incluso con la base mal configurada, para que el problema
 * se vea en el endpoint en lugar de en un contenedor que no levanta.
 */

function entero(nombre: string, porDefecto: number): number {
  const valor = process.env[nombre];
  if (!valor) return porDefecto;
  const numero = Number.parseInt(valor, 10);
  if (Number.isNaN(numero)) {
    throw new Error(`La variable ${nombre} debe ser un número entero, llegó "${valor}"`);
  }
  return numero;
}

function lista(nombre: string): string[] {
  return (process.env[nombre] ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0);
}

export const config = {
  entorno: process.env.NODE_ENV ?? 'development',
  puerto: entero('PORT', 4000),
  urlBaseDatos: process.env.DATABASE_URL,

  /** Orígenes autorizados a consumir la API, separados por coma. */
  origenesPermitidos: lista('CORS_ORIGIN'),

  /**
   * Vercel publica cada preview en un dominio distinto
   * (sistemalegal-abc123-equipo.vercel.app), así que la allowlist no puede ser
   * una URL fija. Se autoriza por prefijo del proyecto, no cualquier *.vercel.app.
   */
  prefijoPreviewVercel: process.env.CORS_PREFIJO_PREVIEW ?? 'sistemalegal',

  /** Tope de filas que devuelve el listado, para no traer la base entera. */
  limiteListados: entero('LIMITE_LISTADOS', 50),
} as const;

const DOMINIO_VERCEL = '.vercel.app';

export function origenAutorizado(origen: string): boolean {
  if (config.origenesPermitidos.includes(origen)) return true;
  return esPreviewDeVercel(origen);
}

/**
 * Autoriza los previews del proyecto en Vercel.
 *
 * Se compara el host ya parseado en lugar de armar un regex con el prefijo
 * interpolado: un prefijo con metacaracteres ensancharía la allowlist sin que
 * se note, y un punto mal escapado convierte `.vercel.app` en un comodín que
 * matchea cualquier carácter.
 */
function esPreviewDeVercel(origen: string): boolean {
  let url: URL;
  try {
    url = new URL(origen);
  } catch {
    return false;
  }

  // Solo https y sin puerto: un origen es esquema + host + puerto.
  if (url.protocol !== 'https:' || url.port !== '') return false;
  if (!url.hostname.endsWith(DOMINIO_VERCEL)) return false;

  const subdominio = url.hostname.slice(0, -DOMINIO_VERCEL.length);
  // Un solo nivel: descarta cosas como sistemalegal.ajeno.vercel.app.
  if (subdominio.length === 0 || subdominio.includes('.')) return false;

  const prefijo = config.prefijoPreviewVercel;
  return subdominio === prefijo || subdominio.startsWith(`${prefijo}-`);
}
