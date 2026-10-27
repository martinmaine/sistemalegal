# Traspaso y pendientes

Estado del trabajo en la rama `producto/fase-1-fundaciones`, escrito para quien
lo retome. Lo que se hizo está en los informes de cada fase; este documento es
sobre **lo que falta y por dónde seguir**.

- [Fase 0 — auditoría](auditoria-fase-0.md)
- [Fase 1 — fundaciones](fase-1-fundaciones.md)
- [Fase 2 — experiencia central](fase-2-experiencia-central.md)
- [Fase 3 — cómputo de plazos](fase-3-computo-de-plazos.md)

---

## 1. Para levantarlo en tu máquina

```bash
git fetch origin
git switch producto/fase-1-fundaciones
cp .env.example .env
docker compose up
```

Frontend en http://localhost:5173, API en http://localhost:4000. La base se crea
con el esquema y los datos ficticios.

**Usuarios de demostración** (todos con la contraseña `Demo1234!`, definidos en
`database/seed/002_datos_demo.sql`):

| Correo | Rol |
|---|---|
| `admin@estudiodemo.test` | Administrador: todo |
| `jefe@estudiodemo.test` | Jefe de Estudio: todo salvo usuarios y configuración |
| `empleado1@estudiodemo.test` | Empleado: opera, pero no elimina |

Para correr sin Docker: `npm run dev` en `backend/` y en `frontend/`. Si el
puerto 5432 está ocupado, `PUERTO_DB=5433` en el `.env`.

**Tres cosas que parecen fallas y no lo son:**

1. **`npm test` cierra la sesión que tengas abierta en el navegador.** Una prueba
   verifica que reutilizar un refresh token ya consumido revoca todas las
   sesiones de la cuenta, y la hace sobre el usuario `admin` demo. Es el
   comportamiento buscado; solo hay que volver a iniciar sesión.
2. **Si el login falla con «No se pudo contactar con el servidor»**, mirá la
   consola del navegador: casi seguro es CORS. `CORS_ORIGIN` en el `.env` tiene
   que incluir el origen exacto desde el que abrís el frontend (puerto incluido).
3. **Las pruebas de integración necesitan la base.** Sin `DATABASE_URL` se
   saltean en silencio y quedan solo las unitarias. Con el Docker levantado
   corren las 145.

---

## 2. Dónde está el trabajo

La rama tiene varios commits sobre `main` y no está mergeada. **Nada se desplegó**: ni Render, ni Vercel,
ni Supabase. Todo se verificó contra la base local.

| Capa | Qué hay |
|---|---|
| Backend | Autenticación, permisos, panel, catálogos, expedientes, personas, partes, equipo, plazos, movimientos |
| Motor | `backend/src/modulos/plazos/computo.ts`: cálculo de vencimientos como función pura |
| Frontend | Sistema de diseño en `src/estilos/`, 12 componentes en `src/componentes/ui/`, 8 pantallas |
| Pruebas | 145 en el backend (10 archivos). **Ninguna en el frontend.** |

Módulos de la barra lateral que **siguen apagados** («En desarrollo»): Documentos,
Tareas, Honorarios y costas, Informes, Configuración.

---

## 3. Lo que bloquea y no es código

Esto necesita una decisión o un dato de una persona. Programar alrededor no lo
resuelve, y conviene definirlo primero porque condiciona el resto.

### 3.1 Validación jurídica de los plazos

El motor calcula, pero las reglas que usa son **datos sin validar**:

- `tipo_plazo.articulo_referencia` está **vacío en los 10 tipos** del seed. El
  sistema no puede decir en qué norma se funda cada plazo.
- Los días y el tipo de cómputo (hábil/corrido) de esos 10 tipos son los del seed
  original y **nadie con criterio jurídico los verificó**.
- No está definido el criterio de cómputo según el tipo de notificación (la regla
  implementada es «arranca el día hábil siguiente»; el motor admite fijar otro
  inicio a mano, pero no sabe cuándo corresponde).
