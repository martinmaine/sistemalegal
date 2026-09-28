# Base de datos

Esquema relacional PostgreSQL del Sistema de Gestión Integral para Estudios
Jurídicos. Corresponde a la **2.ª entrega — Diseño y módulos**.

El diseño, el diagrama entidad-relación y el diccionario de datos completo están
en [`../docs/esquema-base-de-datos.md`](../docs/esquema-base-de-datos.md).

---

## Contenido

```
database/
├── migrations/          Fuente de verdad del esquema, en orden de aplicación
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
│   ├── 001_catalogos.sql    Configuración base (necesaria para operar)
│   └── 002_datos_demo.sql   Datos FICTICIOS de demostración
└── schema.sql           Esquema consolidado: las 12 migraciones en un archivo
```

**Las migraciones son la fuente de verdad.** `schema.sql` es la concatenación de
todas, para poder leer o aplicar el esquema completo de una sola vez.

Resumen: **34 tablas · 3 vistas · 73 claves foráneas · 3 funciones.**

---

## Requisitos

- PostgreSQL **13 o superior** (se usa `gen_random_uuid()`).
- Extensiones `pgcrypto` y `unaccent`, incluidas en `postgresql-contrib`.
  Disponibles tanto en Neon como en Supabase.

---

## Crear la base

### Con PostgreSQL instalado

```bash
createdb sistemalegal
psql -d sistemalegal -f database/schema.sql
psql -d sistemalegal -f database/seed/001_catalogos.sql
psql -d sistemalegal -f database/seed/002_datos_demo.sql
```

### Con Docker, sin instalar PostgreSQL

```bash
docker run --name sistemalegal-db -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=sistemalegal -p 5432:5432 -d postgres:18
docker cp database sistemalegal-db:/database
docker exec sistemalegal-db psql -U postgres -d sistemalegal -v ON_ERROR_STOP=1 -f /database/schema.sql
docker exec sistemalegal-db psql -U postgres -d sistemalegal -v ON_ERROR_STOP=1 -f /database/seed/001_catalogos.sql
docker exec sistemalegal-db psql -U postgres -d sistemalegal -v ON_ERROR_STOP=1 -f /database/seed/002_datos_demo.sql
```

> **Esperá unos segundos entre el primer y el segundo comando.** Si aparece
> `the database system is shutting down`, esperá y reintentá: la imagen levanta
> un servidor temporal para inicializar y luego lo reinicia. Por ese motivo
> `pg_isready` puede responder "listo" antes de tiempo; la comprobación confiable
> es que `psql -c "select 1"` devuelva `1`.

Para entrar a mirar: `docker exec -it sistemalegal-db psql -U postgres -d sistemalegal`
(`\dt` lista las tablas, `\q` sale). Para borrar todo: `docker rm -f sistemalegal-db`.

El `-v ON_ERROR_STOP=1` es importante: sin él `psql` continúa después de un error
y parece que funcionó.

---

## Agregar un cambio al esquema

1. Crear `migrations/0NN_descripcion.sql` con el número siguiente.
2. Escribir solo sentencias hacia adelante (`ALTER TABLE`, `CREATE TABLE`...).
   Nunca editar una migración ya aplicada.
3. Agregar el mismo contenido al final de `schema.sql`.

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

El hash se genera con `crypt()` de `pgcrypto` (bcrypt) durante el `INSERT`: no hay
contraseñas en claro ni hashes fijos en el repositorio. El formato es compatible
con la librería `bcrypt` de Node.

---

## Advertencias

**Datos ficticios.** Todo el contenido de `seed/002_datos_demo.sql` es inventado.
Es la mitigación del riesgo R5 de la propuesta (Ley 25.326 de Protección de Datos
Personales): en desarrollo no se usan datos reales de personas ni de expedientes.
No ejecutar ese archivo en producción.

**Pendiente de verificación jurídica.** En `seed/001_catalogos.sql` los
`tipo_plazo` tienen `articulo_referencia` en `NULL` **a propósito**: no se
inventaron citas legales. El detalle está en
[`../docs/esquema-base-de-datos.md`](../docs/esquema-base-de-datos.md), sección 9.1.

---

## Portabilidad entre proveedores

El esquema corre igual en PostgreSQL local, Docker, Neon y Supabase. El detalle
que lo permite: Neon instala las extensiones en el esquema `public` y Supabase en
`extensions`, así que `fn_sin_acentos()` declara su propio `search_path`
nombrando ambos, en lugar de calificar uno a mano.
