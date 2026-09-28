# Listado de Módulos

## Sistema de Gestión Integral para Estudios Jurídicos

Trabajo Final Integrador — 2.ª Entrega
Martín Maine · Gevont Utmazian — Tutor: Sergio Andrés Antonini

**12 módulos** del backend, cada uno con responsabilidad única, tablas propias,
endpoints REST, dependencias y rol mínimo de acceso.

Documentos relacionados: [arquitectura](arquitectura.md) ·
[esquema de base de datos](esquema-base-de-datos.md) ·
[propuesta (1.ª entrega)](propuesta-proyecto.md)

---

## 1. Organización general

El backend es un **monolito modular**: un solo despliegue, con módulos internos
de responsabilidad única que se comunican por interfaces explícitas y no
comparten acceso directo a las tablas de otro módulo.

```
Frontend SPA (React + TypeScript)
          │  HTTP / JSON
┌─────────┴──────────────────────────────────────────────┐
│  Backend — monolito modular (Node + Express + TS)      │
│                                                        │
│  Núcleo de negocio                                     │
│   causas · plazos · costas · tareas · plantillas       │
│                                                        │
│  Transversales                                         │
│   usuarios-auth · notificaciones · auditoria           │
│   configuracion · documentos · calendario · ia         │
└────┬──────────────────────┬────────────────────────────┘
     │                      │
  PostgreSQL        pdf-service (Python + FastAPI)
                    Claude API (opcional)
```

### 1.1. Trazabilidad con la 1.ª entrega

La propuesta (Sección 5.4) declaró ocho módulos. **Se respetan los ocho.** Los
cuatro restantes son módulos de soporte que se explicitan ahora, al bajar el
diseño a detalle; ninguno agrega alcance funcional.

| Módulo declarado en la propuesta §5.4 | Módulo en esta entrega | Estado |
|---|---|---|
| `causas` | `causas` | Sin cambios |
| `plazos` | `plazos` | Sin cambios |
| `costas` | `costas` | Sin cambios |
| `usuarios/auth` | `usuarios-auth` | Sin cambios |
| `notificaciones` | `notificaciones` | Sin cambios |
| `plantillas` | `plantillas` | Sin cambios |
| `tareas` | `tareas` | Sin cambios |
| `auditoría` | `auditoria` | Sin cambios |
| — | `configuracion` | **Nuevo (soporte).** Los catálogos y el calendario de días inhábiles necesitan dueño; sin él, `plazos` quedaría a cargo de administrar datos que también usan `causas` y `plantillas`. |
| — | `documentos` | **Nuevo (soporte).** Estaba dentro de "causas" en la propuesta. Se separa porque es el único módulo que dialoga con el microservicio PDF y gestiona una cola asíncrona. |
| — | `calendario` | **Nuevo (soporte).** El "calendario compartido" del alcance MVP tiene entidad propia: aloja audiencias y reuniones que no son plazos. |
| — | `ia` | **Nuevo (soporte, opcional).** Aísla la dependencia externa para que su ausencia no afecte a ningún otro módulo. |

---

## 2. Fichas de módulo

> Convención de rutas: todos los endpoints cuelgan de `/api/v1`. Todos requieren
> autenticación salvo los marcados como públicos. El filtro por `estudio_id` se
> aplica de forma transversal y no aparece en las rutas.

### 2.1. `usuarios-auth`

