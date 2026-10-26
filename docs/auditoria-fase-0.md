# Auditoría Fase 0 — estado real del proyecto

Fecha: 2026-10-26 · Rama de trabajo: `producto/fase-1-fundaciones`

Este documento contrasta la especificación del producto con lo que el repositorio
contiene realmente. Es el punto de partida de la evolución de SistemaLegal desde el
andamiaje del Sprint S0 hacia un producto de gestión jurídica.

---

## 1. Qué hay hoy

### Base de datos — el activo más sólido

12 migraciones versionadas, 3 vistas y seeds completos. El modelo está bien normalizado,
con restricciones `CHECK` que protegen invariantes reales (una persona física exige
nombre y apellido; un plazo cumplido exige fecha de cumplimiento) y con índices parciales
pensados para las consultas que el producto necesita de verdad
(`ix_plazo_vigilancia` responde «¿qué vence próximamente?»).

Decisiones del esquema que conviene no perder de vista, porque condicionan todo lo demás:

- **`persona` es una agenda reutilizable del estudio**, no un dato embebido en la causa.
  El carácter procesal (actor, demandado, perito) vive en el vínculo `parte_causa`, así que
  la misma persona puede ser cliente en un expediente y contraria en otro.
- **El cómputo de plazos está separado en tres piezas**: `tipo_plazo` es la regla,
  `dia_inhabil` el calendario y `plazo` la instancia. El algoritmo vive en el backend,
  pero la base guarda los insumos *y* el resultado, de modo que todo cálculo sea
  reproducible y auditable.
- **El estudio es una fila única** (`uq_estudio_fila_unica`), coherente con el modelo de
  instalación independiente por cliente descrito en la especificación comercial.
- **Los permisos ya son datos**, no código: `rol`, `permiso` y `rol_permiso` existen y
  están sembrados. Cambiar qué puede hacer un rol es un `INSERT`, no un despliegue.
- `auditoria`, `refresh_token`, `notificacion` y `consulta_ia` están modeladas y vacías.

Hay datos de demostración para todos los módulos (3 causas, 6 personas, 4 usuarios,
3 plazos, 4 tareas, 3 documentos, 6 movimientos, 56 días inhábiles, 10 tipos de plazo).
Las contraseñas demo se siembran con `crypt(..., gen_salt('bf', 10))`, es decir bcrypt
estándar, verificable desde Node.

### Backend — arquitectura correcta, superficie mínima

`backend/src` respeta una separación por capas limpia y consistente
(rutas → controlador → servicio → repositorio), con el SQL confinado al repositorio.
El manejo de TLS contra Supabase, la allowlist de CORS y el manejador central de errores
están resueltos con criterio y cubiertos por pruebas.

La superficie funcional, en cambio, es de andamiaje: **un solo endpoint de lectura**
(`GET /api/causas`, sin filtros, sin paginación real, sin detalle) y `GET /health`.

### Frontend — pantalla de verificación, no producto

`App.tsx` (141 líneas) es la pantalla de diagnóstico del Sprint S0: comprueba que la
cadena SPA → API → base responde. No hay ruteo, ni sistema de diseño, ni componentes
reutilizables, ni gestión de datos remotos. Las dependencias son solo React y Vite.

---

## 2. Riesgos detectados