- No está definido el alcance exacto de la feria judicial.

Hasta que lo valide alguien del estudio o un abogado, **el producto no debe
presentarse como fuente confiable de vencimientos**. La interfaz ya lo dice
(«es una ayuda, no un dictamen»), y el README también.

### 3.2 Calendario de días inhábiles

`dia_inhabil` trae solo **2026**: 12 feriados nacionales y 44 días de feria. No hay
feriados provinciales ni asuetos. Para usarlo de verdad hay que cargar cada año, y
**hoy eso se hace por SQL** (no existe la pantalla). Un calendario incompleto da
vencimientos incorrectos sin avisar.

### 3.3 Despliegue y cookie de sesión

La sesión usa un refresh token en cookie `httpOnly`. En producción el frontend
(Vercel) y la API (Render) son **sitios distintos**, así que la cookie viaja con
`SameSite=None`, y los navegadores que bloquean cookies de terceros (Safari por
defecto, Chrome en incógnito) **la descartan**: el usuario quedaría fuera al
recargar.

Hay que resolverlo antes de mostrar el sistema desplegado. Dos caminos:

- **Proxy en Vercel** (el más simple): reescribir `/api/*` hacia Render en
  `vercel.json` y que el navegador le hable siempre a su propio dominio. La cookie
  pasa a ser de primera parte. Hay que apuntar `VITE_API_URL` al mismo origen.
- **Dominio propio** con subdominios (`app.` y `api.`) y cookie con `Domain`.

No se tocó nada de esto. `vercel.json` hoy solo tiene el rewrite de la SPA.

### 3.4 Antes de desplegar esta rama

- **`JWT_SECRET` es obligatoria en producción.** El backend se niega a arrancar
  si falta o tiene menos de 32 caracteres (a propósito: la alternativa es firmar
  sesiones con un secreto efímero que cambia en cada reinicio). Ya está declarada
  en `render.yaml` y documentada en `despliegue.md`, pero **el valor hay que
  cargarlo a mano** en el panel de Render. Generarlo con:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- **Los usuarios demo no pueden existir en una instalación real.** Las credenciales
  `Demo1234!` están en el seed de datos ficticios. Para una base de producción
  se carga solo `001_catalogos.sql`, nunca `002_datos_demo.sql`, y falta definir
  cómo se crea el primer administrador (hoy no hay pantalla de usuarios).

### 3.5 Propiedad y licencia

El repositorio es `martinmaine/sistemalegal` y el proyecto es un TFI con dos
integrantes. No se modificó la licencia («uso educativo») ni los derechos. Si el
producto se va a comercializar a estudios jurídicos, la titularidad y la licencia
son una decisión de ustedes, no técnica.

---

## 4. Lo que falta construir

Ordenado por lo que yo haría primero. Cada punto dice dónde engancharse.

### 4.1 Tareas — chico, el patrón ya está

Hoy se **leen** (pestaña del expediente, panel de inicio) pero no se crean, editan
ni completan. La tabla `tarea` está lista (`causa_id`, `plazo_id`, `asignada_a`,
prioridad, estado, vencimiento). Copiar el patrón de `plazos`: esquema Zod →
repositorio → servicio → controlador → rutas, con `requierePermiso('tarea.*')`
(los permisos ya existen en la base), y un diálogo en el frontend siguiendo
`DialogoMovimiento.tsx`. Después, habilitar «Tareas» en `navegacion.ts`.

### 4.2 Documentos y microservicio de PDF — grande

Tablas `documento` y `documento_texto`. La carga de archivos y el microservicio
Python/FastAPI con `pdfplumber` **no existen**; el README los menciona como parte
del stack. Hay que decidir dónde se guardan los archivos (Supabase Storage es lo
natural dado el stack), límites de tamaño y tipos, y validar el contenido real del
archivo y no solo la extensión.

