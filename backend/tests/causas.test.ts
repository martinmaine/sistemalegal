import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app';
import { cerrarPool, obtenerPool } from '../src/db';
import { config } from '../src/config';
import { armarPagina, desplazamiento } from '../src/comun/paginacion';
import { esquemaFiltrosCausa } from '../src/modulos/causas/esquemas';
import { conSesion, iniciarSesion, USUARIOS_DEMO } from './ayudas';

const app = crearApp();
const hayBase = Boolean(config.urlBaseDatos);

/**
 * Prefijo de las causas que crean las pruebas.
 *
 * En CI la base nace y muere con la corrida, pero en local es la misma que usa
 * el entorno de desarrollo: sin esta limpieza, cada `npm test` dejaría
 * expedientes de prueba mezclados con los datos de demostración.
 */
const PREFIJO_PRUEBA = 'PRUEBA ';

afterAll(async () => {
  if (hayBase) {
    await obtenerPool()
      .query('DELETE FROM causa WHERE caratula LIKE $1', [`${PREFIJO_PRUEBA}%`])
      .catch(() => undefined);
  }
  await cerrarPool();
});

describe('paginación', () => {
  it('calcula el total de páginas y el desplazamiento', () => {
    const pagina = armarPagina(['a', 'b'], 25, { pagina: 2, tamano: 10 });

    expect(pagina.totalPaginas).toBe(3);
    expect(desplazamiento({ pagina: 2, tamano: 10 })).toBe(10);
  });

  it('informa una página aunque no haya resultados, para no romper la paginación vacía', () => {
    expect(armarPagina([], 0, { pagina: 1, tamano: 20 }).totalPaginas).toBe(1);
  });
});

describe('validación de filtros de causas', () => {
  it('aplica valores por defecto razonables', () => {
    const filtros = esquemaFiltrosCausa.parse({});

    expect(filtros.pagina).toBe(1);
    expect(filtros.orden).toBe('fecha_inicio');
    expect(filtros.direccion).toBe('desc');
  });

  it('rechaza un orden fuera de la lista permitida', () => {
    // El valor termina en un ORDER BY: aceptarlo libre sería inyección de SQL.
    const resultado = esquemaFiltrosCausa.safeParse({ orden: 'caratula; DROP TABLE causa' });
    expect(resultado.success).toBe(false);
  });

  it('acota el tamaño de página para que nadie pida la tabla entera', () => {
    expect(esquemaFiltrosCausa.safeParse({ tamano: 5000 }).success).toBe(false);
  });

  it('rechaza un identificador de filtro que no sea UUID', () => {
    expect(esquemaFiltrosCausa.safeParse({ estado: 'lo-que-sea' }).success).toBe(false);
  });
});

describe.skipIf(!hayBase)('GET /api/causas', () => {
  it('exige sesión', async () => {
    const respuesta = await request(app).get('/api/causas');
    expect(respuesta.status).toBe(401);
  });

  it('devuelve las causas del seed paginadas', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/causas'), sesion);

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.datos)).toBe(true);
    expect(respuesta.body.datos.length).toBeGreaterThan(0);
    expect(typeof respuesta.body.total).toBe('number');

    const causa = respuesta.body.datos[0];
    expect(causa).toHaveProperty('caratula');
    expect(causa).toHaveProperty('estado');
    expect(causa).toHaveProperty('fuero');
    // La fecha viaja como texto YYYY-MM-DD, sin corrimiento por zona horaria.
    expect(causa.fecha_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('respeta el tamaño de página', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/causas?tamano=1'), sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos).toHaveLength(1);
    expect(respuesta.body.tamano).toBe(1);
  });

  it('busca sin distinguir tildes ni mayúsculas', async () => {
    const sesion = await iniciarSesion(app);

    const todas = await conSesion(request(app).get('/api/causas?tamano=100'), sesion);
    const primera = todas.body.datos[0];

    // Se toma una palabra larga de la carátula real y se busca en minúsculas
    // y sin tildes: tiene que encontrar la misma causa.
    const palabra = (primera.caratula as string)
      .split(/[\s,]+/)
      .find((p: string) => p.length > 5);
    const sinTildes = palabra!.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const buscada = await conSesion(
      request(app).get(`/api/causas?busqueda=${encodeURIComponent(sinTildes)}`),
      sesion,
    );

    expect(buscada.status).toBe(200);
    expect(buscada.body.datos.some((c: { id: string }) => c.id === primera.id)).toBe(true);
  });

  it('el total coincide con lo que devuelve el filtro, no con la tabla entera', async () => {
    const sesion = await iniciarSesion(app);

    const activas = await conSesion(request(app).get('/api/causas?vigencia=activas&tamano=100'), sesion);
    expect(activas.body.total).toBe(activas.body.datos.length);
    expect(activas.body.datos.every((c: { es_final: boolean }) => c.es_final === false)).toBe(true);
  });

  it('rechaza un filtro inválido en lugar de ignorarlo', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/causas?orden=inventado'), sesion);

    expect(respuesta.status).toBe(400);
  });
});

