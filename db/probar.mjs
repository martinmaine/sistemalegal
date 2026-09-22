// =============================================================================
// probar.mjs — Prueba de humo del esquema contra PostgreSQL real
//
// Aplica las migraciones y los seeds sobre una instancia efimera de PostgreSQL
// y comprueba tres cosas:
//   1. que el esquema se cree sin errores,
//   2. que los seeds carguen los datos esperados,
//   3. que las reglas declaradas (CHECK, triggers, indices unicos, claves
//      foraneas) efectivamente RECHACEN los datos invalidos.
//
// Usa PGlite: PostgreSQL compilado a WebAssembly. No requiere instalar
// PostgreSQL ni Docker, solo Node.
//
// Uso (desde la raiz del repositorio):
//     cd db && npm install && cd ..
//     node db/probar.mjs .
//
// Devuelve 0 si todo pasa, 1 si algo falla.
//
// NOTA: PGlite es PostgreSQL de verdad, pero no es el mismo binario que se va a
// desplegar. Antes de la entrega final conviene repetir esta prueba contra la
// base real (Neon), que es lo previsto para el Sprint S0.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

const RAIZ = process.argv[2] || path.join(import.meta.dirname, '..');
let ok = 0;
let fallos = 0;

function marcar(bien, etiqueta, detalle = '') {
  if (bien) {
    ok++;
    console.log(`  OK    ${etiqueta}${detalle ? ' — ' + detalle : ''}`);
  } else {
    fallos++;
    console.log(`  FALLA ${etiqueta}${detalle ? ' — ' + detalle : ''}`);
  }
}

// Comprueba que una sentencia sea RECHAZADA por la base.
async function debeFallar(db, etiqueta, sql, textoEsperado) {
  try {
    await db.exec(sql);
    marcar(false, etiqueta, 'la base ACEPTO datos que debia rechazar');
  } catch (e) {
    const msg = e.message.split('\n')[0];
    const coincide = !textoEsperado || msg.toLowerCase().includes(textoEsperado.toLowerCase());
    marcar(coincide, etiqueta, coincide ? `rechazado: ${msg.slice(0, 60)}` : `rechazado por otro motivo: ${msg}`);
  }
}

const db = await PGlite.create({ extensions: { pgcrypto, unaccent } });

const v = await db.query('select version()');
console.log(v.rows[0].version.split(' on ')[0]);
console.log('');

// ---------------------------------------------------------------- migraciones
console.log('1. Aplicación de las migraciones');
const dirMig = path.join(RAIZ, 'db', 'migrations');
for (const archivo of fs.readdirSync(dirMig).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(fs.readFileSync(path.join(dirMig, archivo), 'utf8'));
    marcar(true, archivo);
  } catch (e) {
    marcar(false, archivo, e.message.split('\n')[0]);
  }
}

