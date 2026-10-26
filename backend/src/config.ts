import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { config as cargarEnv } from 'dotenv';

/**
 * Carga de variables de entorno.
 *
 * El proyecto tiene un único .env en la raíz del repositorio —es el que
 * documenta .env.example y el que lee docker compose—, pero `npm run dev` y
 * `npm test` se ejecutan desde backend/, donde dotenv no lo encuentra. Por eso
 * se busca primero en el directorio actual y después en la raíz.
 *
 * dotenv no pisa lo que ya está definido, así que una variable del entorno real
 * (Render, el workflow de CI) sigue teniendo prioridad sobre cualquier archivo.
 */
cargarEnv();
cargarEnv({ path: join(__dirname, '..', '..', '.env') });

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

/**
 * Secreto de firma de los access token.
 *
 * En producción es obligatorio y el servicio no arranca sin él: un secreto por
 * defecto en un binario publicado equivale a no tener firma, porque cualquiera
 * que lea el repositorio puede emitirse un token de administrador.
 *
 * En desarrollo se genera uno efímero. La consecuencia —las sesiones se caen
 * al reiniciar el servidor— es deliberada: molesta lo justo para que nadie se
 * acostumbre a trabajar sin configurar la variable, y nunca deja un secreto
 * conocido en una máquina de desarrollo.
 */
function secretoJwt(): string {
  const declarado = process.env.JWT_SECRET;
  if (declarado && declarado.length >= 32) return declarado;

  const entorno = process.env.NODE_ENV ?? 'development';
  if (entorno === 'production') {
    throw new Error(
      'Falta JWT_SECRET o es demasiado corto (mínimo 32 caracteres). ' +
        'Generá uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }
  if (declarado) {
    console.warn('[config] JWT_SECRET tiene menos de 32 caracteres: se ignora y se usa uno efímero.');
  }
  return randomBytes(48).toString('base64url');
}

export const config = {
  entorno: process.env.NODE_ENV ?? 'development',
  puerto: entero('PORT', 4000),
  urlBaseDatos: process.env.DATABASE_URL,

  /** Secreto de firma de los access token. Ver secretoJwt(). */
  secretoJwt: secretoJwt(),

  /**
   * Vida del access token. Corta a propósito: el token viaja en cada petición y
   * vive en memoria del navegador, así que si se filtra, la ventana de abuso es
   * de minutos. La continuidad de la sesión la da el refresh token.
   */
  minutosAccessToken: entero('MINUTOS_ACCESS_TOKEN', 15),

  /** Vida del refresh token, en días. Define cada cuánto hay que volver a entrar. */
  diasRefreshToken: entero('DIAS_REFRESH_TOKEN', 7),

  /**
   * Intentos de login permitidos por ventana, por IP. Frena la prueba de
   * contraseñas por fuerza bruta sin castigar a quien se equivoca una vez.
   */
  intentosLogin: entero('INTENTOS_LOGIN', 10),
  minutosVentanaLogin: entero('MINUTOS_VENTANA_LOGIN', 15),

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
