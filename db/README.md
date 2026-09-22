# Base de datos

Esquema relacional PostgreSQL del Sistema de Gestión Integral para Estudios
Jurídicos. Corresponde a la **2.ª entrega — Diseño y módulos**.

El diseño, las decisiones de modelado y el diccionario de datos completo están
en [`../docs/entrega-2-diseno-y-modulos.md`](../docs/entrega-2-diseno-y-modulos.md).

---

## Contenido

```
db/
├── migrations/          # Fuente de verdad del esquema, en orden de aplicación
│   ├── 001_extensiones_y_funciones.sql
│   ├── 002_catalogos_juridicos.sql
│   ├── 003_tenencia_y_seguridad.sql
│   ├── 004_causas.sql
│   ├── 005_documentos.sql
│   ├── 006_plazos_y_calendario.sql
│   ├── 007_alertas_y_notificaciones.sql
│   ├── 008_costas.sql
│   ├── 009_operacion.sql
│   ├── 010_ia.sql
│   ├── 011_auditoria.sql
│   └── 012_vistas.sql
├── seed/
│   ├── 001_catalogos.sql    # Configuración base (necesaria para operar)
│   └── 002_datos_demo.sql   # Datos FICTICIOS de demostración
├── schema.sql           # Generado: concatenación de las migraciones
├── generar-schema.py    # Regenera schema.sql
├── verificar.py         # Verificación estructural, sin ejecutar
├── probar.mjs           # Prueba de humo contra PostgreSQL real (WebAssembly)
└── package.json         # Dependencia de la prueba de humo
```

**Las migraciones son la fuente de verdad.** `schema.sql` es un archivo derivado
que existe para leer o aplicar el esquema completo de una sola vez.

---

## Requisitos

- PostgreSQL **13 o superior** (se usa `gen_random_uuid()`).
- Extensiones `pgcrypto` y `unaccent`, incluidas en `postgresql-contrib`.

---

## Crear la base desde cero

```bash
createdb sistemalegal
psql -d sistemalegal -f db/schema.sql
psql -d sistemalegal -f db/seed/001_catalogos.sql
psql -d sistemalegal -f db/seed/002_datos_demo.sql
```

Aplicando las migraciones una por una en vez del esquema consolidado:

```bash
for f in db/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d sistemalegal -f "$f"; done
```

---

## Agregar un cambio al esquema

1. Crear `db/migrations/0NN_descripcion.sql` con el número siguiente.
2. Escribir solo sentencias hacia adelante (`ALTER TABLE`, `CREATE TABLE`...).
   Nunca editar una migración ya aplicada.
3. Regenerar el esquema consolidado:

```bash
python db/generar-schema.py
```

---

## Usuarios de demostración

Los crea `seed/002_datos_demo.sql`. La contraseña de todos es `Demo1234!`.

| Correo | Rol |
|---|---|
| `superadmin@sistemalegal.test` | Super Admin (sin estudio) |
| `admin@estudiodemo.test` | Admin |
| `jefe@estudiodemo.test` | Jefe de Estudio |
| `empleado1@estudiodemo.test` | Empleado |
| `empleado2@estudiodemo.test` | Empleado |

El hash se genera con `crypt()` de `pgcrypto` (bcrypt, coste 10) en el momento
del `INSERT`: no hay contraseñas en claro ni hashes fijos en el repositorio. El
formato es compatible con la librería `bcrypt` de Node.

---

## Advertencias

**Datos ficticios.** Todo el contenido de `seed/002_datos_demo.sql` es inventado.
Es la mitigación del riesgo R5 de la propuesta (Ley 25.326 de Protección de
Datos Personales): en desarrollo no se usan datos reales de personas ni de
expedientes. No ejecutar ese archivo en producción.

**Pendiente de verificación jurídica.** En `seed/001_catalogos.sql`:

- Los `tipo_plazo` tienen `articulo_referencia` en `NULL` a propósito. Las citas
  del CPCC de Córdoba (Ley 8465) deben tomarse del texto oficial y cargarse con
  `UPDATE`; no se inventaron. Los valores de `cantidad_dias` también requieren
  confirmación contra el código procesal.
- Los feriados trasladables se fijan por decreto cada año y las fechas de la
  feria judicial de julio las establece el TSJ por Acuerdo Reglamentario: hay que
  revisarlos contra el calendario oficial del año en curso.
- El listado de tribunales es un subconjunto para desarrollo, no el padrón
  completo del Poder Judicial de Córdoba.

---

## Verificación del esquema

Hay dos niveles de verificación, y no hace falta instalar PostgreSQL para ninguno.

### 1. Prueba de humo contra PostgreSQL real (recomendada)

`probar.mjs` aplica las migraciones y los seeds y comprueba que las reglas
declaradas **rechacen** los datos inválidos. Tiene dos modos.

**Modo local** (por omisión). Usa [PGlite](https://pglite.dev/): PostgreSQL
compilado a WebAssembly, que corre dentro de Node sin servidor ni Docker.

```bash
cd db && npm install && cd ..
node db/probar.mjs
```

**Modo remoto.** Las mismas comprobaciones contra una base real (Neon, Supabase,
Docker) a través de su connection string.

```bash
DATABASE_URL="postgresql://usuario:clave@host/base?sslmode=require"   node db/probar.mjs --limpiar
```

> ⚠️ El modo remoto **crea tablas, carga datos de demostración y borra una causa**
> para probar `ON DELETE CASCADE`. Por eso se **niega a correr si la base ya
> tiene tablas** en `public`. Usar siempre una base descartable: en Neon, una
> rama del proyecto. Con `--limpiar` deshace al terminar todo lo que creó y deja
> la base como estaba (solo si estaba vacía al empezar). El resguardo se puede
> saltear con `--forzar`, pero conviene no hacerlo.
>
> Nunca poner la contraseña en un archivo del repositorio: pasarla por variable
> de entorno, como en el ejemplo.

Ejecuta **67 comprobaciones** (68 en modo remoto, donde además verifica la
limpieza):

| Grupo | Qué comprueba |
|---|---|
| Migraciones | Que las 12 se apliquen en orden sin errores |
| Seeds | Que carguen los datos esperados en cada tabla |
| Estructura | Que existan 34 tablas, 3 vistas, 73 claves foráneas |
| Reglas | Que la base **rechace** persona física sin apellido, importes negativos, plazos cumplidos sin fecha, CUIT mal formado, emails repetidos, archivos duplicados, un Super Admin con estudio, borrar un fuero con causas... |
| Comportamiento | Hash bcrypt verificable, trigger de `actualizado_en`, las 3 vistas, búsqueda con y sin tildes, `ON DELETE CASCADE`, permisos del rol Empleado |
| Portabilidad | Que todo funcione con las extensiones en `public` (Neon) **y** en `extensions` (Supabase) |

### 2. Verificación estructural, sin ejecutar

`verificar.py` recorre el árbol sintáctico que produce el parser real del motor
(libpg_query) y comprueba sintaxis, claves foráneas, orden de dependencias,
índices y triggers.

```bash
pip install pglast
python db/verificar.py
```

Es más rápida y sirve como control previo, pero **no reemplaza a la prueba de
humo**: hay errores que solo aparecen al ejecutar. Un caso real de este proyecto
fue el índice de búsqueda con `unaccent`, que es sintácticamente válido y
estructuralmente correcto pero fallaba al crearse, porque PostgreSQL restringe
el `search_path` al construir un índice de expresión.

> El esquema **ya se ejecutó contra la instancia de Neon del proyecto**
> (PostgreSQL 18.6): las 68 comprobaciones pasaron y la base quedó en el mismo
> estado en que se la encontró. Queda pendiente repetirlo contra el
> `docker-compose` del entorno local, previsto para el Sprint S0.