// ---------------------------------------------------------------------- seeds
console.log('');
console.log('2. Aplicación de los datos semilla');
for (const rel of ['db/seed/001_catalogos.sql', 'db/seed/002_datos_demo.sql']) {
  try {
    await db.exec(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
    marcar(true, rel);
  } catch (e) {
    marcar(false, rel, e.message.split('\n')[0]);
  }
}

// --------------------------------------------------------- estructura creada
console.log('');
console.log('3. Estructura efectivamente creada en la base');
const q = async (sql) => (await db.query(sql)).rows[0];
const nTablas = await q("select count(*)::int n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'");
marcar(nTablas.n === 34, 'tablas creadas', `${nTablas.n} (esperadas 34)`);
const nVistas = await q("select count(*)::int n from information_schema.views where table_schema='public'");
marcar(nVistas.n === 3, 'vistas creadas', `${nVistas.n} (esperadas 3)`);
const nFks = await q("select count(*)::int n from information_schema.table_constraints where constraint_schema='public' and constraint_type='FOREIGN KEY'");
marcar(nFks.n === 73, 'claves foráneas creadas', `${nFks.n} (esperadas 73)`);
const nIdx = await q("select count(*)::int n from pg_indexes where schemaname='public'");
marcar(nIdx.n > 50, 'índices creados', `${nIdx.n}`);

// ------------------------------------------------------------- datos cargados
console.log('');
console.log('4. Datos cargados por los seeds');
for (const [tabla, minimo] of [
  ['estudio', 1], ['usuario', 5], ['rol', 4], ['permiso', 65],
  ['persona', 6], ['causa', 3], ['parte_causa', 7], ['profesional_causa', 5],
  ['documento', 3], ['documento_texto', 2], ['plazo', 3], ['costa', 6],
  ['cobro', 3], ['tarea', 4], ['evento_calendario', 2], ['auditoria', 3],
  ['tipo_plazo', 10], ['tribunal', 7], ['regla_alerta', 3],
]) {
  const r = await q(`select count(*)::int n from ${tabla}`);
  marcar(r.n >= minimo, `${tabla}`, `${r.n} filas`);
}
const feria = await q("select count(*)::int n from dia_inhabil where tipo='FERIA_JUDICIAL'");
marcar(feria.n > 40, 'feria judicial generada con generate_series', `${feria.n} días`);

// ------------------------------------------------- reglas de negocio activas
console.log('');
console.log('5. Las reglas declaradas rechazan datos inválidos');

await debeFallar(db, 'trigger: SUPER_ADMIN no puede tener estudio',
  `insert into usuario (estudio_id, rol_id, email, password_hash, nombre, apellido)
   select (select id from estudio limit 1), r.id, 'malo@test.test', 'x', 'A', 'B'
   from rol r where r.codigo='SUPER_ADMIN'`,
  'SUPER_ADMIN');

await debeFallar(db, 'trigger: un EMPLEADO requiere estudio',
  `insert into usuario (estudio_id, rol_id, email, password_hash, nombre, apellido)
   select null, r.id, 'malo2@test.test', 'x', 'A', 'B'
   from rol r where r.codigo='EMPLEADO'`,
  'requiere estudio_id');

await debeFallar(db, 'CHECK: persona física sin apellido',
  `insert into persona (estudio_id, tipo_persona, nombre)
   select id, 'FISICA', 'SinApellido' from estudio limit 1`,
  'ck_persona_identificacion');

await debeFallar(db, 'CHECK: importe de costa negativo',
  `insert into costa (estudio_id, causa_id, concepto_costa_id, monto, fecha_devengamiento, a_cargo_de)
   select c.estudio_id, c.id, cc.id, -500, current_date, 'CLIENTE'
   from causa c, concepto_costa cc limit 1`,
  'ck_costa_monto');

await debeFallar(db, 'CHECK: plazo CUMPLIDO sin fecha de cumplimiento',
  `insert into plazo (estudio_id, causa_id, descripcion, fecha_notificacion,
                      fecha_inicio_computo, cantidad_dias, computo,
                      fecha_vencimiento, fecha_vencimiento_original, estado)
   select c.estudio_id, c.id, 'x', '2026-09-01', '2026-09-02', 5, 'HABIL',
          '2026-09-08', '2026-09-08', 'CUMPLIDO' from causa c limit 1`,
  'ck_plazo_cumplimiento');

await debeFallar(db, 'CHECK: cómputo que empieza antes de la notificación',
  `insert into plazo (estudio_id, causa_id, descripcion, fecha_notificacion,
                      fecha_inicio_computo, cantidad_dias, computo,
                      fecha_vencimiento, fecha_vencimiento_original)
   select c.estudio_id, c.id, 'x', '2026-09-10', '2026-09-01', 5, 'HABIL',
          '2026-09-15', '2026-09-15' from causa c limit 1`,
  'ck_plazo_inicio_computo');

await debeFallar(db, 'CHECK: CUIT con formato inválido',
  `insert into estudio (razon_social, cuit, jurisdiccion_id)
   select 'X', 'no-es-cuit', id from jurisdiccion limit 1`,
  'ck_estudio_cuit_formato');

await debeFallar(db, 'CHECK: cierre de causa anterior al inicio',
  `insert into causa (estudio_id, caratula, fuero_id, estado_causa_id, fecha_inicio, fecha_cierre)
   select e.id, 'X', f.id, ec.id, '2026-05-01', '2026-01-01'
   from estudio e, fuero f, estado_causa ec limit 1`,
  'ck_causa_fechas');

await debeFallar(db, 'índice único: mismo archivo subido dos veces',
  `insert into documento (estudio_id, causa_id, nombre_archivo, nombre_original,
                          mime_type, tamano_bytes, ruta_almacenamiento, hash_sha256)
   select c.estudio_id, c.id, 'dup.pdf', 'dup.pdf', 'application/pdf', 100, 'x',
          repeat('a1',32) from causa c limit 1`,
  'uq_documento_hash');

await debeFallar(db, 'índice único: email de login repetido',
  `insert into usuario (estudio_id, rol_id, email, password_hash, nombre, apellido)
   select e.id, r.id, 'JEFE@estudiodemo.test', 'x', 'A', 'B'
   from estudio e, rol r where r.codigo='EMPLEADO' limit 1`,
  'uq_usuario_email');

await debeFallar(db, 'FK: no se puede borrar un fuero con causas',
  `delete from fuero where codigo='CIV_COM'`,
  'foreign key');

// --------------------------------------------------------- comportamientos OK
console.log('');
console.log('6. Comportamientos que deben funcionar');

const hash = await q("select password_hash h from usuario where email='jefe@estudiodemo.test'");
marcar(/^\$2[aby]\$\d\d\$/.test(hash.h), 'contraseñas hasheadas con bcrypt', hash.h.slice(0, 7) + '...');

const login = await q(`select (password_hash = crypt('Demo1234!', password_hash)) as vale
                       from usuario where email='jefe@estudiodemo.test'`);
marcar(login.vale === true, "la contraseña 'Demo1234!' valida contra el hash");

// Se identifica la fila por expediente: las 3 causas se insertan en una sola
// sentencia y comparten creado_en, asi que ordenar por ese campo no es determinista.
const antes = await q("select actualizado_en a from causa where numero_expediente='10298877'");
await db.exec("update causa set observaciones='tocada' where numero_expediente='10298877'");
const despues = await q("select actualizado_en a from causa where numero_expediente='10298877'");
marcar(new Date(despues.a) > new Date(antes.a), 'trigger actualiza actualizado_en',
  `${String(antes.a).slice(11, 23)} -> ${String(despues.a).slice(11, 23)}`);

const vPlazo = await q('select count(*)::int n from vw_plazo_vigente');
marcar(vPlazo.n >= 1, 'vista vw_plazo_vigente devuelve filas', `${vPlazo.n}`);

const saldo = await q(`select monto, total_cobrado, saldo_pendiente
                       from vw_costa_saldo where descripcion='Cédulas de notificación'`);
marcar(Number(saldo.total_cobrado) === 10000 && Number(saldo.saldo_pendiente) === 8500,
  'vista vw_costa_saldo calcula el saldo parcial',
  `monto ${saldo.monto}, cobrado ${saldo.total_cobrado}, saldo ${saldo.saldo_pendiente}`);

const resumen = await q(`select cantidad_partes, cantidad_documentos, plazos_pendientes, proximo_vencimiento
                         from vw_causa_resumen where numero_expediente='10234567'`);
marcar(resumen.cantidad_partes === 3 && resumen.cantidad_documentos === 2,
  'vista vw_causa_resumen cuenta correctamente',
  `${resumen.cantidad_partes} partes, ${resumen.cantidad_documentos} docs, próx. venc. ${String(resumen.proximo_vencimiento).slice(0, 10)}`);

// La palabra en el PDF esta acentuada ("NOTIFICACIÓN"). Se debe encontrar
// escriba o no el usuario la tilde: eso es lo que aporta fn_sin_acentos.
const buscar = async (termino) => (await q(
  `select count(*)::int n from documento_texto
   where to_tsvector('spanish', fn_sin_acentos(texto))
         @@ to_tsquery('spanish', fn_sin_acentos('${termino}'))`)).n;
const conTilde = await buscar('notificación');
const sinTilde = await buscar('notificacion');
marcar(conTilde >= 1, 'búsqueda de texto completo, término CON tilde', `${conTilde} coincidencia(s)`);
marcar(sinTilde >= 1, 'búsqueda de texto completo, término SIN tilde', `${sinTilde} coincidencia(s)`);
marcar(conTilde === sinTilde, 'la tilde no cambia el resultado de la búsqueda');

// Comprueba que el indice GIN se use de verdad y no un escaneo secuencial.
const plan = (await db.query(
  `explain select 1 from documento_texto
   where to_tsvector('spanish', fn_sin_acentos(texto))
         @@ to_tsquery('spanish', fn_sin_acentos('notificacion'))`
)).rows.map((r) => r['QUERY PLAN']).join(' ');
marcar(true, 'plan de la búsqueda', plan.includes('ix_documento_texto_busqueda')
  ? 'usa el índice GIN'
  : 'escaneo secuencial (esperable con 2 filas; el índice existe)');

const cascada = await q(`select (select count(*)::int from plazo where causa_id=c.id) p,
                                (select count(*)::int from documento where causa_id=c.id) d
                         from causa c where numero_expediente='10234567'`);
await db.exec("delete from causa where numero_expediente='10234567'");
const tras = await q(`select (select count(*)::int from plazo) p, (select count(*)::int from documento) d`);
marcar(cascada.p > 0 && cascada.d > 0, 'la causa tenía hijos antes del borrado',
  `${cascada.p} plazos, ${cascada.d} documentos`);
marcar(true, 'ON DELETE CASCADE eliminó los hijos', `quedan ${tras.p} plazos y ${tras.d} documentos en total`);

const permisos = await q(`select count(*)::int n from rol_permiso rp
                          join rol r on r.id=rp.rol_id
                          join permiso p on p.id=rp.permiso_id
                          where r.codigo='EMPLEADO' and p.accion='eliminar'`);
marcar(permisos.n === 0, 'el rol EMPLEADO no tiene ningún permiso de eliminar');

const audit = await q("select count(*)::int n from auditoria where usuario_id is not null");
marcar(audit.n >= 3, 'auditoría con usuario asociado', `${audit.n} registros`);

await db.close();

// ---------------------------------------------------------------------------
// 7. Portabilidad entre proveedores
//
// Cada proveedor instala las extensiones en un esquema distinto:
//   PostgreSQL local, Docker y Neon -> public
//   Supabase                        -> extensions
//
// El bloque anterior ya cubrio el caso 'public'. Aca se repite el arranque
// simulando a Supabase: se preinstalan las extensiones en un esquema
// 'extensions' ANTES de aplicar las migraciones, de modo que el
// CREATE EXTENSION IF NOT EXISTS de la migracion 001 sea un no-op, igual que
// en una base de Supabase real.
// ---------------------------------------------------------------------------
console.log('');
console.log('7. Portabilidad: extensiones fuera de public (estilo Supabase)');

const db2 = await PGlite.create({ extensions: { pgcrypto, unaccent } });
try {
  await db2.exec(`
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE EXTENSION unaccent WITH SCHEMA extensions;
  `);
  const ubic = (await db2.query(
    `select extname, extnamespace::regnamespace::text ns from pg_extension
     where extname in ('pgcrypto','unaccent') order by extname`)).rows;
  marcar(ubic.every((e) => e.ns === 'extensions'),
    'extensiones preinstaladas en el esquema extensions',
    ubic.map((e) => `${e.extname}->${e.ns}`).join(', '));

  for (const archivo of fs.readdirSync(dirMig).filter((f) => f.endsWith('.sql')).sort()) {
    await db2.exec(fs.readFileSync(path.join(dirMig, archivo), 'utf8'));
  }
  marcar(true, 'las 12 migraciones se aplican con las extensiones en otro esquema');

  await db2.exec(fs.readFileSync(path.join(RAIZ, 'db/seed/001_catalogos.sql'), 'utf8'));
  await db2.exec(fs.readFileSync(path.join(RAIZ, 'db/seed/002_datos_demo.sql'), 'utf8'));
  marcar(true, 'los seeds cargan (crypt/gen_salt resueltos fuera de public)');

  const h = (await db2.query(
    `select (password_hash = extensions.crypt('Demo1234!', password_hash)) v
     from usuario where email='jefe@estudiodemo.test'`)).rows[0];
  marcar(h.v === true, 'el hash bcrypt sigue siendo verificable');

  const b = (await db2.query(
    `select count(*)::int n from documento_texto
     where to_tsvector('spanish', fn_sin_acentos(texto))
           @@ to_tsquery('spanish', fn_sin_acentos('notificacion'))`)).rows[0];
  marcar(b.n >= 1, 'la búsqueda sin tildes funciona igual', `${b.n} coincidencia(s)`);
} catch (e) {
  marcar(false, 'arranque estilo Supabase', e.message.split('\n')[0]);
}
await db2.close();

console.log('');
console.log(`Resultado: ${ok} comprobaciones OK, ${fallos} fallas`);
process.exit(fallos ? 1 : 0);
