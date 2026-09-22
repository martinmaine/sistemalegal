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
└── generar-schema.py    # Regenera schema.sql
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

Los archivos SQL fueron validados contra la gramática de PostgreSQL con
[`pglast`](https://github.com/lelit/pglast) (libpg_query), comprobando además
que no haya claves foráneas rotas, dependencias fuera de orden ni índices sobre
columnas inexistentes.

```bash
pip install pglast
```

> El esquema **todavía no se ejecutó contra una instancia real de PostgreSQL**.
> Esa prueba queda pendiente para el Sprint S0, cuando esté el `docker-compose`.
