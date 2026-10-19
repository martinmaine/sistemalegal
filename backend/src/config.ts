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

export function origenAutorizado(origen: string): boolean {
  if (config.origenesPermitidos.includes(origen)) return true;
  const previewVercel = new RegExp(
    `^https://${config.prefijoPreviewVercel}[a-z0-9-]*\.vercel\.app$`,
  );
  return previewVercel.test(origen);
}
