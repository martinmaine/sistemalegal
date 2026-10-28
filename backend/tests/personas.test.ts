import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app';
import { cerrarPool } from '../src/db';
import { config } from '../src/config';
import { esquemaPersona } from '../src/modulos/personas/esquemas';
import {
  conSesion,
  iniciarSesion,
  limpiarDatosDePrueba,
  PREFIJO_PRUEBA,
  USUARIOS_DEMO,
  type SesionDePrueba,
} from './ayudas';

/** Agenda de personas: alta, edición y baja, con las reglas que replican la migración 004. */

const app = crearApp();
const hayBase = Boolean(config.urlBaseDatos);

afterAll(async () => {
  if (hayBase) await limpiarDatosDePrueba();
  await cerrarPool();
});

/**
 * Documento irrepetible, para no chocar con el seed ni entre pruebas.
 *
 * Lleva un contador además del reloj: dos pruebas pueden pedir uno en el mismo
 * milisegundo y un choque daria un 409 engañoso.
 */
let secuencia = 0;
function documentoUnico(): string {
  secuencia += 1;
  return `${String(Date.now()).slice(-7)}${secuencia}`;
}

async function crear(
  sesion: SesionDePrueba,
  datos: Record<string, unknown>,
): Promise<request.Response> {
  return conSesion(request(app).post('/api/personas'), sesion).send(datos);
}

describe('validación de la ficha de persona', () => {
  it('exige nombre y apellido a una persona física', () => {
    const resultado = esquemaPersona.safeParse({ tipo_persona: 'FISICA' });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const campos = resultado.error.issues.map((p) => p.path.join('.'));
      expect(campos).toContain('nombre');
      expect(campos).toContain('apellido');
    }
  });

  it('exige razón social a una persona jurídica, y no nombre', () => {
    const sinRazon = esquemaPersona.safeParse({ tipo_persona: 'JURIDICA' });
    expect(sinRazon.success).toBe(false);
    if (!sinRazon.success) {
      expect(sinRazon.error.issues.map((p) => p.path.join('.'))).toContain('razon_social');
    }

    const conRazon = esquemaPersona.safeParse({
      tipo_persona: 'JURIDICA',
      razon_social: 'Constructora del Centro S.A.',
    });
    expect(conRazon.success).toBe(true);
  });

  it('normaliza el CUIT a formato con guiones', () => {
    const resultado = esquemaPersona.safeParse({
      tipo_persona: 'JURIDICA',
      razon_social: 'Sin Guiones S.R.L.',
      cuit_cuil: '30712345674',
    });

    expect(resultado.success).toBe(true);
    // Se guarda siempre igual, sin importar cómo lo escriba quien carga.
    if (resultado.success) expect(resultado.data.cuit_cuil).toBe('30-71234567-4');
  });

  it('rechaza un CUIT que no tenga once dígitos', () => {
    const resultado = esquemaPersona.safeParse({
      tipo_persona: 'JURIDICA',
      razon_social: 'Corta S.A.',
      cuit_cuil: '30-712-4',
    });

    expect(resultado.success).toBe(false);
  });

  it('pide el tipo cuando hay número de documento', () => {
    // Sin tipo, la ficha mostraría "DOC 12345678", que no identifica nada.
    const resultado = esquemaPersona.safeParse({
      tipo_persona: 'FISICA',
      nombre: 'Ana',
      apellido: 'Pérez',
      numero_documento: '12345678',
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.map((p) => p.path.join('.'))).toContain('tipo_documento');
    }
  });

  it('convierte los campos vacíos del formulario en ausencia de dato', () => {
    const resultado = esquemaPersona.safeParse({
      tipo_persona: 'FISICA',
      nombre: 'Ana',
      apellido: 'Pérez',
      email: '',
      telefono: '',
      cuit_cuil: '',
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      // Importa que sea undefined y no '': la columna queda NULL y las
      // búsquedas por email no encuentran fichas con la cadena vacía.
      expect(resultado.data.email).toBeUndefined();
      expect(resultado.data.cuit_cuil).toBeUndefined();
    }
  });

  it('rechaza un correo mal formado', () => {
    const resultado = esquemaPersona.safeParse({
      tipo_persona: 'FISICA',
      nombre: 'Ana',
      apellido: 'Pérez',
      email: 'ana@',
    });

    expect(resultado.success).toBe(false);
  });
});