| # | Riesgo | Gravedad | Tratamiento |
|---|---|---|---|
| R1 | **No hay autenticación ni autorización.** Cualquiera que alcance la URL de la API lee las causas. Las tablas `usuario`, `rol`, `permiso` y `refresh_token` existen pero nada las usa. | Crítico | Se resuelve en esta fase, antes de exponer cualquier dato más. |
| R2 | **No se escribe auditoría.** La tabla existe y queda vacía: hoy no hay trazabilidad de quién hizo qué. | Alto | Se implementa junto con las operaciones de escritura. |
| R3 | **Sin validación de entrada en el backend.** El único endpoint no recibe cuerpo, pero no hay ninguna pieza de validación lista para cuando la haya. | Alto | Validación con esquemas en el borde HTTP. |
| R4 | **Sin límite de intentos de login** (cuando exista) ni de peticiones a endpoints sensibles. | Alto | Rate limiting en autenticación. |
| R5 | El repositorio git de la carpeta superior (`C:\`) es un repositorio accidental, sin commits, que cubre todo el disco. No afecta al proyecto, pero conviene eliminarlo. | Bajo | Se informa; no se toca sin autorización. |
| R6 | El remoto es `martinmaine/sistemalegal`, no `utma-tech/sistemalegal` como indica la especificación. El proyecto es además un Trabajo Final Integrador con un segundo integrante. | — | Decisión del propietario. No se hace push. |
| R7 | El cálculo de plazos no está implementado y es el núcleo de valor del producto. Requiere validación jurídica, no solo pruebas. | Alto | Fase 3, con pruebas sobre casos verificados. |

---

## 3. Qué se conserva

Todo lo que funciona. En concreto:

- El esquema completo de la base y sus migraciones.
- La arquitectura por capas del backend y su estilo de código (identificadores y
  comentarios en español, comentarios que explican el *porqué*).
- El manejo de TLS, CORS, errores y el `/health` tolerante a base caída.
- Las pruebas existentes de `vitest` y el flujo de CI.
- El entorno local de `docker compose` y el despliegue en Vercel/Render.
- La pantalla de diagnóstico, que no se borra: se mueve fuera del producto, a
  `/diagnostico`, porque sigue siendo útil para verificar un despliegue.

---

## 4. Decisiones técnicas de esta fase

### 4.1. Estilos: variables CSS propias, no Tailwind

La especificación admite evaluar Tailwind. Se decide **no incorporarlo** y construir el
sistema de diseño con *custom properties* de CSS y hojas por componente.

El motivo no es preferencia estética sino un requisito del producto: cada estudio debe
poder configurar su color de acento y su identidad visual **sin recompilar**. Con
variables CSS, el branding del estudio se resuelve inyectando valores en `:root` desde la
configuración guardada en la base. Con Tailwind haría falta igualmente esa capa de
variables, más una cadena de build adicional y una clase de mantenimiento que el equipo
tendría que sostener. Se evita complejidad que no compra nada.

### 4.2. Dependencias que sí se incorporan

Frontend:

- `react-router-dom` — ruteo; imprescindible para una aplicación de varias pantallas.
- `@tanstack/react-query` — datos remotos con estados de carga, error y caché
  coherentes. Es lo que evita reescribir `useEffect` + `useState` en cada pantalla, que
  es exactamente el patrón que hoy hay en `App.tsx`.
- `react-hook-form` + `zod` — formularios y validación compartida con el backend.
- `lucide-react` — iconografía lineal consistente.

Backend:

- `jsonwebtoken` + `bcryptjs` — autenticación contra los hashes bcrypt ya sembrados.
- `zod` — validación de entrada en el borde HTTP, con los mismos esquemas que el frontend.
- `cookie-parser` + `express-rate-limit` — refresh token en cookie `httpOnly` y
  protección del login.

### 4.3. Estrategia de sesión

Access token JWT de vida corta **en memoria** del frontend (nunca en `localStorage`, donde
un XSS lo leería) y refresh token de vida larga en **cookie `httpOnly`, `Secure`,
`SameSite=None`**, cuyo hash SHA-256 se guarda en `refresh_token` tal como el esquema ya
previó. Eso permite revocar sesiones del lado del servidor, que es lo que la tabla fue
diseñada para habilitar.

---

## 5. Orden de implementación

1. **Fase 1 — Fundaciones.** Autenticación y permisos en el backend; endpoints reales de
   causas, catálogos y panel; sistema de diseño, AppShell, ruteo y capa de datos en el
   frontend.
2. **Fase 2 — Experiencia central.** Dashboard, listado de expedientes, detalle de
   expediente, clientes y partes.
3. **Fase 3 — Operación jurídica.** Plazos (con el motor de cómputo y sus pruebas),
   agenda, documentos, movimientos, tareas, plantillas.
4. **Fase 4 — Administración.** Costas, informes, usuarios, configuración del estudio,
   personalización visual, auditoría consultable.
5. **Fase 5 — Preparación comercial.** Instalación reproducible, backups, monitoreo,
   manuales.

---

## 6. Criterios de aceptación de la Fase 1

- Un usuario de los datos demo puede iniciar sesión y cerrar sesión.
- Ningún endpoint de datos responde sin un access token válido.
- Los permisos se verifican en el backend, no solo ocultando botones.
- El listado de expedientes pagina, filtra y ordena **en el servidor**.
- El detalle de expediente trae partes, profesionales, movimientos, plazos, documentos
  y tareas reales.
- El dashboard muestra métricas calculadas sobre la base, nunca valores fijos.
- `npm run typecheck`, `npm test` y `npm run build` pasan en backend y frontend.