describe.skipIf(!hayBase)('GET /api/causas/:id', () => {
  it('trae el expediente con sus partes y profesionales', async () => {
    const sesion = await iniciarSesion(app);
    const listado = await conSesion(request(app).get('/api/causas?tamano=1'), sesion);
    const id = listado.body.datos[0].id;

    const respuesta = await conSesion(request(app).get(`/api/causas/${id}`), sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.causa.id).toBe(id);
    expect(Array.isArray(respuesta.body.partes)).toBe(true);
    expect(Array.isArray(respuesta.body.profesionales)).toBe(true);
  });

  it('responde 404 con un mensaje para el usuario cuando el expediente no existe', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(
      request(app).get('/api/causas/00000000-0000-0000-0000-000000000000'),
      sesion,
    );

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.codigo).toBe('NO_ENCONTRADO');
  });

  it('responde 400 cuando el identificador no es un UUID', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).get('/api/causas/no-es-uuid'), sesion);

    expect(respuesta.status).toBe(400);
  });
});

describe.skipIf(!hayBase)('permisos sobre causas', () => {
  it('un empleado no puede eliminar, pero sí ver', async () => {
    const sesion = await iniciarSesion(app, USUARIOS_DEMO.empleado);

    expect(sesion.usuario.permisos).toContain('causa.ver');
    // El seed no le da causa.eliminar al rol EMPLEADO.
    expect(sesion.usuario.permisos).not.toContain('causa.eliminar');

    const listado = await conSesion(request(app).get('/api/causas'), sesion);
    expect(listado.status).toBe(200);
  });
});

describe.skipIf(!hayBase)('POST /api/causas', () => {
  it('crea el expediente, lo persiste y asigna a quien lo crea como titular', async () => {
    const sesion = await iniciarSesion(app);
    const catalogos = await conSesion(request(app).get('/api/catalogos'), sesion);

    const nuevo = {
      caratula: `${PREFIJO_PRUEBA}AUTOMATIZADA c/ SISTEMA - ${Date.now()}`,
      fuero_id: catalogos.body.fueros[0].id,
      estado_causa_id: catalogos.body.estados[0].id,
      fecha_inicio: '2026-03-10',
    };

    const creada = await conSesion(request(app).post('/api/causas'), sesion).send(nuevo);

    expect(creada.status).toBe(201);
    expect(creada.body.causa.caratula).toBe(nuevo.caratula);

    // Lo que importa no es la respuesta del POST sino que el dato quedó guardado.
    const releida = await conSesion(request(app).get(`/api/causas/${creada.body.causa.id}`), sesion);
    expect(releida.status).toBe(200);
    expect(releida.body.causa.caratula).toBe(nuevo.caratula);
    expect(releida.body.profesionales.some((p: { rol_en_causa: string }) => p.rol_en_causa === 'TITULAR')).toBe(
      true,
    );
  });

  it('rechaza un alta sin carátula explicando qué campo falta', async () => {
    const sesion = await iniciarSesion(app);
    const respuesta = await conSesion(request(app).post('/api/causas'), sesion).send({
      fecha_inicio: '2026-03-10',
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.detalles?.caratula).toBeDefined();
  });

  it('no permite dos expedientes con el mismo número', async () => {
    const sesion = await iniciarSesion(app);
    const catalogos = await conSesion(request(app).get('/api/catalogos'), sesion);

    const numero = `TEST-${Date.now()}`;
    const base = {
      caratula: `${PREFIJO_PRUEBA}DUPLICADO`,
      numero_expediente: numero,
      fuero_id: catalogos.body.fueros[0].id,
      estado_causa_id: catalogos.body.estados[0].id,
      fecha_inicio: '2026-03-10',
    };

    const primera = await conSesion(request(app).post('/api/causas'), sesion).send(base);
    expect(primera.status).toBe(201);

    const repetida = await conSesion(request(app).post('/api/causas'), sesion).send(base);
    expect(repetida.status).toBe(409);
    expect(repetida.body.detalles?.numero_expediente).toBeDefined();
  });
});
