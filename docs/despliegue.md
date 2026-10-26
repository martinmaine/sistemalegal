# Despliegue

Cómo se levanta el sistema, en local y en producción. Las decisiones y su
justificación están en [`arquitectura.md`](arquitectura.md), sección 6; acá están
los pasos.

---

## 1. Panorama

```
Navegador
   │
   ├─▶ SPA            Vercel   (root directory: frontend/)
   │      │
   │      └─▶ API     Render   (root directory: backend/, blueprint: render.yaml)
   │             │
   │             └─▶ PostgreSQL   Supabase   (esquema y seeds aplicados con psql)
```

Tres servicios independientes, cada uno en la capa gratuita de su plataforma.
El frontend y el backend se redesplegan solos con cada push a `main`; la base se
migra a mano, de forma deliberada: una migración no debe correr por accidente.

---

## 2. Entorno local

Requisitos: Docker y Docker Compose. No hace falta instalar Node ni PostgreSQL.

```bash
cp .env.example .env
docker compose up
```

Levanta tres contenedores:

| Servicio | URL | Qué es |
|---|---|---|
| `frontend` | http://localhost:5173 | SPA con Vite en modo desarrollo |
| `backend` | http://localhost:4000 | API REST con recarga automática |
| `db` | `localhost:5432` | PostgreSQL 18 con el esquema y los datos ficticios ya aplicados |

La base se inicializa sola la primera vez:
[`database/docker/10-esquema-y-seeds.sh`](../database/docker/10-esquema-y-seeds.sh)
aplica `schema.sql` y los dos seeds. El backend espera a que el `healthcheck`
confirme que la tabla `causa` existe, así que no arranca contra una base a medio
inicializar.

Para empezar de cero: `docker compose down -v` (la `-v` borra el volumen y
fuerza a reaplicar el esquema).

### Comprobar que anda

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/causas
```

Y abrir http://localhost:5173, que tiene que listar las causas del seed.

---

## 3. Producción

El orden importa: Render necesita la cadena de Supabase, y Vercel necesita la URL de
Render. El último paso vuelve sobre Render porque CORS necesita el dominio de
Vercel, que todavía no existe cuando se crea la API.

### 3.1 Supabase — base de datos

> **Lo más importante de esta página.** Supabase muestra por defecto la
> *conexión directa* (`db.<ref>.supabase.co`), y esa **no sirve para Render**: es
> IPv6, y Render no tiene salida IPv6. Hay que usar el **pooler compartido**
> (Supavisor), que es IPv4 en todos los planes. Si la API en Render dice
> `sin-conexion` con las credenciales correctas, el problema es este.

Y no es una cadena sino dos, porque se usan en modos distintos:

| Para qué | Modo | Puerto |
|---|---|---|
| Aplicar el esquema con `psql` | sesión | `5432` |
| La API corriendo en Render | transacción | `6543` |

El modo transacción no acompaña bien al DDL de las migraciones; el modo sesión
sí, pero el recomendado para un servicio web es el de transacción. Por eso cada
tarea usa el suyo.

1. Crear cuenta en [supabase.com](https://supabase.com) (conviene entrar con GitHub).
2. **New project**: nombre `sistemalegal`, región **South America (São Paulo)**, la
   más cercana a Córdoba. Guardar la contraseña de la base: se muestra una sola vez.
3. Ir a **Connect** (arriba, junto al nombre del proyecto) y copiar las cadenas de
   **Session pooler** y **Transaction pooler**. El host se copia del panel tal cual
   (`aws-X-REGION.pooler.supabase.com`), no se arma a mano, y el usuario viene con
   la forma `postgres.<ref-del-proyecto>`.
4. Aplicar el esquema y los seeds **con la cadena de modo sesión**. Si no tenés
   `psql` instalado, el cliente sale de la imagen de Docker, sin instalar nada:

   ```bash
   # Modo sesion, puerto 5432: la de las migraciones.
   export DATABASE_URL='postgresql://postgres.abcdefgh:CLAVE@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require'

   docker run --rm -v "$(pwd)/database:/database:ro" postgres:18 \
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /database/schema.sql
   docker run --rm -v "$(pwd)/database:/database:ro" postgres:18 \
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /database/seed/001_catalogos.sql
   docker run --rm -v "$(pwd)/database:/database:ro" postgres:18 \
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /database/seed/002_datos_demo.sql
   ```

   > En Git Bash sobre Windows, si la ruta del volumen se traduce mal, prefijar el
   > comando con `MSYS_NO_PATHCONV=1`.

   El `-v ON_ERROR_STOP=1` no es opcional: sin él `psql` sigue después de un error
   y el esquema queda a medias pareciendo que funcionó.

5. Verificar: `docker run --rm postgres:18 psql "$DATABASE_URL" -c "select count(*) from causa"`.

> Las extensiones son el único punto donde Supabase difiere de un PostgreSQL
> común: las instala en el esquema `extensions` y no en `public`. El esquema ya
> lo contempla —`fn_sin_acentos()` declara su propio `search_path` nombrando los
> dos—, así que no hay nada que ajustar. El detalle está en
> [`database/README.md`](../database/README.md).

### 3.2 Render — API

1. Crear cuenta en [render.com](https://render.com) con GitHub.
2. **New > Blueprint**, elegir el repositorio. Render lee
   [`render.yaml`](../render.yaml) y propone el servicio `sistemalegal-api` con el
   *root directory*, el *build command* y el *health check* ya resueltos.
3. Cargar las dos variables que el blueprint marca como `sync: false`:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | la cadena del **pooler en modo transacción** (puerto `6543`), con `sslmode=require` |
   | `CORS_ORIGIN` | provisorio `http://localhost:5173`; se corrige en el paso 3.4 |

