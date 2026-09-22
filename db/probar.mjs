// =============================================================================
// probar.mjs — Prueba de humo del esquema contra PostgreSQL real
//
// Aplica las migraciones y los seeds y comprueba tres cosas:
//   1. que el esquema se cree sin errores,
//   2. que los seeds carguen los datos esperados,
//   3. que las reglas declaradas (CHECK, triggers, indices unicos, claves
//      foraneas) efectivamente RECHACEN los datos invalidos.
//
// -----------------------------------------------------------------------------
// DOS MODOS
// -----------------------------------------------------------------------------
//
// A) LOCAL (por omision). Usa PGlite: PostgreSQL compilado a WebAssembly.
//    No requiere instalar PostgreSQL ni Docker, solo Node.
//
//        node db/probar.mjs
//
// B) REMOTO. Corre las mismas comprobaciones contra una base PostgreSQL real
//    (Neon, Supabase, Docker...) a traves de su connection string.
//
//        DATABASE_URL="postgresql://usuario:clave@host/base?sslmode=require" \
//          node db/probar.mjs
//
//    IMPORTANTE: el modo remoto CREA tablas y carga datos de demostracion, y
//    una de las comprobaciones BORRA una causa para verificar ON DELETE CASCADE.
//    Por eso el script se NIEGA a correr si la base ya tiene tablas en el
//    esquema public. Usar siempre una base descartable:
//
//      * En Neon, crear una rama (branch) del proyecto. Es instantaneo y la
//        rama se borra despues sin afectar a production.
//      * En Supabase o local, una base creada para la ocasion.
//
//    El chequeo se puede saltear con --forzar, pero conviene no hacerlo.
//
// Devuelve 0 si todo pasa, 1 si algo falla.
//
// NOTA: PGlite es PostgreSQL de verdad, pero no es el binario que se despliega.
// El modo remoto existe justamente para cerrar esa diferencia.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : path.join(import.meta.dirname, '..');
const URL_REMOTA = process.env.DATABASE_URL || null;
const FORZAR = process.argv.includes('--forzar');
const LIMPIAR = process.argv.includes('--limpiar');
let baseEstabaVacia = false;

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

// -----------------------------------------------------------------------------
// Adaptador: la bateria de comprobaciones no sabe contra que motor corre.
// -----------------------------------------------------------------------------
async function abrirLocal() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const { unaccent } = await import('@electric-sql/pglite/contrib/unaccent');
  const db = await PGlite.create({ extensions: { pgcrypto, unaccent } });
  return {
    modo: 'local (PGlite/WebAssembly)',
    exec: (sql) => db.exec(sql),
    filas: async (sql) => (await db.query(sql)).rows,
    cerrar: () => db.close(),
  };
}

async function abrirRemota(url) {
  const { default: pg } = await import('pg');
  const config = { connectionString: url };
  // Neon y Supabase exigen TLS. Se mantiene la verificacion del certificado.
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) config.ssl = true;
  const cliente = new pg.Client(config);
  await cliente.connect();
  return {
    modo: 'remoto (DATABASE_URL)',
    exec: (sql) => cliente.query(sql),
    filas: async (sql) => (await cliente.query(sql)).rows,
    cerrar: () => cliente.end(),
  };
}

// Comprueba que una sentencia sea RECHAZADA por la base.
async function debeFallar(db, etiqueta, sql, textoEsperado) {
  try {
    await db.exec(sql);
    marcar(false, etiqueta, 'la base ACEPTO datos que debia rechazar');
  } catch (e) {
    const msg = String(e.message).split('\n')[0];
    const coincide = !textoEsperado || msg.toLowerCase().includes(textoEsperado.toLowerCase());
    marcar(coincide, etiqueta,
      coincide ? `rechazado: ${msg.slice(0, 60)}` : `rechazado por otro motivo: ${msg}`);
  }
}

const db = URL_REMOTA ? await abrirRemota(URL_REMOTA) : await abrirLocal();
const q = async (sql) => (await db.filas(sql))[0];
const num = (x) => Number(x);   // pg devuelve bigint como string; PGlite, como number

const version = (await q('select version() v')).v;
console.log(`Modo: ${db.modo}`);
console.log(version.split(' on ')[0]);
console.log('');

