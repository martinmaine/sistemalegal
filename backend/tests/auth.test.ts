import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app';
import { cerrarPool } from '../src/db';
import { config } from '../src/config';
import { conSesion, iniciarSesion, USUARIOS_DEMO } from './ayudas';

/**
 * Pruebas del módulo de autenticación.
 *
 * Necesitan la base con esquema y seeds: en local la levanta docker compose,
 * en CI el servicio postgres del workflow.
 */

const app = crearApp();
const hayBase = Boolean(config.urlBaseDatos);

afterAll(async () => {
  await cerrarPool();
});

describe.skipIf(!hayBase)('POST /api/auth/login', () => {
  it('devuelve un access token y el perfil con sus permisos', async () => {
    const respuesta = await request(app).post('/api/auth/login').send(USUARIOS_DEMO.admin);

    expect(respuesta.status).toBe(200);
    expect(typeof respuesta.body.accessToken).toBe('string');
    expect(respuesta.body.usuario.email).toBe(USUARIOS_DEMO.admin.email);
    expect(respuesta.body.usuario.rol).toBe('ADMIN');
    expect(respuesta.body.usuario.permisos).toContain('causa.ver');
  });

  it('manda el refresh token en una cookie httpOnly y no en el cuerpo', async () => {
    const respuesta = await request(app).post('/api/auth/login').send(USUARIOS_DEMO.admin);

    const cookies = respuesta.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('sl_refresh='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    // Si el refresh token apareciera en el cuerpo, un XSS podría leerlo.
    expect(JSON.stringify(respuesta.body)).not.toContain('sl_refresh');
    expect(respuesta.body.refreshToken).toBeUndefined();
  });

  it('nunca devuelve el hash de la contraseña', async () => {
    const respuesta = await request(app).post('/api/auth/login').send(USUARIOS_DEMO.admin);
    expect(JSON.stringify(respuesta.body)).not.toContain('$2');
  });

  it('rechaza una contraseña incorrecta sin revelar si el correo existe', async () => {
    const malaClave = await request(app)
      .post('/api/auth/login')
      .send({ email: USUARIOS_DEMO.admin.email, password: 'incorrecta' });

    const inexistente = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@estudiodemo.test', password: 'incorrecta' });

    expect(malaClave.status).toBe(401);
    expect(inexistente.status).toBe(401);
    // El mismo mensaje en ambos casos: si difirieran, el formulario serviría
    // para averiguar qué correos tienen cuenta.
    expect(malaClave.body.error).toBe(inexistente.body.error);
  });

  it('valida el formato del correo antes de consultar la base', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({ email: 'no-es-un-mail', password: 'x' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.detalles?.email).toBeDefined();
  });
});

describe.skipIf(!hayBase)('GET /api/auth/perfil', () => {
  it('devuelve el usuario de la sesión', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/auth/perfil'), sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.email).toBe(USUARIOS_DEMO.admin.email);
  });

  it('rechaza una petición sin token', async () => {
    const respuesta = await request(app).get('/api/auth/perfil');
    expect(respuesta.status).toBe(401);
  });

  it('rechaza un token manipulado', async () => {
    const respuesta = await request(app)
      .get('/api/auth/perfil')
      .set('Authorization', 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.');

    expect(respuesta.status).toBe(401);
  });
});

describe.skipIf(!hayBase)('POST /api/auth/refrescar', () => {
  it('renueva la sesión y rota el refresh token', async () => {
    const sesion = await iniciarSesion(app);

    const renovada = await request(app).post('/api/auth/refrescar').set('Cookie', sesion.cookie);

    expect(renovada.status).toBe(200);
    expect(typeof renovada.body.accessToken).toBe('string');

    const nuevaCookie = (renovada.headers['set-cookie'] as unknown as string[]).join('; ');
    expect(nuevaCookie).not.toBe(sesion.cookie);
  });

  it('corta todas las sesiones si se reutiliza un refresh token ya consumido', async () => {
    const sesion = await iniciarSesion(app);

    // Primer uso: válido, y deja el token anterior revocado.
    const primera = await request(app).post('/api/auth/refrescar').set('Cookie', sesion.cookie);
    expect(primera.status).toBe(200);

    // Segundo uso del mismo token: es la señal de que alguien tiene una copia.
    const reutilizado = await request(app).post('/api/auth/refrescar').set('Cookie', sesion.cookie);
    expect(reutilizado.status).toBe(401);

    // Y la sesión que había nacido del primer refresco también queda cortada.
    const cookieVigente = (primera.headers['set-cookie'] as unknown as string[]).join('; ');
    const despues = await request(app).post('/api/auth/refrescar').set('Cookie', cookieVigente);
    expect(despues.status).toBe(401);
  });

  it('rechaza el refresco cuando no hay cookie', async () => {
    const respuesta = await request(app).post('/api/auth/refrescar');
    expect(respuesta.status).toBe(401);
  });
});

describe.skipIf(!hayBase)('POST /api/auth/logout', () => {
  it('revoca la sesión: el refresh token deja de servir', async () => {
    const sesion = await iniciarSesion(app);

    const salida = await request(app).post('/api/auth/logout').set('Cookie', sesion.cookie);
    expect(salida.status).toBe(204);

    const reintento = await request(app).post('/api/auth/refrescar').set('Cookie', sesion.cookie);
    expect(reintento.status).toBe(401);
  });
});