| | |
|---|---|
| **Responsabilidad** | Autenticar usuarios, emitir y revocar tokens, administrar usuarios, roles y permisos. |
| **Tablas propias** | `usuario`, `rol`, `permiso`, `rol_permiso`, `refresh_token`, `estudio` |
| **Depende de** | — (es la base de la pila) |
| **Lo usan** | Todos los módulos, a través del middleware de autorización |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `POST` | `/auth/login` | Autenticar y emitir tokens | Público |
| `POST` | `/auth/refresh` | Renovar el token de acceso | Público (con refresh token) |
| `POST` | `/auth/logout` | Revocar el refresh token | Autenticado |
| `GET` | `/auth/perfil` | Datos y permisos del usuario actual | Autenticado |
| `GET` | `/usuarios` | Listar usuarios del estudio | Admin |
| `POST` | `/usuarios` | Alta de usuario | Admin |
| `PATCH` | `/usuarios/:id` | Modificar usuario | Admin |
| `DELETE` | `/usuarios/:id` | Desactivar usuario | Admin |
| `GET` | `/roles` | Listar roles y sus permisos | Admin |
| `PUT` | `/roles/:id/permisos` | Reasignar permisos de un rol | Admin |
| `GET` | `/estudios` | Listar estudios de la plataforma | Super Admin |
| `POST` | `/estudios` | Alta de estudio | Super Admin |

### 2.2. `configuracion`

| | |
|---|---|
| **Responsabilidad** | Administrar los catálogos y el calendario de días inhábiles. Es lo que hace configurable la operación en otra jurisdicción. |
| **Tablas propias** | `jurisdiccion`, `fuero`, `tribunal`, `tipo_causa`, `estado_causa`, `tipo_documento`, `concepto_costa`, `tipo_plazo`, `dia_inhabil` |
| **Depende de** | `usuarios-auth` |
| **Lo usan** | `causas`, `plazos`, `costas`, `documentos`, `plantillas` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/config/jurisdicciones` | Listar jurisdicciones | Autenticado |
| `GET` | `/config/fueros` | Listar fueros | Autenticado |
| `GET` | `/config/tribunales` | Listar tribunales (filtrable por fuero) | Autenticado |
| `GET` | `/config/tipos-causa` | Listar tipos de causa | Autenticado |
| `GET` | `/config/estados-causa` | Listar estados de causa | Autenticado |
| `GET` | `/config/conceptos-costa` | Listar conceptos de costa | Autenticado |
| `GET` | `/config/tipos-plazo` | Listar reglas de plazo | Autenticado |
| `POST` | `/config/tipos-plazo` | Crear una regla propia del estudio | Admin |
| `GET` | `/config/dias-inhabiles` | Consultar el calendario por rango | Autenticado |
| `POST` | `/config/dias-inhabiles` | Cargar un inhábil propio del estudio | Admin |
| `DELETE` | `/config/dias-inhabiles/:id` | Quitar un inhábil propio | Admin |

### 2.3. `causas`

| | |
|---|---|
| **Responsabilidad** | Ciclo de vida del expediente: alta, modificación, partes intervinientes, profesionales asignados y movimientos procesales. |
| **Tablas propias** | `causa`, `persona`, `parte_causa`, `profesional_causa`, `movimiento_causa` |
| **Depende de** | `configuracion`, `usuarios-auth` |
| **Lo usan** | `documentos`, `plazos`, `costas`, `tareas`, `calendario`, `ia` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/causas` | Listar con filtros (estado, fuero, tribunal, texto) | Empleado |
| `GET` | `/causas/:id` | Detalle completo | Empleado |
| `POST` | `/causas` | Crear causa | Empleado |
| `PATCH` | `/causas/:id` | Modificar causa | Empleado |
| `DELETE` | `/causas/:id` | Baja lógica | Jefe de Estudio |
| `GET` | `/causas/:id/partes` | Partes de la causa | Empleado |
| `POST` | `/causas/:id/partes` | Vincular una persona como parte | Empleado |
| `DELETE` | `/causas/:id/partes/:parteId` | Desvincular parte | Empleado |
| `GET` | `/causas/:id/profesionales` | Profesionales asignados | Empleado |
| `POST` | `/causas/:id/profesionales` | Asignar profesional | Jefe de Estudio |
| `GET` | `/causas/:id/movimientos` | Historial procesal | Empleado |
| `POST` | `/causas/:id/movimientos` | Registrar movimiento (manual) | Empleado |
| `POST` | `/causas/:id/movimientos/importar` | Importar movimientos desde archivo | Empleado |
| `GET` | `/personas` | Agenda de personas del estudio | Empleado |
| `POST` | `/personas` | Alta de persona | Empleado |
| `PATCH` | `/personas/:id` | Modificar persona | Empleado |

