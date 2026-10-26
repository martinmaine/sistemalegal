import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app';
import { cerrarPool } from '../src/db';
import { acotarLimite } from '../src/modulos/causas/servicio';
import { config } from '../src/config';

const app = crearApp();
const hayBase = Boolean(config.urlBaseDatos);

afterAll(async () => {
  await cerrarPool();
});

describe('acotarLimite', () => {
  it('usa el límite por defecto cuando no se pide nada', () => {
    expect(acotarLimite(undefined)).toBe(config.limiteListados);
  });

  it('rechaza valores inválidos en lugar de propagarlos al SQL', () => {
    expect(acotarLimite(Number.NaN)).toBe(config.limiteListados);
    expect(acotarLimite(0)).toBe(config.limiteListados);
    expect(acotarLimite(-5)).toBe(config.limiteListados);
  });

  it('nunca supera el tope configurado', () => {
    expect(acotarLimite(10_000)).toBe(config.limiteListados);
  });

  it('respeta un límite razonable pedido por el cliente', () => {
    expect(acotarLimite(3)).toBe(3);
  });
});

// Prueba de integración: necesita la base con el esquema y los seeds aplicados.
// En local la levanta docker compose; en CI, el servicio postgres del workflow.
describe.skipIf(!hayBase)('GET /api/causas contra la base real', () => {
  it('devuelve las causas del seed con su estado y fuero', async () => {
    const respuesta = await request(app).get('/api/causas');

    expect(respuesta.status).toBe(200);
    expect(typeof respuesta.body.total).toBe('number');
    expect(Array.isArray(respuesta.body.causas)).toBe(true);
    expect(respuesta.body.causas.length).toBeGreaterThan(0);

    const causa = respuesta.body.causas[0];
    expect(causa).toHaveProperty('caratula');
    expect(causa).toHaveProperty('estado');
    expect(causa).toHaveProperty('fuero');
    // La fecha viaja como texto YYYY-MM-DD, sin corrimiento por zona horaria.
    expect(causa.fecha_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('respeta el parámetro limite', async () => {
    const respuesta = await request(app).get('/api/causas?limite=1');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.causas).toHaveLength(1);
  });
});