describe.skipIf(!hayBase)('POST /api/personas', () => {
  it('crea la persona y la relee de la base', async () => {
    const sesion = await iniciarSesion(app);
    const documento = documentoUnico();

    const creada = await crear(sesion, {
      tipo_persona: 'FISICA',
      nombre: 'Lucía',
      apellido: `${PREFIJO_PRUEBA}ALTA`,
      tipo_documento: 'DNI',
      numero_documento: documento,
      email: 'lucia@ejemplo.test',
      localidad: 'Córdoba',
    });

    expect(creada.status).toBe(201);
    const id = creada.body.persona.id as string;

    const releida = await conSesion(request(app).get(`/api/personas/${id}`), sesion);
    expect(releida.status).toBe(200);
    expect(releida.body.persona.apellido).toBe(`${PREFIJO_PRUEBA}ALTA`);
    expect(releida.body.persona.documento).toBe(`DNI ${documento}`);
    // Recién creada no interviene en ninguna causa.
    expect(releida.body.causas).toHaveLength(0);
  });

  it('aparece en el listado y la encuentra la búsqueda sin tildes', async () => {
    const sesion = await iniciarSesion(app);

    const creada = await crear(sesion, {
      tipo_persona: 'JURIDICA',
      razon_social: `${PREFIJO_PRUEBA}CONSTRUCCIÓN AUSTRAL S.A.`,
    });
    expect(creada.status).toBe(201);

    const buscada = await conSesion(
      request(app).get('/api/personas?busqueda=construccion+austral'),
      sesion,
    );

    expect(buscada.status).toBe(200);
    expect(buscada.body.datos.some((p: { id: string }) => p.id === creada.body.persona.id)).toBe(true);
  });

  it('no admite dos personas con el mismo documento', async () => {
    const sesion = await iniciarSesion(app);
    const documento = documentoUnico();
    const base = {
      tipo_persona: 'FISICA',
      nombre: 'Mario',
      apellido: `${PREFIJO_PRUEBA}REPETIDO`,
      tipo_documento: 'DNI',
      numero_documento: documento,
    };

    expect((await crear(sesion, base)).status).toBe(201);

    const repetida = await crear(sesion, { ...base, nombre: 'Otro' });
    expect(repetida.status).toBe(409);
    expect(repetida.body.detalles?.numero_documento).toBeDefined();
  });

  it('devuelve los errores por campo para que el formulario los muestre', async () => {
    const sesion = await iniciarSesion(app);
    const incompleta = await crear(sesion, { tipo_persona: 'FISICA', nombre: 'Sin apellido' });

    expect(incompleta.status).toBe(400);
    expect(incompleta.body.detalles?.apellido).toBeDefined();
  });

  it('exige sesión', async () => {
    const respuesta = await request(app).post('/api/personas').send({
      tipo_persona: 'FISICA',
      nombre: 'Anónima',
      apellido: 'Sin sesión',
    });

    expect(respuesta.status).toBe(401);
  });
});

