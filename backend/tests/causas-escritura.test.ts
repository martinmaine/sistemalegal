import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { crearApp } from '../src/app';
import { cerrarPool } from '../src/db';
import { config } from '../src/config';
import { esquemaEditarCausa } from '../src/modulos/causas/esquemas';
import {
  conSesion,
  iniciarSesion,
  limpiarDatosDePrueba,
  PREFIJO_PRUEBA,
  USUARIOS_DEMO,
  type SesionDePrueba,
} from './ayudas';

/**
 * Escritura sobre expedientes: edición, baja, partes y equipo asignado.
 *
 * Cada prueba trabaja sobre un expediente que ella misma crea, nunca sobre los
 * del seed: así puede editarlo y darlo de baja sin alterar lo que se ve en la
 * aplicación, y el orden entre pruebas deja de importar.
 */

const app = crearApp();
const hayBase = Boolean(config.urlBaseDatos);

afterAll(async () => {
  if (hayBase) await limpiarDatosDePrueba();
  await cerrarPool();
});

interface Catalogos {
  fueros: { id: string; nombre: string }[];
  estados: { id: string; nombre: string; es_final: boolean }[];
  tribunales: { id: string; nombre: string; fuero_id: string }[];
  profesionales: { id: string; nombre: string }[];
}

async function catalogos(sesion: SesionDePrueba): Promise<Catalogos> {
  const respuesta = await conSesion(request(app).get('/api/catalogos'), sesion);
  return respuesta.body as Catalogos;
}