### 2.4. `documentos`

| | |
|---|---|
| **Responsabilidad** | Repositorio documental por causa y coordinación de la extracción de texto con el microservicio PDF. |
| **Tablas propias** | `documento`, `documento_texto` |
| **Depende de** | `causas`, `configuracion`, **`pdf-service`** (externo) |
| **Lo usan** | `ia` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/causas/:id/documentos` | Documentos de la causa | Empleado |
| `POST` | `/causas/:id/documentos` | Subir documento (multipart) | Empleado |
| `GET` | `/documentos/:id` | Metadatos del documento | Empleado |
| `GET` | `/documentos/:id/descargar` | Descargar el archivo | Empleado |
| `GET` | `/documentos/:id/texto` | Texto extraído | Empleado |
| `POST` | `/documentos/:id/reprocesar` | Reintentar una extracción con error | Empleado |
| `DELETE` | `/documentos/:id` | Baja lógica | Jefe de Estudio |
| `GET` | `/documentos/buscar?q=` | Búsqueda de texto completo | Empleado |

**Flujo de extracción:** al subir un PDF el documento queda en `PENDIENTE`. Un
proceso lee la cola (índice parcial sobre `estado_extraccion`), llama al
microservicio, guarda el resultado en `documento_texto` y pasa el documento a
`COMPLETADA` o a `ERROR` con su mensaje. Si el microservicio está caído, la
subida **no falla**: el documento queda encolado.

### 2.5. `plazos`

| | |
|---|---|
| **Responsabilidad** | Calcular, registrar y vigilar plazos procesales. Contiene el **motor de cómputo con días hábiles**. |
| **Tablas propias** | `plazo`, `plazo_suspension` |
| **Lee de** | `tipo_plazo`, `dia_inhabil` (propiedad de `configuracion`) |
| **Depende de** | `causas`, `configuracion` |
| **Lo usan** | `notificaciones`, `calendario`, `tareas` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/plazos` | Vencimientos del estudio, filtrables por rango y estado | Empleado |
| `GET` | `/causas/:id/plazos` | Plazos de una causa | Empleado |
| `POST` | `/causas/:id/plazos` | Crear plazo (calcula el vencimiento) | Empleado |
| `POST` | `/plazos/calcular` | Simular un cómputo sin persistir | Empleado |
| `PATCH` | `/plazos/:id` | Modificar plazo | Empleado |
| `POST` | `/plazos/:id/cumplir` | Marcar cumplido | Empleado |
| `POST` | `/plazos/:id/suspender` | Registrar suspensión | Jefe de Estudio |
| `POST` | `/plazos/:id/reanudar` | Cerrar la suspensión y recalcular | Jefe de Estudio |

**Motor de cómputo — contrato del servicio interno:**

```
calcularVencimiento({
  fechaNotificacion, cantidadDias, computo, jurisdiccionId, estudioId
}) -> { fechaInicioComputo, fechaVencimiento, diasInhabilesSalteados[] }
```

Reglas: en cómputo `HABIL` se descuentan sábados, domingos y las fechas de
`dia_inhabil` de la jurisdicción más las propias del estudio; en cómputo
`CORRIDO` se cuentan todos los días, pero si el vencimiento cae en día inhábil se
traslada al siguiente hábil. Devolver `diasInhabilesSalteados` es lo que permite
**mostrarle al usuario por qué** el vencimiento cayó en esa fecha.

Este servicio es el que debe cubrir los 10+ casos de prueba del objetivo
específico n.º 2, incluidos fines de semana y feria judicial.

### 2.6. `calendario`

