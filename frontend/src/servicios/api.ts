import type { RespuestaSesion } from '../tipos/api';

/**
 * Cliente de la API REST.
 *
 * Tres responsabilidades, y ninguna más:
 *  1. Agregar la cabecera Authorization con el access token.
 *  2. Renovar la sesión y reintentar cuando el token venció, sin que la
 *     pantalla que pidió los datos se entere.
 *  3. Convertir los errores del backend en un objeto que los formularios
 *     puedan usar directamente.
 *
 * El access token vive en memoria, nunca en localStorage: ahí un XSS lo leería.
 * El refresh token no pasa por acá en ningún momento, porque viaja en una
 * cookie httpOnly que el navegador adjunta solo.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/**
 * El plan gratuito de Render duerme el servicio tras unos minutos de
 * inactividad y la primera llamada puede tardar cerca de un minuto. Por eso el
 * timeout es generoso y la interfaz avisa que la API está despertando.
 */
const TIMEOUT_MS = 70_000;

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly estado?: number,
    /** Código estable del backend, p. ej. SIN_PERMISO. Permite ramificar sin leer el texto. */
    readonly codigo?: string,
    /** Errores por campo, para volcarlos directamente en el formulario. */
    readonly detalles?: Record<string, string[]>,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }

  get esDeSesion(): boolean {
    return this.estado === 401;
  }

  get esDePermiso(): boolean {
    return this.estado === 403;
  }
}

/* --- Estado de la sesión en memoria ---------------------------------------- */

let accessToken: string | undefined;
let alPerderSesion: (() => void) | undefined;

export function guardarAccessToken(token: string | undefined): void {
  accessToken = token;
}

export function hayAccessToken(): boolean {
  return Boolean(accessToken);
}

/** El contexto de sesión registra acá qué hacer cuando la sesión muere. */
export function alCaerLaSesion(manejador: () => void): void {
  alPerderSesion = manejador;
}

/* --- Renovación ------------------------------------------------------------ */

/**
 * Renovación en curso.
 *
 * Si tres peticiones reciben 401 a la vez, no pueden disparar tres refrescos:
 * el backend rota el refresh token en cada uno, así que el segundo llegaría con
 * un token ya consumido y la detección de reutilización cortaría la sesión del
 * usuario legítimo. Compartiendo la misma promesa, se refresca una sola vez.
 */
let renovacionEnCurso: Promise<boolean> | undefined;

async function renovarSesion(): Promise<boolean> {
  renovacionEnCurso ??= (async () => {
    try {
      const respuesta = await fetch(`${BASE}/api/auth/refrescar`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!respuesta.ok) return false;

      const datos = (await respuesta.json()) as RespuestaSesion;
      accessToken = datos.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Se libera en el microtask siguiente: así las peticiones que están
      // esperando leen el resultado antes de que otra inicie un refresco nuevo.
      queueMicrotask(() => {
        renovacionEnCurso = undefined;
      });
    }
  })();

  return renovacionEnCurso;
}

/* --- Petición -------------------------------------------------------------- */

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  /** Uso interno: evita que un reintento vuelva a reintentar en bucle. */
  reintentada?: boolean;
  /** Las rutas de sesión no deben disparar la renovación automática. */
  sinRenovar?: boolean;
}

async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  const cabeceras: Record<string, string> = {};
  if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (accessToken) cabeceras.Authorization = `Bearer ${accessToken}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      // Imprescindible para que viaje la cookie del refresh token.
      credentials: 'include',
      signal: control.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ErrorApi('La API no respondió en el tiempo esperado.', undefined, 'TIEMPO_AGOTADO');
    }
    throw new ErrorApi(
      'No se pudo contactar con el servidor. Revisá tu conexión.',
      undefined,
      'SIN_CONEXION',
    );
  } finally {
    clearTimeout(reloj);
  }

  // Token vencido: se renueva una vez y se reintenta la petición original. Para
  // la pantalla que la hizo, todo esto es invisible.
  if (respuesta.status === 401 && !opciones.reintentada && !opciones.sinRenovar) {
    if (await renovarSesion()) {
      return pedir<T>(ruta, { ...opciones, reintentada: true });
    }
    accessToken = undefined;
    alPerderSesion?.();
  }

  if (respuesta.status === 204) return undefined as T;

  const cuerpo = await respuesta.json().catch(() => undefined);

  if (!respuesta.ok) {
    throw new ErrorApi(
      cuerpo?.error ?? `La API respondió ${respuesta.status}.`,
      respuesta.status,
      cuerpo?.codigo,
      cuerpo?.detalles,
    );
  }

  return cuerpo as T;
}

/** Arma una query string omitiendo lo vacío, para no mandar filtros sin valor. */
export function consulta(parametros: Record<string, string | number | undefined | null>): string {
  const partes = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    partes.set(clave, String(valor));
  }
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}

export const api = {
  urlBase: BASE,
  obtener: <T>(ruta: string) => pedir<T>(ruta),
  enviar: <T>(ruta: string, cuerpo: unknown) => pedir<T>(ruta, { metodo: 'POST', cuerpo }),
  /** PUT: reemplaza el recurso completo, que es como actualiza la API. */
  reemplazar: <T>(ruta: string, cuerpo: unknown) => pedir<T>(ruta, { metodo: 'PUT', cuerpo }),
  eliminar: <T>(ruta: string) => pedir<T>(ruta, { metodo: 'DELETE' }),

  /** Las rutas de sesión no pasan por la renovación automática. */
  sesion: {
    login: (email: string, password: string) =>
      pedir<RespuestaSesion>('/api/auth/login', {
        metodo: 'POST',
        cuerpo: { email, password },
        sinRenovar: true,
      }),
    refrescar: () => pedir<RespuestaSesion>('/api/auth/refrescar', { metodo: 'POST', sinRenovar: true }),
    perfil: () => pedir<{ usuario: RespuestaSesion['usuario'] }>('/api/auth/perfil'),
    logout: () => pedir<void>('/api/auth/logout', { metodo: 'POST', sinRenovar: true }),
  },
};
