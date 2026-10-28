# Fase 1 — Fundaciones

Rama: `producto/fase-1-fundaciones` · Continúa el diagnóstico de
[`auditoria-fase-0.md`](auditoria-fase-0.md).

Esta fase convierte el andamiaje del Sprint S0 en una aplicación con sesión, permisos y
tres pantallas operativas sobre datos reales.

---

## 1. Qué quedó funcionando

### Autenticación y permisos

- Inicio y cierre de sesión contra los hashes bcrypt que ya sembraba el seed.
- Access token JWT de vida corta (15 min) **en memoria del navegador**; refresh token
  opaco en cookie `httpOnly`, cuyo hash se guarda en `refresh_token`.
- Rotación del refresh token con detección de reutilización: presentar uno ya consumido
  revoca todas las sesiones de esa cuenta.
- Renovación transparente: cuando el access token vence, el cliente lo renueva y
  reintenta la petición sin que la pantalla se entere.
- Límite de intentos de login por IP.
- `requierePermiso()` verifica en el servidor los códigos `modulo.accion` que ya existían
  en la base. Ocultar botones en el frontend es comodidad, no control.

### Endpoints nuevos

| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `POST /api/auth/login` | — | Inicia sesión |
| `POST /api/auth/refrescar` | — | Renueva y rota la sesión |
| `POST /api/auth/logout` | — | Revoca la sesión |
| `GET /api/auth/perfil` | sesión | Perfil y permisos vigentes |
| `GET /api/panel` | sesión | Indicadores y listas del inicio |
| `GET /api/causas` | `causa.ver` | Listado con paginación, filtros, búsqueda y orden |
| `POST /api/causas` | `causa.crear` | Alta en transacción, asigna titular |
| `GET /api/causas/:id` | `causa.ver` | Detalle con partes y profesionales |
| `GET /api/causas/:id/movimientos` | `causa.ver` | Historial procesal |
| `GET /api/causas/:id/plazos` | `plazo.ver` | Plazos de la causa |
| `GET /api/causas/:id/documentos` | `documento.ver` | Documentos de la causa |
| `GET /api/causas/:id/tareas` | `tarea.ver` | Tareas de la causa |
| `GET /api/personas` | `persona.ver` | Agenda con paginación y filtros |
| `GET /api/personas/:id` | `persona.ver` | Ficha y causas en que interviene |
| `GET /api/catalogos` | sesión | Fueros, tribunales, estados, tipos y profesionales |

Todo listado pagina, filtra y ordena **en el servidor**. El orden se valida contra una
lista cerrada, porque el valor termina en un `ORDER BY`.

### Auditoría

`auditoria` existía vacía desde el esquema inicial. Ahora se escribe en cada operación de
escritura, filtrando `password_hash` y tokens antes de serializar. El registro nunca
interrumpe la operación: si falla, se loguea y se sigue.

### Frontend

- Sistema de diseño en `src/estilos/`: tokens, base, componentes y estructura.
- Componentes reutilizables en `src/componentes/`: botón, tarjeta, tabla, campos,
  etiquetas de estado, estados de carga/vacío/error, paginación, modal, avisos.
- Estructura con barra lateral contraíble, barra superior, búsqueda global (`Ctrl+K`) y
  menú de usuario.
- Pantallas: acceso, panel de inicio, listado de expedientes, detalle de expediente con
  pestañas, agenda de clientes, ficha de persona y diagnóstico.
- Filtros y pestañas viven en la URL: la vista filtrada se comparte, el botón Atrás
  deshace un filtro y recargar no pierde la búsqueda.

---

## 2. Decisiones que conviene conocer

### Estilos con variables CSS, no Tailwind

Cada estudio debe poder cambiar su color de marca sin recompilar. Con custom properties
eso es asignar valores en `:root` desde la configuración de la base. Tailwind habría
necesitado igual esa capa de variables, más una cadena de build adicional.

### Sin fuentes externas

Se usa la pila tipográfica del sistema. El entorno local con `docker compose` es el
respaldo de la defensa oral y no puede depender de la conectividad; además, una fuente
remota agrega una petición bloqueante al primer render.

### Los permisos viajan dentro del access token

Evita una consulta a la base por petición. El costo es que un cambio de rol tarda en
aplicarse lo que dure el token (15 minutos). Es un intercambio deliberado, y es también
la razón de que el access token sea corto.

### El refresh token no es un JWT

Es un valor aleatorio opaco cuyo hash se guarda en `refresh_token`. Eso es lo que permite
revocar una sesión del lado del servidor, que un JWT autocontenido no permitiría.

### El `.env` se busca también en la raíz

`npm run dev` y `npm test` se ejecutan desde `backend/`, donde dotenv no encontraba el
`.env` del repositorio. Ahora se busca en el directorio actual y después en la raíz; una
variable del entorno real (Render, CI) sigue teniendo prioridad sobre cualquier archivo.

---

## 3. Verificación

- `npm run typecheck`, `npm test` y `npm run build` pasan en backend y frontend.
- **56 pruebas en verde**, de las cuales las de integración corren contra la base real:
  - Login correcto, credenciales inválidas con mensaje indistinguible, correo mal formado.
  - El refresh token no aparece en el cuerpo de la respuesta y la cookie es `HttpOnly`.
  - Rotación del refresh token y corte de todas las sesiones ante reutilización.
  - Logout revoca la sesión.
  - Listado de causas: paginación, búsqueda sin tildes, coherencia entre el total y las
    filas filtradas, rechazo de un orden fuera de la lista permitida.
  - Alta de causa verificando que **el dato quedó guardado** releyéndolo, y que quien la
    crea queda como titular; duplicado de número rechazado con error por campo.
  - Las cifras del panel coinciden con el listado filtrado equivalente.
- Recorrido completo verificado en el navegador: login → panel → listado → filtros →
  detalle → pestañas, en escritorio y en teléfono.

---

## 4. Qué falta

Pendiente de las fases siguientes, y deliberadamente fuera de esta:

- **Motor de cómputo de plazos.** Es el núcleo de valor del producto y requiere
  validación jurídica además de pruebas. Las pantallas muestran los plazos tal como están
  cargados y lo dicen explícitamente.
- Edición y baja de expedientes; alta y edición de personas.
- Carga de documentos y el microservicio de extracción de PDF.
- Agenda, tareas, costas, plantillas, notificaciones, usuarios y configuración. Aparecen
  en la barra lateral apagados y rotulados «En desarrollo».
- Personalización visual por estudio: los tokens están listos para recibir el color de
  marca desde la configuración, pero la pantalla que lo edita todavía no existe.

### Limitaciones conocidas

- **Cookie entre dominios.** En producción el frontend (Vercel) y la API (Render) están
  en sitios distintos, así que la cookie del refresh token viaja con `SameSite=None`. Los
  navegadores que bloquean cookies de terceros pueden descartarla. Antes de poner el
  sistema frente a clientes reales conviene servir API y aplicación bajo el mismo
  dominio. Es una decisión de despliegue, no de código.
- **Las pruebas usan el usuario demo compartido.** La prueba de reutilización de token
  revoca todas las sesiones de ese usuario, así que correr `npm test` cierra la sesión que
  tengas abierta en el navegador local. No afecta a CI, donde la base es efímera.
- El cálculo de días restantes se hace en el navegador sobre el calendario local. Para
  mostrar «vence en N días» alcanza; el cómputo procesal se hará en el servidor.