| | |
|---|---|
| **Responsabilidad** | Calendario compartido del estudio: audiencias, reuniones y vencimientos en una sola vista. |
| **Tablas propias** | `evento_calendario` |
| **Depende de** | `causas`, `plazos` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/calendario?desde=&hasta=` | Eventos del estudio en un rango | Empleado |
| `POST` | `/calendario` | Crear evento | Empleado |
| `PATCH` | `/calendario/:id` | Modificar evento | Empleado |
| `DELETE` | `/calendario/:id` | Eliminar evento | Empleado |
| `GET` | `/calendario/exportar.ics` | Exportar en formato iCalendar | Empleado |

### 2.7. `notificaciones`

| | |
|---|---|
| **Responsabilidad** | Programar y disparar las alertas multinivel; entregar notificaciones a los usuarios. |
| **Tablas propias** | `regla_alerta`, `alerta`, `notificacion` |
| **Depende de** | `plazos`, `usuarios-auth` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/notificaciones` | Bandeja del usuario | Autenticado |
| `POST` | `/notificaciones/:id/leer` | Marcar como leída | Autenticado |
| `POST` | `/notificaciones/leer-todas` | Marcar todas como leídas | Autenticado |
| `GET` | `/alertas` | Alertas vigentes del estudio | Empleado |
| `GET` | `/config/reglas-alerta` | Reglas de alerta configuradas | Admin |
| `POST` | `/config/reglas-alerta` | Crear regla | Admin |
| `PATCH` | `/config/reglas-alerta/:id` | Modificar regla | Admin |

**Proceso programado:** una tarea diaria recorre los plazos abiertos, crea las
alertas que corresponden según las reglas del estudio y genera una
`notificacion` por responsable. El índice único `uq_alerta_plazo_regla` lo hace
idempotente: correr dos veces el mismo día no duplica avisos.

Niveles: `CRITICA` · `IMPORTANTE` · `INFORMATIVA`, según la anticipación
configurada.

### 2.8. `costas`

| | |
|---|---|
| **Responsabilidad** | Registrar costas procesales, imputar cobros y producir el reporte de gastos. |
| **Tablas propias** | `costa`, `cobro` |
| **Depende de** | `causas`, `configuracion` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/causas/:id/costas` | Costas de una causa | Empleado |
| `POST` | `/causas/:id/costas` | Registrar costa | Empleado |
| `PATCH` | `/costas/:id` | Modificar costa | Empleado |
| `DELETE` | `/costas/:id` | Eliminar costa | Jefe de Estudio |
| `POST` | `/costas/:id/cobros` | Imputar un cobro | Empleado |
| `GET` | `/costas/pendientes` | Tablero de cobros pendientes | Jefe de Estudio |
| `GET` | `/reportes/gastos?desde=&hasta=` | Reporte de gastos | Jefe de Estudio |
| `GET` | `/reportes/gastos.csv` | Exportar el reporte | Jefe de Estudio |

Al imputar un cobro, el módulo recalcula `costa.estado_cobro` **en la misma
transacción** que inserta el `cobro`.

### 2.9. `plantillas`

| | |
|---|---|
| **Responsabilidad** | Banco de modelos de escritos por tipo y por tribunal, con sustitución de marcadores a partir de los datos de la causa. |
| **Tablas propias** | `plantilla_escrito` |
| **Depende de** | `configuracion`, `causas` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/plantillas` | Listar (filtrable por fuero y tribunal) | Empleado |
| `GET` | `/plantillas/:id` | Ver plantilla | Empleado |
| `POST` | `/plantillas` | Crear plantilla del estudio | Jefe de Estudio |
| `PATCH` | `/plantillas/:id` | Modificar plantilla | Jefe de Estudio |
| `DELETE` | `/plantillas/:id` | Desactivar plantilla | Jefe de Estudio |
| `POST` | `/plantillas/:id/generar` | Resolver marcadores contra una causa | Empleado |

### 2.10. `tareas`

