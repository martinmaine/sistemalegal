import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app';
import { cerrarPool } from '../src/db';
import { config } from '../src/config';
import { conSesion, iniciarSesion } from './ayudas';

const app = crearApp();
const hayBase = Boolean(config.urlBaseDatos);

afterAll(async () => {
  await cerrarPool();
});

describe.skipIf(!hayBase)('GET /api/panel', () => {
  it('exige sesión', async () => {
    expect((await request(app).get('/api/panel')).status).toBe(401);
  });

  it('devuelve indicadores calculados sobre la base', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/panel'), sesion);

    expect(respuesta.status).toBe(200);

    const { indicadores } = respuesta.body;
    for (const clave of [
      'causas_activas',
      'plazos_por_vencer',
      'plazos_vencidos',
      'tareas_abiertas',
      'mis_tareas_abiertas',
      'audiencias_proximas',
    ]) {
      expect(typeof indicadores[clave]).toBe('number');
    }

    // El seed tiene causas en trámite: si esto diera 0, el panel estaría
    // contando otra cosa.
    expect(indicadores.causas_activas).toBeGreaterThan(0);
  });

  it('las causas activas del panel coinciden con el listado filtrado', async () => {
    const sesion = await iniciarSesion(app);

    const panel = await conSesion(request(app).get('/api/panel'), sesion);
    const listado = await conSesion(request(app).get('/api/causas?vigencia=activas&tamano=100'), sesion);

    expect(panel.body.indicadores.causas_activas).toBe(listado.body.total);
  });

  it('incluye el bloque financiero para quien tiene permiso de costas', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/panel'), sesion);

    expect(sesion.usuario.permisos).toContain('costa.ver');
    expect(respuesta.body.finanzas).toBeDefined();
    expect(typeof respuesta.body.finanzas.saldo_pendiente).toBe('string');
  });
});

describe.skipIf(!hayBase)('GET /api/catalogos', () => {
  it('devuelve los catálogos que alimentan filtros y formularios', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/catalogos'), sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.fueros.length).toBeGreaterThan(0);
    expect(respuesta.body.estados.length).toBeGreaterThan(0);
    expect(respuesta.body.tribunales.length).toBeGreaterThan(0);
    // Los tribunales traen su fuero para poder acotar el desplegable.
    expect(respuesta.body.tribunales[0]).toHaveProperty('fuero_id');
  });
});

describe.skipIf(!hayBase)('GET /api/personas', () => {
  it('lista la agenda con la cantidad de causas de cada persona', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/personas'), sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.length).toBeGreaterThan(0);
    expect(typeof respuesta.body.datos[0].cantidad_causas).toBe('number');
  });

  it('filtra solo clientes', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/personas?soloClientes=true'), sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.every((p: { es_cliente: boolean }) => p.es_cliente)).toBe(true);
  });
});