### 4.3 Alertas y notificaciones — mediano

Tablas `regla_alerta`, `alerta`, `notificacion`: sin código. Las alertas
multinivel sobre vencimientos (crítica / importante / informativa) son parte del
alcance del MVP. Para que sirvan hace falta algo que corra periódicamente; en
Render gratis el servicio se duerme, así que hay que decidir el mecanismo (un
cron externo, o evaluar las alertas al consultar, como hace hoy la agenda).

### 4.4 Calendario de días inhábiles — chico, y urgente por 3.2

Pantalla para cargar y editar `dia_inhabil` por año. Hoy solo se puede por SQL.
Para facilitar la carga conviene poder dar de alta un rango (la feria) de una vez.

### 4.5 Costas y honorarios

Tablas `costa` y `cobro`. Hoy solo se lee `vw_costa_saldo` para el indicador
«Saldo por cobrar» del inicio; no hay ninguna pantalla ni API de escritura. El
README lo incluye en el alcance, con reporte exportable.

### 4.6 Usuarios, roles, configuración y auditoría consultable

- **Usuarios**: alta, baja, cambio de rol y de contraseña. No hay forma de crear un
  usuario ni de cambiar una contraseña desde la aplicación.
- **Configuración del estudio** y **personalización visual**: los tokens CSS están
  preparados para recibir el color de marca (`--marca-*` en `tokens.css`), pero no
  hay dónde editarlo ni de dónde leerlo.
- **Auditoría**: se escribe en cada operación de escritura (con el antes y el
  después, sin contraseñas ni tokens), pero **no hay pantalla para consultarla**.

### 4.7 Plantillas de escritos, informes, calendario de eventos

- `plantilla_escrito`: sin código.
- Informes: sin código.
- `evento_calendario` (audiencias, reuniones): el panel de inicio los **lee**, pero
  no se pueden crear. La agenda actual muestra solo plazos.

### 4.8 Prórrogas

`tipo_plazo.prorrogable` existe y «Ofrecer prueba» está marcado como prorrogable,
pero el motor no hace nada con eso. Hoy una prórroga se registra editando los días
del plazo, lo que queda en la auditoría pero **no distingue una prórroga de una
corrección**.

### 4.9 Fase 6 del plan original

IA (`consulta_ia`), búsqueda de jurisprudencia, predicción: fuera del MVP según el
README y sin ningún código.

---

## 5. Deuda técnica y limitaciones conocidas

| Qué | Detalle |
|---|---|
| **Sin pruebas de frontend** | Ni un test. Lo único que verifica el frontend es `tsc` y el build. Las pantallas se probaron a mano en el navegador. |
| **Sin `npm run lint`** | El frontend no tiene script de lint. |
| **Sin control de concurrencia** | Si dos personas editan el mismo expediente, gana la última. `actualizado_en` ya existe y alcanza para un control optimista. |
| **El CI no corre al subir una rama** | `ci.yml` se dispara en `pull_request` y en push a `main`. **Hay que abrir un PR para que corra**, y es la única verificación sobre una base limpia: lo de este informe se probó solo en local. |
| **Rate limit solo en login** | El resto de la API no está limitada. |
| **Los permisos viajan en el token de acceso** | Un cambio de rol tarda hasta 15 minutos en aplicarse. Es una decisión consciente (evita una consulta por petición). |
| **Movimientos** | Se crean y se borran, pero no se editan; la importación del Poder Judicial no existe (no hay API pública). |
| **Búsqueda global (Ctrl+K)** | Busca expedientes y personas; no plazos. |
| **Accesibilidad** | Se construyó con foco visible, etiquetas y estados que no dependen del color, pero **no se auditó** con una herramienta ni con lector de pantalla. |
| **Un solo bundle** | 458 kB sin code-splitting. No es un problema hoy. |
| **Fin de línea** | Git avisa `CRLF will be replaced by LF` en cada commit. Conviene un `.gitattributes`. |