| | |
|---|---|
| **Responsabilidad** | Trabajo delegable entre integrantes del estudio, vinculado o no a una causa. |
| **Tablas propias** | `tarea` |
| **Depende de** | `causas`, `plazos`, `usuarios-auth` |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/tareas` | Tareas del estudio, filtrables | Empleado |
| `GET` | `/tareas/mias` | Tareas asignadas al usuario actual | Empleado |
| `POST` | `/tareas` | Crear tarea | Empleado |
| `PATCH` | `/tareas/:id` | Modificar o reasignar | Empleado |
| `POST` | `/tareas/:id/completar` | Marcar completada | Empleado |
| `DELETE` | `/tareas/:id` | Cancelar tarea | Jefe de Estudio |

### 2.11. `auditoria`

| | |
|---|---|
| **Responsabilidad** | Registrar toda acción sensible y permitir su consulta. |
| **Tablas propias** | `auditoria` |
| **Depende de** | `usuarios-auth` |
| **Lo usan** | Todos los módulos, por *middleware* |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/auditoria` | Consultar el registro, filtrable | Admin |
| `GET` | `/auditoria/entidad/:entidad/:id` | Historial de un registro concreto | Admin |
| `GET` | `/auditoria/exportar.csv` | Exportar el registro | Admin |

El registro se escribe por *middleware*, no por llamadas dispersas en cada
controlador: así ninguna acción sensible puede quedar sin auditar por olvido.
La tabla es **append-only**: la aplicación no expone actualización ni borrado.

### 2.12. `ia` (opcional)

