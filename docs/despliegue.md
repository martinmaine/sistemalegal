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
   │             └─▶ PostgreSQL   Neon   (migrations + seeds aplicados con psql)
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

El orden importa: Render necesita la cadena de Neon, y Vercel necesita la URL de
Render. El último paso vuelve sobre Render porque CORS necesita el dominio de
Vercel, que todavía no existe cuando se crea la API.

### 3.1 Neon — base de datos

1. Crear cuenta en [neon.tech](https://neon.tech) (conviene entrar con GitHub).
2. **New project**: nombre `sistemalegal`, región **São Paulo (sa-east-1)**, la más
   cercana a Córdoba. PostgreSQL 17 o superior.
3. Copiar la *connection string* del panel. Trae `?sslmode=require`: no quitarlo.
4. Aplicar el esquema y los seeds. Si no tenés `psql` instalado, el cliente sale
   de la imagen de Docker, sin instalar nada:

   ```bash
   export DATABASE_URL='postgresql://...@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require'

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

### 3.2 Render — API

1. Crear cuenta en [render.com](https://render.com) con GitHub.
2. **New > Blueprint**, elegir el repositorio. Render lee
   [`render.yaml`](../render.yaml) y propone el servicio `sistemalegal-api` con el
   *root directory*, el *build command* y el *health check* ya resueltos.
3. Cargar las dos variables que el blueprint marca como `sync: false`:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | la cadena de Neon, con `sslmode=require` |
   | `CORS_ORIGIN` | provisorio `http://localhost:5173`; se corrige en el paso 3.4 |

4. Esperar el despliegue y comprobar `https://sistemalegal-api.onrender.com/health`.
   Tiene que responder `"base": "conectada"`. Si dice `sin-conexion`, el problema
   está en `DATABASE_URL`, y el campo `detalleBase` lo aclara.

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
| `DATABASE_URL` | backend | Conexión a PostgreSQL. Con TLS en Neon. |
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
| `base: sin-conexion` tras días sin uso | Neon autosuspende el proyecto | Se despierta con la primera consulta; reintentar. |
| El build de Vercel no encuentra `package.json` | Falta *Root Directory* `frontend` | Paso 3.3.3. |
| Error de red solo desde el dominio de Vercel | `CORS_ORIGIN` sin el dominio de producción | Paso 3.4. |
| El esquema quedó a medias en Neon | Se corrió `psql` sin `ON_ERROR_STOP=1` | Borrar y recrear la base en Neon, y reaplicar. |

---

## 7. Para la defensa oral

La arquitectura previó dos caminos, y el segundo existe justamente como
respaldo:

1. **El despliegue**, accesible desde cualquier navegador. Conviene despertar la
   API unos minutos antes.
2. **`docker compose up`**, que no depende de la conectividad ni de que los
   servicios gratuitos estén despiertos.
