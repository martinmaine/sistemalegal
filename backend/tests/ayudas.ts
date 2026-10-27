import request from 'supertest';
import type { Express } from 'express';
import { obtenerPool } from '../src/db';

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

/**
 * Prefijo de todo lo que crean las pruebas.
 *
 * En CI la base nace y muere con la corrida, pero en local es la misma que usa
 * el entorno de desarrollo: sin este marcador y la limpieza de abajo, cada
 * `npm test` dejaría expedientes y personas de prueba mezclados con los datos
 * de demostración que se ven en la aplicación.
 */
export const PREFIJO_PRUEBA = 'PRUEBA ';

/**
 * Borra lo que crearon las pruebas, en orden de dependencias.
 *
 * Las causas van primero: sus partes y profesionales se van con ellas por
 * ON DELETE CASCADE. Las personas van después, porque `parte_causa` las
 * referencia con ON DELETE RESTRICT y mientras exista el vínculo no se pueden
 * borrar.
 */
export async function limpiarDatosDePrueba(): Promise<void> {
  const patron = `${PREFIJO_PRUEBA}%`;
  const pool = obtenerPool();

  await pool.query('DELETE FROM causa WHERE caratula LIKE $1', [patron]).catch(() => undefined);
  await pool
    .query('DELETE FROM persona WHERE apellido LIKE $1 OR razon_social LIKE $1', [patron])
    .catch(() => undefined);
}