| | |
|---|---|
| **Responsabilidad** | Análisis de textos legales y apoyo a la búsqueda de jurisprudencia mediante la Claude API. |
| **Tablas propias** | `consulta_ia` |
| **Depende de** | `documentos`, `causas`, **Claude API** (externa) |
| **Lo usan** | Nadie. Es una hoja del grafo de dependencias, por diseño. |

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/ia/estado` | Informa si el servicio está disponible | Autenticado |
| `POST` | `/ia/analizar-texto` | Analizar un texto o documento | Empleado |
| `POST` | `/ia/jurisprudencia` | Apoyo a la búsqueda sobre texto provisto | Empleado |
| `GET` | `/ia/consultas` | Historial y consumo del estudio | Admin |

**Degradación elegante:** sin clave de API configurada, `/ia/estado` devuelve no
disponible, el frontend oculta las funciones de IA y el resto del sistema opera
sin cambios. Las consultas rechazadas quedan registradas con estado
`SIN_SERVICIO`.

---

## 3. Matriz módulo × tablas

Cada tabla tiene **un solo módulo dueño**. Los demás la leen a través de la
interfaz de ese módulo, nunca por consulta directa.

| Módulo | Tablas propias | Cant. |
|---|---|---|
| `usuarios-auth` | `estudio`, `usuario`, `rol`, `permiso`, `rol_permiso`, `refresh_token` | 6 |
| `configuracion` | `jurisdiccion`, `fuero`, `tribunal`, `tipo_causa`, `estado_causa`, `tipo_documento`, `concepto_costa`, `tipo_plazo`, `dia_inhabil` | 9 |
| `causas` | `causa`, `persona`, `parte_causa`, `profesional_causa`, `movimiento_causa` | 5 |
| `documentos` | `documento`, `documento_texto` | 2 |
| `plazos` | `plazo`, `plazo_suspension` | 2 |
| `calendario` | `evento_calendario` | 1 |
| `notificaciones` | `regla_alerta`, `alerta`, `notificacion` | 3 |
| `costas` | `costa`, `cobro` | 2 |
| `plantillas` | `plantilla_escrito` | 1 |
| `tareas` | `tarea` | 1 |
| `auditoria` | `auditoria` | 1 |
| `ia` | `consulta_ia` | 1 |
| | **Total** | **34** |

---

## 4. Matriz de roles y permisos

Cuatro roles, según la propuesta. Los permisos son granulares (`módulo.acción`) y
viven en `rol_permiso`: cambiar qué puede hacer un rol es una operación de datos,
no un cambio de código.

| Módulo | Super Admin | Admin | Jefe de Estudio | Empleado |
|---|:---:|:---:|:---:|:---:|
| `causas` | Total | Total | Total | Ver, crear, editar, exportar |
| `personas` | Total | Total | Total | Ver, crear, editar, exportar |
| `documentos` | Total | Total | Total | Ver, crear, editar, exportar |
| `plazos` | Total | Total | Total | Ver, crear, editar, exportar |
| `calendario` | Total | Total | Total | Ver, crear, editar, exportar |
| `alertas` | Total | Total | Total | Ver, crear, editar, exportar |
| `costas` | Total | Total | Total | Ver, crear, editar, exportar |
| `plantillas` | Total | Total | Total | Ver, crear, editar, exportar |
| `tareas` | Total | Total | Total | Ver, crear, editar, exportar |
| `ia` | Total | Total | Total | Ver, crear, editar, exportar |
| `usuarios` | Total | Total | — | — |
| `configuracion` | Total | Total | — | — |
| `auditoria` | Total | Total | Ver, exportar | — |

Acciones: `ver` · `crear` · `editar` · `eliminar` · `exportar`. "Total" incluye
`eliminar`.

Diferencias clave: el **Empleado** nunca elimina y no ve la auditoría; el **Jefe
de Estudio** opera y elimina, pero no administra usuarios ni configuración; el
**Super Admin** además administra estudios y no pertenece a ninguno.

---

## 5. Trazabilidad: alcance del MVP → diseño

Verificación de que todo lo comprometido en la Sección 3.3 de la propuesta tiene
respaldo en este diseño.

| Requisito del MVP | Módulo | Tablas |
|---|---|---|
| CRUD de causas; partes y profesionales | `causas` | `causa`, `persona`, `parte_causa`, `profesional_causa` |
| Carga de PDF con extracción de texto | `documentos` | `documento`, `documento_texto` |
| Repositorio documental por causa | `documentos` | `documento` |
| Cálculo automático de plazos con días hábiles | `plazos` | `plazo`, `tipo_plazo`, `dia_inhabil` |
| Calendario de inhábiles y feria configurable | `configuracion` | `dia_inhabil`, `jurisdiccion` |
| Calendario compartido del estudio | `calendario` | `evento_calendario` |
| Alertas multinivel | `notificaciones` | `regla_alerta`, `alerta`, `notificacion` |
| Registro y seguimiento de costas | `costas` | `costa` |
| Control de cobros pendientes | `costas` | `cobro`, vista `vw_costa_saldo` |
| Reporte de gastos exportable | `costas` | `costa`, `cobro` |
| Plantillas de escritos por tipo y tribunal | `plantillas` | `plantilla_escrito` |
| Tareas y delegación | `tareas` | `tarea` |
| Movimientos del Poder Judicial (manual/importación) | `causas` | `movimiento_causa` |
| Roles y permisos (4 roles) | `usuarios-auth` | `rol`, `permiso`, `rol_permiso`, `usuario` |
| Registro de auditoría | `auditoria` | `auditoria` |
| Permisos granulares por rol | `usuarios-auth` | `rol_permiso` |
| Cifrado de datos sensibles en reposo | — | **Sin correlato en el esquema** (ver abajo) |

Los **diecisiete** puntos del alcance MVP de la Sección 3.3 están contemplados,
con una salvedad explícita:

> **Cifrado de datos sensibles en reposo.** Es el único requisito del MVP que no
> se resuelve con estructura de tablas, sino con una decisión de *hardening*:
> cifrado a nivel de volumen en el proveedor, cifrado por columna con `pgcrypto`,
> o ambos. El esquema no lo obstaculiza —las columnas candidatas
> (`persona.numero_documento`, `persona.cuit_cuil`, `documento_texto.texto`) son
> de longitud variable y no forman parte de ninguna clave—, pero la estrategia se
> define en el Sprint S5. Se registra como pendiente en el esquema de base de datos, sección 9.2.

Adicionalmente, la asistencia de IA descrita en la Sección 3.1 de la propuesta
tiene su correlato en el módulo `ia` y la tabla `consulta_ia`.

**Ningún elemento del "fuera de alcance" (Sección 3.4) tiene tablas en este
esquema**: no hay facturación, ni CRM, ni portal de cliente, ni KPIs.

---