---

## 6. Documentación que quedó desactualizada

`README.md`, `docs/arquitectura.md` y `docs/propuesta-proyecto.md` dicen que la
autenticación es **«JWT + Passport.js»**. **No se usó Passport.** Se implementó con
`jsonwebtoken` + `bcryptjs`, access token de 15 minutos en memoria y refresh token
opaco en cookie `httpOnly` con rotación y detección de reutilización (el porqué
está en el informe de la Fase 1). No se editaron esos documentos porque son parte de
las entregas académicas ya presentadas: es decisión de ustedes si se corrigen o se
aclara en el informe final.

---

## 7. Cómo está organizado el código, para seguir en el mismo estilo

**Backend** (`backend/src/modulos/<modulo>/`): rutas → controlador → servicio →
repositorio. El SQL vive solo en el repositorio. Todos los valores del cliente viajan
como parámetros; lo único que se interpola es el nombre de columna del `ORDER BY`,
y solo después de resolverlo contra un `Record` fijo y un `enum` de Zod.

- **Validación**: Zod en el borde (`validarCuerpo`, `validarConsulta`). Los errores
  vuelven como `{ campo: [mensajes] }` y el frontend los pone bajo cada control.
- **Errores**: `ErrorSolicitud` (400), `ErrorAutorizacion` (403), `ErrorNoEncontrado`
  (404), `ErrorConflicto` (409). El mensaje está escrito para el usuario y viaja al
  cliente; cualquier otro error devuelve un 500 sin detalle.
- **Permisos**: `requierePermiso('modulo.accion')` en la ruta; los códigos son filas
  de `rol_permiso`. Ocultar un botón en el frontend es comodidad, no seguridad.
- **Auditoría**: `registrar(req, {...})` en cada escritura, con el antes y el después.
- **Bajas**: lógicas (`eliminado_en`) para expedientes y personas; con fecha de
  baja para la asignación de profesionales; físicas solo donde no hay historia que
  conservar (partes, movimientos, plazos cargados por error).
- **Fechas**: viajan como texto `YYYY-MM-DD`. No construir `Date` a partir de una
  fecha local: corre el día según la zona horaria.

**Frontend** (`frontend/src/`):

- Estilos con variables CSS (`estilos/tokens.css`); sin Tailwind ni fuentes externas.
- Todo acceso a la API pasa por `servicios/consultas.ts` (TanStack Query), que
  también define qué se invalida después de cada escritura.
- Filtros, orden y pestañas viven en la **URL** (`useSearchParams`).
- Formularios: `useErroresFormulario` en `lib/formulario.ts` + los campos de
  `componentes/ui/Campo.tsx`. El vocabulario del dominio (caracteres de parte,
  roles, tipos de documento) está en `lib/vocabulario.ts`.
- Toda baja pasa por `DialogoConfirmar`, que nombra el registro afectado.

**Pruebas** (`backend/tests/`): cada prueba de escritura crea sus propios datos con
el prefijo `PRUEBA ` y `limpiarDatosDePrueba()` los borra al terminar, para no
ensuciar los datos de demostración. Una prueba de escritura debe **releer de la
base** lo que guardó, no confiar en la respuesta del POST.

---

## 8. Calendario

El README fija la **entrega final para el 14/11**: repo completo, **despliegue
online**, informe y video. Con eso a la vista, lo que yo ordenaría es:

1. Resolver 3.3 (cookie) y desplegar esta rama: es lo que más tiempo puede
   consumir y no se probó nunca.
2. Cargar los `articulo_referencia` y validar los plazos (3.1) y el calendario del
   año en curso (3.2): es trabajo de datos, no de código.
3. Tareas (4.1) y pantalla del calendario de inhábiles (4.4): cierran lo que ya
   está a medias.
4. Lo demás según cuánto alcance el tiempo, dejando documentado qué quedó afuera.
