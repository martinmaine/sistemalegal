import request from 'supertest';
import type { Express } from 'express';

/**
 * Utilidades compartidas por las pruebas de integración.
 *
 * Las credenciales son las de database/seed/002_datos_demo.sql. No son un
 * secreto: la base de pruebas se crea desde cero en cada corrida y los datos
 * son ficticios.
 */

export const USUARIOS_DEMO = {
  admin: { email: 'admin@estudiodemo.test', password: 'Demo1234!' },
  jefe: { email: 'jefe@estudiodemo.test', password: 'Demo1234!' },
  empleado: { email: 'empleado1@estudiodemo.test', password: 'Demo1234!' },
} as const;

export interface SesionDePrueba {
  accessToken: string;
  /** Cabecera Cookie lista para reenviar el refresh token. */
  cookie: string;
  usuario: { id: string; email: string; rol: string; permisos: string[] };
}

export async function iniciarSesion(
  app: Express,
  credenciales: { email: string; password: string } = USUARIOS_DEMO.admin,
): Promise<SesionDePrueba> {
  const respuesta = await request(app).post('/api/auth/login').send(credenciales);

  if (respuesta.status !== 200) {
    throw new Error(`El login de prueba falló con ${respuesta.status}: ${JSON.stringify(respuesta.body)}`);
  }

  const cookies = respuesta.headers['set-cookie'];
  return {
    accessToken: respuesta.body.accessToken,
    cookie: Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? ''),
    usuario: respuesta.body.usuario,
  };
}

/** Azúcar para no repetir la cabecera Authorization en cada petición. */
export function conSesion(peticion: request.Test, sesion: SesionDePrueba): request.Test {
  return peticion.set('Authorization', `Bearer ${sesion.accessToken}`);
}