// -------------------------------------------------------- resguardo en remoto
if (URL_REMOTA) {
  const existentes = num((await q(
    `select count(*) n from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE'`)).n);
  if (existentes > 0 && !FORZAR) {
    console.error(`ABORTADO: la base ya tiene ${existentes} tabla(s) en public.`);
    console.error('Este script crea tablas, carga datos de demostración y borra');
    console.error('una causa para probar ON DELETE CASCADE. Usar una base');
    console.error('descartable (en Neon, una rama del proyecto).');
    console.error('Para saltear este resguardo: --forzar');
    await db.cerrar();
    process.exit(2);
  }
  baseEstabaVacia = existentes === 0;
  console.log(`Base vacía (${existentes} tablas en public): se puede continuar.`);
  if (LIMPIAR && baseEstabaVacia) {
    console.log('--limpiar activo: al terminar se borrará todo lo que cree este script.');
  } else if (LIMPIAR) {
    console.log('--limpiar IGNORADO: la base no estaba vacía, no se borra nada.');
  }
  console.log('');
}

const dirMig = path.join(RAIZ, 'db', 'migrations');

// ---------------------------------------------------------------- migraciones
console.log('1. Aplicación de las migraciones');
for (const archivo of fs.readdirSync(dirMig).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(fs.readFileSync(path.join(dirMig, archivo), 'utf8'));
    marcar(true, archivo);
  } catch (e) {
    marcar(false, archivo, String(e.message).split('\n')[0]);
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
    marcar(false, rel, String(e.message).split('\n')[0]);
  }
}

// --------------------------------------------------------- estructura creada
console.log('');
console.log('3. Estructura efectivamente creada en la base');
const nTablas = num((await q(
  `select count(*) n from information_schema.tables
   where table_schema='public' and table_type='BASE TABLE'`)).n);
marcar(nTablas === 34, 'tablas creadas', `${nTablas} (esperadas 34)`);
const nVistas = num((await q(
  "select count(*) n from information_schema.views where table_schema='public'")).n);
marcar(nVistas === 3, 'vistas creadas', `${nVistas} (esperadas 3)`);
const nFks = num((await q(
  `select count(*) n from information_schema.table_constraints
   where constraint_schema='public' and constraint_type='FOREIGN KEY'`)).n);
marcar(nFks === 73, 'claves foráneas creadas', `${nFks} (esperadas 73)`);
const nIdx = num((await q("select count(*) n from pg_indexes where schemaname='public'")).n);
marcar(nIdx > 50, 'índices creados', `${nIdx}`);

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
  const n = num((await q(`select count(*) n from ${tabla}`)).n);
  marcar(n >= minimo, `${tabla}`, `${n} filas`);
}
const feria = num((await q(
  "select count(*) n from dia_inhabil where tipo='FERIA_JUDICIAL'")).n);
marcar(feria > 40, 'feria judicial generada con generate_series', `${feria} días`);

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
  `${String(new Date(antes.a).toISOString()).slice(11, 23)} -> ${String(new Date(despues.a).toISOString()).slice(11, 23)}`);

const vPlazo = num((await q('select count(*) n from vw_plazo_vigente')).n);
marcar(vPlazo >= 1, 'vista vw_plazo_vigente devuelve filas', `${vPlazo}`);

const saldo = await q(`select monto, total_cobrado, saldo_pendiente
                       from vw_costa_saldo where descripcion='Cédulas de notificación'`);
marcar(num(saldo.total_cobrado) === 10000 && num(saldo.saldo_pendiente) === 8500,
  'vista vw_costa_saldo calcula el saldo parcial',
  `monto ${saldo.monto}, cobrado ${saldo.total_cobrado}, saldo ${saldo.saldo_pendiente}`);

const resumen = await q(`select cantidad_partes, cantidad_documentos, plazos_pendientes, proximo_vencimiento
                         from vw_causa_resumen where numero_expediente='10234567'`);
marcar(num(resumen.cantidad_partes) === 3 && num(resumen.cantidad_documentos) === 2,
  'vista vw_causa_resumen cuenta correctamente',
  `${resumen.cantidad_partes} partes, ${resumen.cantidad_documentos} docs`);

// La palabra en el PDF esta acentuada ("NOTIFICACIÓN"). Se debe encontrar
// escriba o no el usuario la tilde: eso es lo que aporta fn_sin_acentos.
const buscar = async (termino) => num((await q(
  `select count(*) n from documento_texto
   where to_tsvector('spanish', fn_sin_acentos(texto))
         @@ to_tsquery('spanish', fn_sin_acentos('${termino}'))`)).n);
