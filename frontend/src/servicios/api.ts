import type { EstadoSalud, ListadoCausas } from '../tipos/causa';

/**
 * Cliente de la API REST.
 *
 * La URL llega por variable de entorno (VITE_API_URL): en local apunta al
 * backend de docker compose, en Vercel al servicio de Render.
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
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

async function pedir<T>(ruta: string): Promise<T> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${BASE}${ruta}`, { signal: control.signal });
    if (!respuesta.ok) {
      throw new ErrorApi(`La API respondió ${respuesta.status}`, respuesta.status);
    }
    return (await respuesta.json()) as T;
  } catch (error) {
    if (error instanceof ErrorApi) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ErrorApi('La API no respondió en el tiempo esperado');
    }
    throw new ErrorApi(`No se pudo contactar la API en ${BASE}`);
  } finally {
    clearTimeout(reloj);
  }
}

export const api = {
  urlBase: BASE,
  salud: () => pedir<EstadoSalud>('/health'),
  causas: () => pedir<ListadoCausas>('/api/causas'),
};
