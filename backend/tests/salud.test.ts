import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app';
import { cerrarPool } from '../src/db';

const app = crearApp();

afterAll(async () => {
  await cerrarPool();
});

describe('GET /health', () => {
  it('responde 200 e informa el estado de la base', async () => {
    const respuesta = await request(app).get('/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('ok');
    expect(['conectada', 'sin-conexion']).toContain(respuesta.body.base);
  });

  it('sigue devolviendo 200 aunque la base no responda, para que Render no reinicie el servicio', async () => {
    const respuesta = await request(app).get('/health');
    expect(respuesta.status).toBe(200);
  });
});

describe('rutas inexistentes', () => {
  it('responde 404 con un mensaje, no con el HTML por defecto de Express', async () => {
    const respuesta = await request(app).get('/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toContain('/no-existe');
  });
});