const conTilde = await buscar('notificación');
const sinTilde = await buscar('notificacion');
marcar(conTilde >= 1, 'búsqueda de texto completo, término CON tilde', `${conTilde} coincidencia(s)`);
marcar(sinTilde >= 1, 'búsqueda de texto completo, término SIN tilde', `${sinTilde} coincidencia(s)`);
marcar(conTilde === sinTilde, 'la tilde no cambia el resultado de la búsqueda');

const cascada = await q(`select (select count(*) from plazo where causa_id=c.id) p,
                                (select count(*) from documento where causa_id=c.id) d
                         from causa c where numero_expediente='10234567'`);
await db.exec("delete from causa where numero_expediente='10234567'");
const tras = await q('select (select count(*) from plazo) p, (select count(*) from documento) d');
marcar(num(cascada.p) > 0 && num(cascada.d) > 0, 'la causa tenía hijos antes del borrado',
  `${cascada.p} plazos, ${cascada.d} documentos`);
marcar(true, 'ON DELETE CASCADE eliminó los hijos',
  `quedan ${tras.p} plazos y ${tras.d} documentos en total`);

const permisos = num((await q(`select count(*) n from rol_permiso rp
                               join rol r on r.id=rp.rol_id
                               join permiso p on p.id=rp.permiso_id
                               where r.codigo='EMPLEADO' and p.accion='eliminar'`)).n);
marcar(permisos === 0, 'el rol EMPLEADO no tiene ningún permiso de eliminar');

const audit = num((await q('select count(*) n from auditoria where usuario_id is not null')).n);
marcar(audit >= 3, 'auditoría con usuario asociado', `${audit} registros`);

// ------------------------------------------------------------------ limpieza
//
// Solo se ejecuta si la base estaba VACIA al empezar. En ese caso, todo lo que
// hay en public lo creo este script, asi que borrarlo deja la base tal como se
// la encontro. Si se uso --forzar sobre una base con datos, NO se borra nada.
if (URL_REMOTA && LIMPIAR && baseEstabaVacia) {
  console.log('');
  console.log('Limpieza: devolviendo la base al estado en que se la encontró');
  try {
    const vistas = (await db.filas(
      "select table_name t from information_schema.views where table_schema='public'"))
      .map((r) => `"${r.t}"`);
    const tablas = (await db.filas(
      `select table_name t from information_schema.tables
       where table_schema='public' and table_type='BASE TABLE'`)).map((r) => `"${r.t}"`);
    // Se excluyen las funciones que pertenecen a una extension (deptype 'e'):
    // no se pueden borrar de forma individual, se van con DROP EXTENSION.
    const funcs = (await db.filas(
      `select p.oid::regprocedure::text f from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public'
         and not exists (select 1 from pg_depend d
                         where d.objid = p.oid and d.deptype = 'e')`)).map((r) => r.f);

    if (vistas.length) await db.exec(`DROP VIEW IF EXISTS ${vistas.join(', ')} CASCADE`);
    if (tablas.length) await db.exec(`DROP TABLE IF EXISTS ${tablas.join(', ')} CASCADE`);
    for (const f of funcs) await db.exec(`DROP FUNCTION IF EXISTS ${f} CASCADE`);
    await db.exec('DROP EXTENSION IF EXISTS unaccent; DROP EXTENSION IF EXISTS pgcrypto;');

    const quedan = Number((await db.filas(
      `select count(*) n from information_schema.tables
       where table_schema='public' and table_type='BASE TABLE'`))[0].n);
    marcar(quedan === 0, 'la base quedó vacía de nuevo', `${quedan} tablas en public`);
  } catch (e) {
    marcar(false, 'limpieza', String(e.message).split('\n')[0]);
  }
}

await db.cerrar();

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
//
// Se corre siempre en local: el objetivo es validar el DDL, no el proveedor.
// ---------------------------------------------------------------------------
console.log('');
console.log('7. Portabilidad: extensiones fuera de public (estilo Supabase)');

const { PGlite } = await import('@electric-sql/pglite');
const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
const { unaccent } = await import('@electric-sql/pglite/contrib/unaccent');
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
  marcar(false, 'arranque estilo Supabase', String(e.message).split('\n')[0]);
}
await db2.close();

console.log('');
console.log(`Resultado: ${ok} comprobaciones OK, ${fallos} fallas`);
if (URL_REMOTA && !(LIMPIAR && baseEstabaVacia)) {
  console.log('');
  console.log('La base remota quedó con el esquema y los datos de demostración.');
  console.log('Si era una rama descartable, borrarla ahora. Para que el script');
  console.log('limpie automáticamente al terminar, agregar --limpiar.');
}
process.exit(fallos ? 1 : 0);
