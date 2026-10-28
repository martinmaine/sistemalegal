import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app';
import { cerrarPool } from '../src/db';
import { config } from '../src/config';
import {
  conSesion,
  iniciarSesion,
  limpiarDatosDePrueba,
  PREFIJO_PRUEBA,
  USUARIOS_DEMO,
  type SesionDePrueba,
} from './ayudas';

/**
 * Plazos sobre la base real.
 *
 * El cómputo en sí se prueba aparte, en `computo-plazos.test.ts`, con un
 * calendario fijo. Acá se verifica lo otro: que el calendario correcto llegue
 * al motor, que el resultado quede guardado, y que suspender y reanudar
 * muevan el vencimiento.
 */

const app = crearApp();
const hayBase = Boolean(config.urlBaseDatos);

afterAll(async () => {
  if (hayBase) await limpiarDatosDePrueba();
  await cerrarPool();
});

async function crearExpediente(sesion: SesionDePrueba): Promise<string> {
  const catalogos = await conSesion(request(app).get('/api/catalogos'), sesion);
  const creada = await conSesion(request(app).post('/api/causas'), sesion).send({
    caratula: `${PREFIJO_PRUEBA}PLAZOS ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fuero_id: catalogos.body.fueros[0].id,
    estado_causa_id: catalogos.body.estados[0].id,
    fecha_inicio: '2026-02-01',
  });

  expect(creada.status).toBe(201);
  return creada.body.causa.id as string;
}

/** Plazo base: notificación el martes 10/3/2026, 5 días hábiles. */
const PLAZO_BASE = {
  descripcion: 'Contestar demanda',
  fecha_notificacion: '2026-03-10',
  cantidad_dias: 5,
  computo: 'HABIL' as const,
};

/**
 * Una fecha a N días de hoy, en UTC.
 *
 * Las pruebas del listado necesitan plazos que todavía no vencieron: al
 * consultar la agenda, el servicio marca como VENCIDO todo lo pendiente cuya
 * fecha ya pasó, y con fechas fijas de 2026 eso convertiría cada plazo de
 * prueba en vencido según cuándo se corra la suite.
 */
function dentroDeDias(dias: number): string {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias))
    .toISOString()
    .slice(0, 10);
}

async function crearPlazo(
  sesion: SesionDePrueba,
  causaId: string,
  extra: Record<string, unknown> = {},
) {
  return conSesion(request(app).post(`/api/causas/${causaId}/plazos`), sesion).send({
    ...PLAZO_BASE,
    ...extra,
  });
}

describe.skipIf(!hayBase)('previsualización del cómputo', () => {
  it('calcula sin guardar y explica cómo llegó a la fecha', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    const simulado = await conSesion(
      request(app).post(`/api/causas/${causaId}/plazos/simular`),
      sesion,
    ).send(PLAZO_BASE);

    expect(simulado.status).toBe(200);
    // Arranca el miércoles 11 y cuenta 5 hábiles salteando el fin de semana.
    expect(simulado.body.fecha_inicio_computo).toBe('2026-03-11');
    expect(simulado.body.fecha_vencimiento).toBe('2026-03-17');
    expect(Array.isArray(simulado.body.explicacion)).toBe(true);
    expect(simulado.body.explicacion.join(' ')).toMatch(/no se cuenta/i);

    // Simular no guarda nada.
    const listado = await conSesion(request(app).get(`/api/plazos?causa=${causaId}`), sesion);
    expect(listado.body.total).toBe(0);
  });

  it('rechaza insumos imposibles con un mensaje que dice qué revisar', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    const simulado = await conSesion(
      request(app).post(`/api/causas/${causaId}/plazos/simular`),
      sesion,
    ).send({ ...PLAZO_BASE, cantidad_dias: 0 });

    expect(simulado.status).toBe(400);
  });
});

describe.skipIf(!hayBase)('alta de plazos', () => {
  it('guarda el vencimiento calculado y lo relee de la base', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    const creado = await crearPlazo(sesion, causaId);
    expect(creado.status).toBe(201);
    expect(creado.body.plazo.fecha_vencimiento).toBe('2026-03-17');

    const releido = await conSesion(request(app).get(`/api/plazos/${creado.body.plazo.id}`), sesion);
    expect(releido.status).toBe(200);
    expect(releido.body.plazo.fecha_vencimiento).toBe('2026-03-17');
    // El original se guarda igual al primer cálculo: es contra lo que después
    // se compara el efecto de las suspensiones.
    expect(releido.body.plazo.fecha_vencimiento_original).toBe('2026-03-17');
  });

  it('el detalle rehace el cómputo y confirma que coincide con lo guardado', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);

    const detalle = await conSesion(request(app).get(`/api/plazos/${creado.body.plazo.id}`), sesion);

    expect(detalle.body.computo).not.toBeNull();
    expect(detalle.body.computo.coincide_con_lo_guardado).toBe(true);
    expect(detalle.body.computo.fecha_vencimiento_calculada).toBe('2026-03-17');
    // El día por día tiene que estar, que es lo que permite auditarlo.
    expect(detalle.body.computo.dias.length).toBeGreaterThan(5);
  });

  it('aplica el calendario judicial cargado en la base', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    // La feria judicial del seed llega hasta el 15/7/2026. Un plazo notificado
    // dentro de la feria no puede empezar a correr dentro de ella.
    const creado = await crearPlazo(sesion, causaId, {
      fecha_notificacion: '2026-07-06',
      cantidad_dias: 1,
    });

    expect(creado.status).toBe(201);
    expect(creado.body.plazo.fecha_inicio_computo > '2026-07-15').toBe(true);
  });

  it('exige descripción y rechaza el alta sin ella', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    const creado = await conSesion(
      request(app).post(`/api/causas/${causaId}/plazos`),
      sesion,
    ).send({ ...PLAZO_BASE, descripcion: '' });

    expect(creado.status).toBe(400);
    expect(creado.body.detalles?.descripcion).toBeDefined();
  });

  it('responde 404 si el expediente no existe', async () => {
    const sesion = await iniciarSesion(app);
    const creado = await conSesion(
      request(app).post('/api/causas/00000000-0000-0000-0000-000000000000/plazos'),
      sesion,
    ).send(PLAZO_BASE);

    expect(creado.status).toBe(404);
  });
});

describe.skipIf(!hayBase)('edición', () => {
  it('recalcula el vencimiento cuando cambian los insumos', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);
    const id = creado.body.plazo.id as string;

    const editado = await conSesion(request(app).put(`/api/plazos/${id}`), sesion).send({
      ...PLAZO_BASE,
      cantidad_dias: 10,
    });

    expect(editado.status).toBe(200);
    // 10 hábiles desde el miércoles 11. El día 10 caería el martes 24, pero el
    // 24/3 es feriado nacional en el calendario del seed, así que vence el 25.
    // Esto es lo que verifica que el calendario real llegue al motor.
    expect(editado.body.plazo.fecha_vencimiento).toBe('2026-03-25');

    const releido = await conSesion(request(app).get(`/api/plazos/${id}`), sesion);
    expect(releido.body.plazo.fecha_vencimiento).toBe('2026-03-25');
  });
});

describe.skipIf(!hayBase)('cumplir y reabrir', () => {
  it('marca el plazo como cumplido con su fecha', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);
    const id = creado.body.plazo.id as string;

    const cumplido = await conSesion(request(app).post(`/api/plazos/${id}/cumplir`), sesion).send({
      fecha_cumplimiento: '2026-03-16',
    });

    expect(cumplido.status).toBe(200);
    expect(cumplido.body.plazo.estado).toBe('CUMPLIDO');
    expect(cumplido.body.plazo.fecha_cumplimiento).toBe('2026-03-16');
  });

  it('no deja cumplir dos veces', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);
    const id = creado.body.plazo.id as string;

    await conSesion(request(app).post(`/api/plazos/${id}/cumplir`), sesion).send({});
    const otraVez = await conSesion(request(app).post(`/api/plazos/${id}/cumplir`), sesion).send({});

    expect(otraVez.status).toBe(409);
  });

  it('no deja editar un plazo cumplido sin reabrirlo', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);
    const id = creado.body.plazo.id as string;

    await conSesion(request(app).post(`/api/plazos/${id}/cumplir`), sesion).send({});

    const editado = await conSesion(request(app).put(`/api/plazos/${id}`), sesion).send(PLAZO_BASE);
    expect(editado.status).toBe(409);

    const reabierto = await conSesion(request(app).post(`/api/plazos/${id}/reabrir`), sesion);
    expect(reabierto.status).toBe(200);
    expect(reabierto.body.plazo.estado).toBe('PENDIENTE');

    const otraVez = await conSesion(request(app).put(`/api/plazos/${id}`), sesion).send(PLAZO_BASE);
    expect(otraVez.status).toBe(200);
  });

  it('rechaza un cumplimiento anterior a la notificación', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);

    const cumplido = await conSesion(
      request(app).post(`/api/plazos/${creado.body.plazo.id}/cumplir`),
      sesion,
    ).send({ fecha_cumplimiento: '2026-01-01' });

    expect(cumplido.status).toBe(400);
    expect(cumplido.body.detalles?.fecha_cumplimiento).toBeDefined();
  });
});

describe.skipIf(!hayBase)('suspender y reanudar', () => {
  it('una suspensión cerrada corre el vencimiento y conserva el original', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);
    const id = creado.body.plazo.id as string;

    const suspendido = await conSesion(
      request(app).post(`/api/plazos/${id}/suspender`),
      sesion,
    ).send({ fecha_desde: '2026-03-12', fecha_hasta: '2026-03-16', motivo: 'Incidente' });

    expect(suspendido.status).toBe(200);
    expect(suspendido.body.plazo.estado).toBe('SUSPENDIDO');
    // Se perdieron tres días hábiles: el vencimiento pasa del 17 al 20.
    expect(suspendido.body.plazo.fecha_vencimiento).toBe('2026-03-20');
    expect(suspendido.body.plazo.fecha_vencimiento_original).toBe('2026-03-17');
  });

  it('una suspensión abierta deja el plazo detenido y lo avisa', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);
    const id = creado.body.plazo.id as string;

    const suspendido = await conSesion(
      request(app).post(`/api/plazos/${id}/suspender`),
      sesion,
    ).send({ fecha_desde: '2026-03-12', motivo: 'A la espera de resolución' });

    expect(suspendido.status).toBe(200);
    expect(suspendido.body.plazo.suspendido_sin_fin).toBe(true);

    // El detalle no puede calcular un vencimiento, y lo dice en vez de inventarlo.
    const detalle = await conSesion(request(app).get(`/api/plazos/${id}`), sesion);
    expect(detalle.body.computo).toBeNull();
    expect(detalle.body.error_computo).toBeTruthy();
  });

  it('reanudar cierra la suspensión y vuelve a calcular', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);
    const id = creado.body.plazo.id as string;

    await conSesion(request(app).post(`/api/plazos/${id}/suspender`), sesion).send({
      fecha_desde: '2026-03-12',
      motivo: 'A la espera de resolución',
    });

    const reanudado = await conSesion(request(app).post(`/api/plazos/${id}/reanudar`), sesion).send({
      fecha_hasta: '2026-03-16',
    });

    expect(reanudado.status).toBe(200);
    expect(reanudado.body.plazo.estado).toBe('PENDIENTE');
    expect(reanudado.body.plazo.fecha_vencimiento).toBe('2026-03-20');
    expect(reanudado.body.plazo.suspendido_sin_fin).toBe(false);
  });

  it('no deja reanudar lo que no está suspendido', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);

    const reanudado = await conSesion(
      request(app).post(`/api/plazos/${creado.body.plazo.id}/reanudar`),
      sesion,
    ).send({ fecha_hasta: '2026-03-16' });

    expect(reanudado.status).toBe(409);
  });

  it('rechaza una suspensión anterior al inicio del cómputo', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    const creado = await crearPlazo(sesion, causaId);

    const suspendido = await conSesion(
      request(app).post(`/api/plazos/${creado.body.plazo.id}/suspender`),
      sesion,
    ).send({ fecha_desde: '2026-01-05', motivo: 'Antes de tiempo' });

    expect(suspendido.status).toBe(400);
    expect(suspendido.body.detalles?.fecha_desde).toBeDefined();
  });
});

describe.skipIf(!hayBase)('listado y agenda', () => {
  it('filtra por rango de vencimiento', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    const creado = await crearPlazo(sesion, causaId, { fecha_notificacion: dentroDeDias(30) });
    const vence = creado.body.plazo.fecha_vencimiento as string;

    const dentro = await conSesion(
      request(app).get(`/api/plazos?causa=${causaId}&desde=${vence}&hasta=${vence}`),
      sesion,
    );
    expect(dentro.body.total).toBe(1);

    const fuera = await conSesion(
      request(app).get(`/api/plazos?causa=${causaId}&desde=2020-01-01&hasta=2020-12-31`),
      sesion,
    );
    expect(fuera.body.total).toBe(0);
  });

  it('por defecto muestra solo los que todavía pueden vencer', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    // Notificado hace unos días y con un plazo largo: queda realmente
    // pendiente, y además se puede dar por cumplido hoy, que es lo que no
    // permitiría un plazo notificado en el futuro.
    const creado = await crearPlazo(sesion, causaId, {
      fecha_notificacion: dentroDeDias(-5),
      cantidad_dias: 60,
    });

    const pendiente = await conSesion(request(app).get(`/api/plazos?causa=${causaId}`), sesion);
    expect(pendiente.body.total).toBe(1);

    await conSesion(request(app).post(`/api/plazos/${creado.body.plazo.id}/cumplir`), sesion).send(
      {},
    );

    const abiertos = await conSesion(request(app).get(`/api/plazos?causa=${causaId}`), sesion);
    expect(abiertos.body.total).toBe(0);

    const todos = await conSesion(
      request(app).get(`/api/plazos?causa=${causaId}&vigencia=todos`),
      sesion,
    );
    expect(todos.body.total).toBe(1);
  });

  it('un plazo cuya fecha ya pasó sigue a la vista, con los días en negativo', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    // PLAZO_BASE vence en marzo de 2026, que para la suite ya es pasado.
    await crearPlazo(sesion, causaId);

    // Esconderlo del filtro de plazos abiertos seria el peor comportamiento
    // posible: un vencimiento incumplido es justo lo que hay que ver primero.
    const abiertos = await conSesion(request(app).get(`/api/plazos?causa=${causaId}`), sesion);

    expect(abiertos.body.total).toBe(1);
    expect(abiertos.body.datos[0].estado).toBe('PENDIENTE');
    expect(abiertos.body.datos[0].dias_restantes).toBeLessThan(0);
  });

  it('el plazo aparece también en la pestaña del expediente', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);
    await crearPlazo(sesion, causaId);

    const pestana = await conSesion(request(app).get(`/api/causas/${causaId}/plazos`), sesion);
    expect(pestana.status).toBe(200);
    expect(pestana.body.datos).toHaveLength(1);
  });

  it('exige sesión', async () => {
    const respuesta = await request(app).get('/api/plazos');
    expect(respuesta.status).toBe(401);
  });
});

describe.skipIf(!hayBase)('permisos', () => {
  it('un empleado puede cargar y cumplir, pero no eliminar', async () => {
    const admin = await iniciarSesion(app);
    const causaId = await crearExpediente(admin);

    const empleado = await iniciarSesion(app, USUARIOS_DEMO.empleado);
    expect(empleado.usuario.permisos).toContain('plazo.crear');
    expect(empleado.usuario.permisos).not.toContain('plazo.eliminar');

    const creado = await crearPlazo(empleado, causaId);
    expect(creado.status).toBe(201);

    const borrado = await conSesion(
      request(app).delete(`/api/plazos/${creado.body.plazo.id}`),
      empleado,
    );
    expect(borrado.status).toBe(403);

    // Y el plazo sigue ahí.
    const releido = await conSesion(request(app).get(`/api/plazos/${creado.body.plazo.id}`), admin);
    expect(releido.status).toBe(200);
  });
});

describe.skipIf(!hayBase)('movimientos procesales', () => {
  it('registra un movimiento y lo devuelve en el historial', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    const creado = await conSesion(
      request(app).post(`/api/causas/${causaId}/movimientos`),
      sesion,
    ).send({ fecha: '2026-03-10', tipo: 'Cédula', descripcion: 'Se notifica traslado de demanda.' });

    expect(creado.status).toBe(201);
    expect(creado.body.movimiento.origen).toBe('MANUAL');

    const historial = await conSesion(
      request(app).get(`/api/causas/${causaId}/movimientos`),
      sesion,
    );
    expect(historial.body.datos).toHaveLength(1);
    expect(historial.body.datos[0].descripcion).toBe('Se notifica traslado de demanda.');
  });

  it('borra un movimiento cargado a mano', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    const creado = await conSesion(
      request(app).post(`/api/causas/${causaId}/movimientos`),
      sesion,
    ).send({ fecha: '2026-03-10', descripcion: 'Cargado por error.' });

    const borrado = await conSesion(
      request(app).delete(`/api/causas/${causaId}/movimientos/${creado.body.movimiento.id}`),
      sesion,
    );
    expect(borrado.status).toBe(200);

    const historial = await conSesion(
      request(app).get(`/api/causas/${causaId}/movimientos`),
      sesion,
    );
    expect(historial.body.datos).toHaveLength(0);
  });

  it('exige la descripción', async () => {
    const sesion = await iniciarSesion(app);
    const causaId = await crearExpediente(sesion);

    const creado = await conSesion(
      request(app).post(`/api/causas/${causaId}/movimientos`),
      sesion,
    ).send({ fecha: '2026-03-10' });

    expect(creado.status).toBe(400);
    expect(creado.body.detalles?.descripcion).toBeDefined();
  });
});