/** Crea un expediente de prueba y devuelve su id junto con los catálogos usados. */
async function crearExpediente(
  sesion: SesionDePrueba,
  extra: Record<string, unknown> = {},
): Promise<{ id: string; cat: Catalogos; base: Record<string, unknown> }> {
  const cat = await catalogos(sesion);
  const base = {
    caratula: `${PREFIJO_PRUEBA}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fuero_id: cat.fueros[0]!.id,
    estado_causa_id: cat.estados[0]!.id,
    fecha_inicio: '2026-02-01',
    moneda: 'ARS',
    ...extra,
  };

  const creada = await conSesion(request(app).post('/api/causas'), sesion).send(base);
  expect(creada.status).toBe(201);
  return { id: creada.body.causa.id as string, cat, base };
}

/** Una persona de la agenda creada por la prueba, para vincularla como parte. */
async function crearPersona(sesion: SesionDePrueba, apellido = 'TESTIGO'): Promise<string> {
  const respuesta = await conSesion(request(app).post('/api/personas'), sesion).send({
    tipo_persona: 'FISICA',
    nombre: 'Juan',
    apellido: `${PREFIJO_PRUEBA}${apellido}`,
  });
  expect(respuesta.status).toBe(201);
  return respuesta.body.persona.id as string;
}

describe('validación de la edición de causas', () => {
  const valido = {
    caratula: 'ALGUNA c/ OTRA',
    // UUID generados, no escritos a mano: z.uuid() verifica los bits de versión
    // y variante de la RFC 4122, que un '1111-1111-...' no cumple.
    fuero_id: randomUUID(),
    estado_causa_id: randomUUID(),
    fecha_inicio: '2026-01-10',
  };

  it('acepta un cierre posterior al inicio', () => {
    const resultado = esquemaEditarCausa.safeParse({ ...valido, fecha_cierre: '2026-05-01' });
    expect(resultado.success).toBe(true);
  });

  it('rechaza un cierre anterior al inicio señalando el campo', () => {
    // La base tiene ck_causa_fechas, pero una violación de restricción no dice
    // en qué campo del formulario está el problema.
    const resultado = esquemaEditarCausa.safeParse({ ...valido, fecha_cierre: '2025-12-01' });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.some((p) => p.path.join('.') === 'fecha_cierre')).toBe(true);
    }
  });

  it('trata la fecha de cierre vacía como "sin cerrar"', () => {
    const resultado = esquemaEditarCausa.safeParse({ ...valido, fecha_cierre: '' });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.fecha_cierre).toBeUndefined();
  });
});

describe.skipIf(!hayBase)('PUT /api/causas/:id', () => {
  it('guarda los cambios y los relee de la base', async () => {
    const sesion = await iniciarSesion(app);
    const { id, base, cat } = await crearExpediente(sesion);

    const caratulaNueva = `${base.caratula} EDITADA`;
    const estadoFinal = cat.estados.find((e) => e.es_final) ?? cat.estados[0]!;

    const editada = await conSesion(request(app).put(`/api/causas/${id}`), sesion).send({
      ...base,
      caratula: caratulaNueva,
      estado_causa_id: estadoFinal.id,
      fecha_cierre: '2026-06-30',
      monto_reclamado: 1500000,
      observaciones: 'Cerrada por acuerdo.',
    });

    expect(editada.status).toBe(200);

    // Lo que importa no es la respuesta del PUT sino lo que quedó guardado.
    const releida = await conSesion(request(app).get(`/api/causas/${id}`), sesion);
    expect(releida.body.causa.caratula).toBe(caratulaNueva);
    expect(releida.body.causa.fecha_cierre).toBe('2026-06-30');
    expect(releida.body.causa.observaciones).toBe('Cerrada por acuerdo.');
  });

  it('permite guardar sin cambiar el número de expediente', async () => {
    const sesion = await iniciarSesion(app);
    const numero = `PRUEBA-EDIT-${Date.now()}`;
    const { id, base } = await crearExpediente(sesion, { numero_expediente: numero });

    // El chequeo de duplicados tiene que excluir la propia causa: si no, nadie
    // podría corregir una carátula sin antes cambiarle el número.
    const editada = await conSesion(request(app).put(`/api/causas/${id}`), sesion).send({
      ...base,
      numero_expediente: numero,
      observaciones: 'Solo cambió esto.',
    });

    expect(editada.status).toBe(200);
  });

  it('rechaza tomar el número de otro expediente', async () => {
    const sesion = await iniciarSesion(app);
    const numeroAjeno = `PRUEBA-AJENO-${Date.now()}`;
    await crearExpediente(sesion, { numero_expediente: numeroAjeno });
    const { id, base } = await crearExpediente(sesion);

    const editada = await conSesion(request(app).put(`/api/causas/${id}`), sesion).send({
      ...base,
      numero_expediente: numeroAjeno,
    });

    expect(editada.status).toBe(409);
    expect(editada.body.detalles?.numero_expediente).toBeDefined();
  });

  it('responde 404 si el expediente no existe', async () => {
    const sesion = await iniciarSesion(app);
    const cat = await catalogos(sesion);

    const editada = await conSesion(
      request(app).put('/api/causas/00000000-0000-0000-0000-000000000000'),
      sesion,
    ).send({
      caratula: `${PREFIJO_PRUEBA}FANTASMA`,
      fuero_id: cat.fueros[0]!.id,
      estado_causa_id: cat.estados[0]!.id,
      fecha_inicio: '2026-01-01',
    });

    expect(editada.status).toBe(404);
  });
});

describe.skipIf(!hayBase)('DELETE /api/causas/:id', () => {
  it('da de baja el expediente y deja de listarlo', async () => {
    const sesion = await iniciarSesion(app);
    const { id } = await crearExpediente(sesion);

    const baja = await conSesion(request(app).delete(`/api/causas/${id}`), sesion);
    expect(baja.status).toBe(200);

    // Baja lógica: la fila sigue en la base, pero la aplicación no la ve.
    const releida = await conSesion(request(app).get(`/api/causas/${id}`), sesion);
    expect(releida.status).toBe(404);

    const listado = await conSesion(request(app).get('/api/causas?tamano=100'), sesion);
    expect(listado.body.datos.some((c: { id: string }) => c.id === id)).toBe(false);
  });

  it('un empleado no puede dar de baja un expediente', async () => {
    const admin = await iniciarSesion(app);
    const { id } = await crearExpediente(admin);

    const empleado = await iniciarSesion(app, USUARIOS_DEMO.empleado);
    const baja = await conSesion(request(app).delete(`/api/causas/${id}`), empleado);

    expect(baja.status).toBe(403);

    // Y el expediente sigue ahí: el 403 cortó antes de tocar la base.
    const releida = await conSesion(request(app).get(`/api/causas/${id}`), admin);
    expect(releida.status).toBe(200);
  });

  it('un empleado sí puede editar', async () => {
    const admin = await iniciarSesion(app);
    const { id, base } = await crearExpediente(admin);

    const empleado = await iniciarSesion(app, USUARIOS_DEMO.empleado);
    expect(empleado.usuario.permisos).toContain('causa.editar');

    const editada = await conSesion(request(app).put(`/api/causas/${id}`), empleado).send({
      ...base,
      observaciones: 'Editado por el empleado.',
    });

    expect(editada.status).toBe(200);
  });
});

describe.skipIf(!hayBase)('partes del expediente', () => {
  it('agrega una parte y la devuelve en el detalle', async () => {
    const sesion = await iniciarSesion(app);
    const { id } = await crearExpediente(sesion);
    const personaId = await crearPersona(sesion, 'ACTORA');

    const agregada = await conSesion(request(app).post(`/api/causas/${id}/partes`), sesion).send({
      persona_id: personaId,
      caracter: 'ACTOR',
      es_cliente: true,
    });

    expect(agregada.status).toBe(201);
    expect(agregada.body.parte.caracter).toBe('ACTOR');

    const detalle = await conSesion(request(app).get(`/api/causas/${id}`), sesion);
    expect(
      detalle.body.partes.some(
        (p: { persona_id: string; es_cliente: boolean }) => p.persona_id === personaId && p.es_cliente,
      ),
    ).toBe(true);
  });

  it('no repite la misma persona con el mismo carácter, pero sí con otro', async () => {
    const sesion = await iniciarSesion(app);
    const { id } = await crearExpediente(sesion);
    const personaId = await crearPersona(sesion, 'DOBLE');

    const primera = await conSesion(request(app).post(`/api/causas/${id}/partes`), sesion).send({
      persona_id: personaId,
      caracter: 'DEMANDADO',
    });
    expect(primera.status).toBe(201);

    const repetida = await conSesion(request(app).post(`/api/causas/${id}/partes`), sesion).send({
      persona_id: personaId,
      caracter: 'DEMANDADO',
    });
    expect(repetida.status).toBe(409);
    expect(repetida.body.detalles?.persona_id).toBeDefined();

    // El mismo que es demandado puede además declarar como testigo: el carácter
    // es una propiedad del vínculo, no de la persona.
    const otroCaracter = await conSesion(request(app).post(`/api/causas/${id}/partes`), sesion).send({
      persona_id: personaId,
      caracter: 'TESTIGO',
    });
    expect(otroCaracter.status).toBe(201);
  });

  it('quita la parte del expediente sin borrar a la persona de la agenda', async () => {
    const sesion = await iniciarSesion(app);
    const { id } = await crearExpediente(sesion);
    const personaId = await crearPersona(sesion, 'TRANSITORIA');

    const agregada = await conSesion(request(app).post(`/api/causas/${id}/partes`), sesion).send({
      persona_id: personaId,
      caracter: 'TERCERO',
    });
    const parteId = agregada.body.parte.id as string;

    const quitada = await conSesion(request(app).delete(`/api/causas/${id}/partes/${parteId}`), sesion);
    expect(quitada.status).toBe(200);

    const detalle = await conSesion(request(app).get(`/api/causas/${id}`), sesion);
    expect(detalle.body.partes.some((p: { id: string }) => p.id === parteId)).toBe(false);

    // La persona sigue en la agenda: se desvinculó el expediente, no se la borró.
    const persona = await conSesion(request(app).get(`/api/personas/${personaId}`), sesion);
    expect(persona.status).toBe(200);
  });

  it('rechaza un carácter que la base no admite', async () => {
    const sesion = await iniciarSesion(app);
    const { id } = await crearExpediente(sesion);
    const personaId = await crearPersona(sesion, 'INVALIDA');

    const agregada = await conSesion(request(app).post(`/api/causas/${id}/partes`), sesion).send({
      persona_id: personaId,
      caracter: 'AMIGO_DEL_JUEZ',
    });

    expect(agregada.status).toBe(400);
  });
});

describe.skipIf(!hayBase)('equipo asignado al expediente', () => {
  it('quien crea la causa queda como titular', async () => {
    const sesion = await iniciarSesion(app);
    const { id } = await crearExpediente(sesion);

    const detalle = await conSesion(request(app).get(`/api/causas/${id}`), sesion);
    expect(
      detalle.body.profesionales.some(
        (p: { usuario_id: string; rol_en_causa: string }) =>
          p.usuario_id === sesion.usuario.id && p.rol_en_causa === 'TITULAR',
      ),
    ).toBe(true);
  });

  it('asigna a otro integrante y no lo asigna dos veces', async () => {
    const sesion = await iniciarSesion(app);
    const { id, cat } = await crearExpediente(sesion);
    const otro = cat.profesionales.find((p) => p.id !== sesion.usuario.id)!;

    const asignado = await conSesion(request(app).post(`/api/causas/${id}/profesionales`), sesion).send({
      usuario_id: otro.id,
      rol_en_causa: 'COLABORADOR',
    });
    expect(asignado.status).toBe(201);

    const repetido = await conSesion(request(app).post(`/api/causas/${id}/profesionales`), sesion).send({
      usuario_id: otro.id,
      rol_en_causa: 'PATROCINANTE',
    });
    expect(repetido.status).toBe(409);
    expect(repetido.body.detalles?.usuario_id).toBeDefined();
  });

  it('no deja el expediente sin nadie a cargo', async () => {
    const sesion = await iniciarSesion(app);
    const { id } = await crearExpediente(sesion);

    const detalle = await conSesion(request(app).get(`/api/causas/${id}`), sesion);
    expect(detalle.body.profesionales).toHaveLength(1);
    const unicoId = detalle.body.profesionales[0].id as string;

    const intento = await conSesion(
      request(app).delete(`/api/causas/${id}/profesionales/${unicoId}`),
      sesion,
    );

    expect(intento.status).toBe(409);
    // El mensaje tiene que decir qué hacer, no solo que no se puede.
    expect(intento.body.error).toMatch(/asigná/i);
  });

  it('desasigna cuando queda otra persona a cargo', async () => {
    const sesion = await iniciarSesion(app);
    const { id, cat } = await crearExpediente(sesion);
    const otro = cat.profesionales.find((p) => p.id !== sesion.usuario.id)!;

    const asignado = await conSesion(request(app).post(`/api/causas/${id}/profesionales`), sesion).send({
      usuario_id: otro.id,
      rol_en_causa: 'APODERADO',
    });
    const vinculoId = asignado.body.profesional.id as string;

    const quitado = await conSesion(
      request(app).delete(`/api/causas/${id}/profesionales/${vinculoId}`),
      sesion,
    );
    expect(quitado.status).toBe(200);

    const detalle = await conSesion(request(app).get(`/api/causas/${id}`), sesion);
    expect(detalle.body.profesionales.some((p: { id: string }) => p.id === vinculoId)).toBe(false);
    expect(detalle.body.profesionales).toHaveLength(1);
  });
});