describe.skipIf(!hayBase)('PUT /api/personas/:id', () => {
  it('guarda los cambios de la ficha', async () => {
    const sesion = await iniciarSesion(app);
    const creada = await crear(sesion, {
      tipo_persona: 'FISICA',
      nombre: 'Carla',
      apellido: `${PREFIJO_PRUEBA}EDICION`,
    });
    const id = creada.body.persona.id as string;

    const editada = await conSesion(request(app).put(`/api/personas/${id}`), sesion).send({
      tipo_persona: 'FISICA',
      nombre: 'Carla',
      apellido: `${PREFIJO_PRUEBA}EDICION`,
      telefono: '351 555 0000',
      domicilio: 'Av. Colón 100',
      localidad: 'Córdoba',
      provincia: 'Córdoba',
    });

    expect(editada.status).toBe(200);

    const releida = await conSesion(request(app).get(`/api/personas/${id}`), sesion);
    expect(releida.body.persona.telefono).toBe('351 555 0000');
    expect(releida.body.persona.domicilio).toBe('Av. Colón 100');
  });

  it('permite guardar sin cambiar el documento', async () => {
    const sesion = await iniciarSesion(app);
    const documento = documentoUnico();
    const ficha = {
      tipo_persona: 'FISICA',
      nombre: 'Jorge',
      apellido: `${PREFIJO_PRUEBA}MISMO DOC`,
      tipo_documento: 'DNI',
      numero_documento: documento,
    };

    const creada = await crear(sesion, ficha);
    const id = creada.body.persona.id as string;

    // El chequeo de duplicados tiene que excluir la propia ficha.
    const editada = await conSesion(request(app).put(`/api/personas/${id}`), sesion).send({
      ...ficha,
      telefono: '351 444 1111',
    });

    expect(editada.status).toBe(200);
  });

  it('responde 404 si la persona no existe', async () => {
    const sesion = await iniciarSesion(app);
    const editada = await conSesion(
      request(app).put('/api/personas/00000000-0000-0000-0000-000000000000'),
      sesion,
    ).send({ tipo_persona: 'FISICA', nombre: 'Nadie', apellido: 'Nadie' });

    expect(editada.status).toBe(404);
  });
});

describe.skipIf(!hayBase)('DELETE /api/personas/:id', () => {
  it('da de baja a quien no interviene en ninguna causa', async () => {
    const sesion = await iniciarSesion(app);
    const creada = await crear(sesion, {
      tipo_persona: 'FISICA',
      nombre: 'Elena',
      apellido: `${PREFIJO_PRUEBA}BAJA`,
    });
    const id = creada.body.persona.id as string;

    const baja = await conSesion(request(app).delete(`/api/personas/${id}`), sesion);
    expect(baja.status).toBe(200);

    const releida = await conSesion(request(app).get(`/api/personas/${id}`), sesion);
    expect(releida.status).toBe(404);
  });

  it('no da de baja a quien interviene en un expediente en trámite', async () => {
    const sesion = await iniciarSesion(app);
    const catalogos = await conSesion(request(app).get('/api/catalogos'), sesion);
    const estadoActivo = (
      catalogos.body.estados as { id: string; es_final: boolean }[]
    ).find((e) => !e.es_final)!;

    const causa = await conSesion(request(app).post('/api/causas'), sesion).send({
      caratula: `${PREFIJO_PRUEBA}CON PARTE VIVA`,
      fuero_id: catalogos.body.fueros[0].id,
      estado_causa_id: estadoActivo.id,
      fecha_inicio: '2026-02-01',
    });
    expect(causa.status).toBe(201);

    const creada = await crear(sesion, {
      tipo_persona: 'FISICA',
      nombre: 'Raúl',
      apellido: `${PREFIJO_PRUEBA}VINCULADO`,
    });
    const personaId = creada.body.persona.id as string;

    const vinculada = await conSesion(
      request(app).post(`/api/causas/${causa.body.causa.id}/partes`),
      sesion,
    ).send({ persona_id: personaId, caracter: 'DEMANDADO' });
    expect(vinculada.status).toBe(201);

    // Darla de baja la haría desaparecer del listado de partes del expediente,
    // que es justo donde hace falta saber a quién se demanda.
    const baja = await conSesion(request(app).delete(`/api/personas/${personaId}`), sesion);
    expect(baja.status).toBe(409);
    expect(baja.body.error).toMatch(/expediente/i);

    // Y sigue estando en la agenda.
    const releida = await conSesion(request(app).get(`/api/personas/${personaId}`), sesion);
    expect(releida.status).toBe(200);
  });

  it('un empleado no puede dar de baja a una persona', async () => {
    const admin = await iniciarSesion(app);
    const creada = await crear(admin, {
      tipo_persona: 'FISICA',
      nombre: 'Protegida',
      apellido: `${PREFIJO_PRUEBA}PERMISOS`,
    });

    const empleado = await iniciarSesion(app, USUARIOS_DEMO.empleado);
    expect(empleado.usuario.permisos).toContain('persona.crear');
    expect(empleado.usuario.permisos).not.toContain('persona.eliminar');

    const baja = await conSesion(
      request(app).delete(`/api/personas/${creada.body.persona.id}`),
      empleado,
    );
    expect(baja.status).toBe(403);
  });
});