4. Esperar el despliegue y comprobar `https://sistemalegal-api.onrender.com/health`.
   Tiene que responder `"base": "conectada"`. Si dice `sin-conexion`, el campo
   `detalleBase` lo aclara. El error más probable es haber pegado la conexión
   directa en vez de la del pooler: ahí el detalle habla de red o de host
   inalcanzable, no de credenciales.

### 3.3 Vercel — SPA

1. Crear cuenta en [vercel.com](https://vercel.com) con GitHub.
2. **Add New > Project**, importar el repositorio.
3. **Root Directory: `frontend`.** Es el paso que más se olvida en un monorepo;
   sin eso el build falla porque no encuentra el `package.json`.
4. El framework lo detecta solo (Vite). Agregar la variable de entorno:

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://sistemalegal-api.onrender.com` (sin barra final) |

5. **Deploy**, y anotar el dominio que queda (`https://sistemalegal.vercel.app`).

### 3.4 Cerrar el círculo de CORS

Volver a Render y poner en `CORS_ORIGIN` el dominio de Vercel del paso anterior.
Render redespliega solo.

Los *previews* de Vercel cambian de dominio en cada push, así que no se pueden
poner en una lista fija: el backend los autoriza por prefijo del proyecto con
`CORS_PREFIJO_PREVIEW` (ver [`backend/src/config.ts`](../backend/src/config.ts)).
Se autoriza `sistemalegal*.vercel.app`, no cualquier `*.vercel.app`.

---

## 4. Variables de entorno

Ninguna vive en el repositorio. [`.env.example`](../.env.example) documenta todas
sin valores reales.

| Variable | Servicio | Para qué |
|---|---|---|
| `DATABASE_URL` | backend | Conexión a PostgreSQL. En producción, el pooler de Supabase en modo transacción, con TLS. |
| `PORT` | backend | Puerto de escucha. Render lo inyecta solo. |
| `CORS_ORIGIN` | backend | Dominios autorizados, separados por coma. |
| `CORS_PREFIJO_PREVIEW` | backend | Prefijo para autorizar los previews de Vercel. |
| `LIMITE_LISTADOS` | backend | Tope de filas por listado. |
| `VITE_API_URL` | frontend | URL de la API vista desde el navegador. |
| `JWT_SECRET` | backend | Reservada: entra con el módulo de autenticación. |
| `CLAUDE_API_KEY` | backend | Reservada: entra con el módulo de IA. Opcional. |

---

## 5. Verificación de punta a punta

```bash
curl https://sistemalegal-api.onrender.com/health      # estado ok, base conectada
curl https://sistemalegal-api.onrender.com/api/causas  # causas del seed
```

Y abrir el dominio de Vercel: la tabla de causas tiene que aparecer, con el
estado de la base en verde. Si la API responde pero la SPA muestra un error de
red, es CORS: revisar el paso 3.4.

---

## 6. Problemas conocidos de la capa gratuita

| Síntoma | Causa | Qué hacer |
|---|---|---|
| La primera visita tarda ~50 s | Render duerme el servicio tras ~15 min sin tráfico | La SPA avisa que la API está despertando. Antes de una demostración, abrir `/health` para despertarla. |
| `base: sin-conexion` tras una semana sin uso | Supabase **pausa** los proyectos gratuitos tras 7 días de inactividad | No se despierta solo: hay que reactivarlo a mano desde el panel. Antes de la defensa, entrar al proyecto con anticipación. |
| `base: sin-conexion` con credenciales correctas | Se usó la conexión directa, que es IPv6, y Render no tiene salida IPv6 | Usar la cadena del pooler compartido (paso 3.1). |
| El build de Vercel no encuentra `package.json` | Falta *Root Directory* `frontend` | Paso 3.3.3. |
| Error de red solo desde el dominio de Vercel | `CORS_ORIGIN` sin el dominio de producción | Paso 3.4. |
| El esquema quedó a medias | Se corrió `psql` sin `ON_ERROR_STOP=1` | Borrar y recrear el proyecto en Supabase, y reaplicar. |
| El DDL falla raro al migrar | Se usó el pooler en modo transacción para las migraciones | Usar la cadena de modo sesión, puerto `5432`. |

---

## 7. Para la defensa oral

La arquitectura previó dos caminos, y el segundo existe justamente como
respaldo:

1. **El despliegue**, accesible desde cualquier navegador. Conviene despertar la
   API unos minutos antes y, si pasó más de una semana, revisar que el proyecto de
   Supabase no esté pausado.
2. **`docker compose up`**, que no depende de la conectividad ni de que los
   servicios gratuitos estén despiertos.
