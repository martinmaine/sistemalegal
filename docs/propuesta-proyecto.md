# 1.ª Entrega — Propuesta de Proyecto y Repositorio

## Sistema de Gestión Integral para Estudios Jurídicos

---

## 1. Datos del equipo

| Campo | Detalle |
|---|---|
| **Asignatura** | Trabajo Final Integrador — Tecnicatura Universitaria en Programación a Distancia |
| **Duración** | 1 cuatrimestre |
| **Integrantes** | Martín Maine (GitHub: `@martinmaine`) · Gevont Utmazian (GitHub: `@gevontutmazian8`) |
| **Tutor** | Sergio Andrés Antonini |
| **Repositorio único** | https://github.com/martinmaine/sistemalegal |
| **Tipo de caso** | Inventiva propia / caso simulado, sobre una problemática real y local (estudios jurídicos de la Provincia de Córdoba) |
| **Fecha de la entrega** | Septiembre 2026 |

> **Pendiente de completar por el equipo:** comisión y datos formales de la cátedra.

---

## 2. Definición del problema

### 2.1. Contexto

En la Provincia de Córdoba, los estudios jurídicos pequeños y medianos (aproximadamente de 2 a 10 personas: abogados/as titulares, asociados, procuradores y personal administrativo) llevan adelante decenas de causas en paralelo. Cada causa implica el seguimiento de **plazos procesales** perentorios, la gestión de **costas y honorarios**, el resguardo de **documentación** (escritos, cédulas, oficios, prueba) y la **coordinación del equipo** que trabaja sobre ella.

Hoy esa gestión se realiza, en la mayoría de estos estudios, de forma **manual y fragmentada**: planillas de cálculo para plazos y costas, agendas de papel o calendarios personales, carpetas físicas y digitales dispersas, y coordinación por mensajería informal (WhatsApp, correo). No existe una fuente única de verdad sobre el estado de cada causa ni sobre qué vence esta semana.

### 2.2. Enunciado del problema

> **Los estudios jurídicos pequeños y medianos de la Provincia de Córdoba**, que necesitan gestionar simultáneamente múltiples causas con sus plazos procesales, sus costas y el trabajo del equipo, **actualmente enfrentan el problema de que esa gestión se realiza de forma manual y fragmentada** (planillas, agendas de papel, calendarios personales, documentación dispersa y mensajería informal). **Esto genera:**
> - **Riesgo de vencimiento de plazos**, con consecuencias procesales graves (perentoriedad: la pérdida de la oportunidad de realizar el acto, art. 49 del CPCC de Córdoba) y eventual responsabilidad profesional;
> - **Pérdida de tiempo profesional** en tareas administrativas repetitivas (armar la agenda, buscar documentos, recalcular plazos);
> - **Costas y honorarios mal controlados**, con cobros que se demoran o se pierden;
> - **Ausencia de trazabilidad**: no queda registro de quién hizo qué y cuándo sobre cada causa.
>
> **Una solución de software podría** centralizar las causas y su documentación, calcular automáticamente los plazos según el calendario judicial de Córdoba, emitir alertas anticipadas, controlar costas y cobros, estandarizar la generación de escritos y registrar una auditoría completa de la operación del estudio.

### 2.3. Actores y necesidades (stakeholders)

| Actor | Rol frente al proceso | Necesidad principal | Limitación / consideración |
|---|---|---|---|
| Abogado/a titular (Jefe de Estudio) | Dirige el estudio; responsable último de todas las causas | Visión consolidada del estado de las causas y de los plazos próximos; control de honorarios y costas | Poca disponibilidad de tiempo; requiere una interfaz simple y directa |
| Abogado/a asociado / procurador/a | Lleva causas asignadas, presenta escritos, concurre a tribunales | Saber con claridad qué vence y cuándo; acceso rápido a documentos y a plantillas de escritos | Trabajo frecuente fuera del estudio; necesita acceso desde el navegador |
| Personal administrativo | Carga de datos, seguimiento de expedientes, agenda | Cargar y encontrar información rápidamente; no duplicar tareas | No es un perfil técnico |
| Cliente del estudio | Parte interesada en su propia causa | Conocer el estado de su caso sin depender de llamados | Acceso limitado y controlado — **fuera del MVP** (portal de cliente en Fase 2) |
| Administrador del sistema (equipo de desarrollo / soporte) | Alta de usuarios y roles; configuración por provincia (días inhábiles, tribunales) | Configurar el sistema sin tocar código | — |

### 2.4. Impacto (estimaciones del caso académico)

Al tratarse de un caso simulado, las siguientes cifras son **supuestos razonables a validar** con un relevamiento real en una etapa posterior:

- Un profesional dedica un estimado de **3 a 6 horas semanales** a controlar plazos y armar la agenda de forma manual.
- Un **plazo procesal vencido** puede implicar la pérdida del derecho a realizar el acto; el costo potencial es el resultado del juicio más la eventual responsabilidad profesional.
- Un porcentaje no despreciable de **costas y honorarios** se reclama tarde o no se cobra por falta de seguimiento sistemático.
- El **onboarding** de una persona nueva sin sistema implica varios días de "dónde está cada cosa".

### 2.5. ¿Existe algo similar hoy? ¿Por qué no alcanza?

Existen soluciones comerciales de gestión jurídica en Argentina (ver Sección 4). Para el segmento de estudios pequeños/medianos de Córdoba, las limitaciones habituales son: costo de licenciamiento, cálculo de plazos poco adaptado al calendario y a la feria judicial local, curva de aprendizaje alta, y escasa o nula incorporación de asistencia con IA. La alternativa "de hecho" (Excel + Calendar + WhatsApp + papel) no da trazabilidad, no calcula plazos y no escala con el volumen de causas.

### 2.6. Validez del problema

- **¿Ocurre ahora?** Sí; es la forma de trabajo corriente en el segmento descripto.
- **¿Los afectados lo reconocen?** Sí; el control manual de plazos y el cobro de costas son puntos de dolor conocidos del rubro.
- **¿Hay solución parcial hoy?** Sí (planillas, agendas, software genérico), insuficiente por lo indicado en 2.5.
- **¿Es técnicamente factible en el plazo y con los recursos?** Sí, acotando el alcance al MVP (Sección 3) y a un estudio tipo de Córdoba.
- **¿Aporta valor?** Sí: reduce costo (horas y plazos perdidos), habilita lo que antes no era viable (alertas automáticas, asistencia con IA, trazabilidad total) y mejora la experiencia de forma medible (responder "¿qué vence esta semana?" pasa de minutos a segundos).

---

## 3. Solución propuesta

### 3.1. Descripción

Aplicación web para la gestión integral de un estudio jurídico: administra causas y su documentación, calcula y vigila plazos procesales, controla costas y cobros, organiza el trabajo del equipo y registra auditoría completa. Incorpora asistencia con IA (Claude API) para el análisis de textos legales y como apoyo a la búsqueda de jurisprudencia.

- **Mercado inicial:** Provincia de Córdoba.
- **Arquitectura:** preparada para configurar otras provincias (días inhábiles y formatos de tribunales como dato configurable), aunque el MVP se prueba únicamente con Córdoba.

### 3.2. Propuesta de valor

| Eje | Qué aporta |
|---|---|
| **Reduce costos** | Menos horas administrativas, menos plazos vencidos, mejor tasa de cobro de costas y honorarios. |
| **Habilita lo que antes no era viable** | Alertas anticipadas automáticas, apoyo de IA para análisis y jurisprudencia, trazabilidad completa de la operación. |
| **Mejora la experiencia de forma medible** | Consultar el estado de una causa o los vencimientos de la semana pasa de minutos (revisando planillas y agendas) a segundos. |

### 3.3. Alcance del MVP (Fase 1)

**Gestión de causas**
- CRUD de causas; datos de partes y de profesionales intervinientes.
- Carga de documentos PDF con extracción automática de texto.
- Repositorio documental por causa.

**Gestión de plazos**
- Cálculo automático de plazos con días hábiles.
- Calendario de días inhábiles y feria judicial de Córdoba, **configurable**.
- Calendario compartido del estudio.
- Alertas multinivel (crítica / importante / informativa).

**Gestión de costas**
- Registro y seguimiento de costas procesales.
- Control de cobros pendientes.
- Reporte de gastos exportable.

**Operación del estudio**
- Banco de plantillas de escritos por tipo y por tribunal.
- Tareas y delegación entre integrantes del estudio.
- Registro de movimientos del Poder Judicial mediante **carga manual o importación** (ver riesgo R1).
- Roles y permisos: Super Admin, Admin, Jefe de Estudio, Empleado.

**Seguridad y auditoría**
- Registro de auditoría de acciones sensibles (usuario, fecha, hora, acción).
- Permisos granulares por rol.
- Cifrado de datos sensibles en reposo.

### 3.4. Fuera de alcance del MVP (explícito)

Queda **fuera de la Fase 1** y se documenta como trabajo futuro:

- Facturación electrónica e integración con AFIP.
- CRM completo e historial unificado de comunicaciones (email / WhatsApp / teléfono).
- Dashboard ejecutivo con KPIs y tasas de éxito.
- Búsqueda avanzada de jurisprudencia sobre SAIJ y bases locales (en el MVP: solo asistencia puntual con IA sobre texto provisto por el usuario).
- Generador automático de escritos con IA.
- Predicción de resultados con Machine Learning.
- Aplicación móvil nativa.
- Marketplace de peritos y profesionales.
- Integración automática (de escritura) con los sistemas del Poder Judicial.
- Portal de cliente.
- Operación multi-provincia activa (el MVP deja la configuración preparada, pero se valida solo con Córdoba).

### 3.5. Fases posteriores (visión)

- **Fase 2 — Avanzada:** portal de cliente, CRM e historial de comunicaciones, dashboard ejecutivo, facturación y honorarios, búsqueda avanzada de jurisprudencia.
- **Fase 3 — Ecosistema:** generación de escritos con IA, predicción con ML, app móvil, marketplace de peritos, integración automática con el Poder Judicial.

---

## 4. Análisis de competencia

### 4.1. Competidores directos

Software de gestión para estudios jurídicos con presencia en Argentina: **Lex-Doctor**, **iurix / SAJ**, **JusLab**, **Time Business (módulo Abogados)**, **Lawgan / Legal**, entre otros. Ofrecen gestión de expedientes, agenda y, en algunos casos, cálculo de plazos y facturación.

### 4.2. Competidores indirectos

La combinación de herramientas genéricas: **Excel / Google Sheets + Google Calendar + WhatsApp + Google Drive / carpetas físicas**, sostenida por el conocimiento de un/a secretario/a que "lleva todo". Es gratuita y flexible, pero no da trazabilidad, no calcula plazos y no escala.

### 4.3. Variables de comparación

| Variable | Solución propuesta | Software comercial típico | Herramientas genéricas |
|---|---|---|---|
| Costo | Sin licencia (proyecto académico / open) | Licencia mensual/anual | Bajo o nulo |
| Cálculo de plazos con calendario de Córdoba | Sí, configurable | Parcial / genérico | No |
| Alertas anticipadas multinivel | Sí, núcleo del sistema | Variable | Manual |
| Gestión de costas y cobros | Sí | Sí (a veces con costo extra) | Manual en planilla |
| Asistencia con IA | Sí (Claude API) | Poco frecuente | No |
| Curva de aprendizaje | Baja (alcance acotado) | Media / alta | Baja pero sin garantías |
| Soporte y adaptación local | Alta (foco Córdoba) | Media | — |
| Despliegue | Nube (web) | Nube u on-premise | Nube |

### 4.4. Diferenciadores

- **Foco en Córdoba desde el día uno:** días inhábiles, feria judicial y formatos de tribunales locales como dato configurable, con arquitectura lista para otras provincias.
- **Asistencia con IA integrada** (Claude) para análisis de textos legales y apoyo a la búsqueda de jurisprudencia, poco presente en las soluciones tradicionales.
- **Alertas multinivel y calendario compartido** como núcleo del producto, no como accesorio.
- **Modelo de datos y auditoría** diseñados para trazabilidad total.

**Desventaja honesta:** es un producto nuevo, sin base instalada ni respaldo comercial ni soporte; los competidores tienen años de mercado. El objetivo del proyecto es **académico**: demostrar una solución viable al problema, no competir comercialmente en el corto plazo.

### 4.5. Escenarios (análisis con IA)

- **¿Y si aparece un competidor con versión gratuita?** La ventaja se sostiene por la integración local y la asistencia con IA, no por el precio.
- **¿Características mínimas para no quedar fuera del mercado?** Cálculo de plazos confiable y gestión documental centralizada.
- **¿Qué ventaja se sostiene en el tiempo?** El conocimiento del procedimiento y del calendario judicial cordobés.
- **¿Qué es fácilmente copiable?** La integración genérica de IA.

---

## 5. Stack tecnológico y justificación

### 5.1. Stack

| Capa | Tecnología | Servicio de despliegue (nube) |
|---|---|---|
| **Frontend (SPA)** | React + TypeScript (Vite) | Vercel |
| **Backend / API REST** | Node.js + Express + TypeScript | Render |
| **Base de datos** | PostgreSQL | Neon (Postgres serverless) — alternativa: Supabase |
| **Microservicio de conversión PDF → texto** | Python + FastAPI + `pdfplumber` | Render (servicio separado) |
| **IA** | Claude API (Anthropic) | SaaS externo |
| **Autenticación** | JWT + Passport.js | (en el backend) |
| **Entorno local / reproducibilidad** | Docker + Docker Compose | — |
| **Control de versiones y gestión** | Git + GitHub (repositorio único) + GitHub Projects | GitHub |

### 5.2. Justificación por capa

**Frontend — React + TypeScript.**
Los navegadores solo interpretan JavaScript de forma nativa, por lo que el frontend web se construye sobre ese lenguaje. Se elige **React** por tener la mayor comunidad y ecosistema, una curva de aprendizaje accesible para un equipo de dos personas y abundante material. Usar **TypeScript** permite compartir lenguaje y tipos con el backend. Se descarta usar dos frameworks distintos (p. ej. Angular para la app interna y React para portales): duplicaría la curva de aprendizaje sin beneficio en el MVP; el portal de cliente de la Fase 2 se hará también con React.

**Backend — Node.js + Express + TypeScript.**
Unifica el lenguaje con el frontend (criterio de "unificación de lenguaje"), lo que reduce el costo de contexto para un equipo chico. El modelo de I/O no bloqueante de Node se adapta bien a una aplicación con muchas operaciones de lectura concurrentes (consultas de causas, notificaciones, calendario). **Express** es minimalista, maduro y con amplísimo soporte. La lógica se organiza como **monolito modular** (ver 5.4).

**Base de datos — PostgreSQL (relacional).**
Es la opción adecuada según los tres criterios para elegir una base relacional:
1. **Estructura bien definida y estable:** causas, partes, plazos, costas, usuarios, tareas y auditoría tienen un esquema claro que no cambia con frecuencia.
2. **Relaciones entre entidades:** una causa tiene muchas partes, muchos plazos, muchas costas y muchos documentos; las consultas requieren *joins* permanentes y claves foráneas.
3. **Integridad transaccional (ACID):** imprescindible al manejar datos legales y de dinero (costas y honorarios). 

Se descarta NoSQL porque el modelo no es documental ni de esquema cambiante, y se perdería integridad referencial. PostgreSQL además ofrece tipos y funciones de fecha potentes, útiles para el cómputo de plazos.

**Microservicio de conversión PDF — Python + `pdfplumber`.**
Python domina el procesamiento de texto y documentos, y `pdfplumber` extrae texto de PDF de forma confiable. Se aísla como **servicio independiente** para no acoplar el runtime de Node, poder escalarlo o reemplazarlo por separado y contener la única dependencia fuera del stack JavaScript. Se expone con una API mínima (FastAPI).

**IA — Claude API (Anthropic).**
Aporta análisis de textos legales y apoyo a la búsqueda de jurisprudencia que no es viable desarrollar internamente en el plazo del proyecto. Se integra como **dependencia externa opcional**: si no hay clave de API o créditos disponibles, el sistema sigue funcionando sin las funciones de IA (degradación elegante).

**Autenticación — JWT + Passport.js.**
Estándar de facto para APIs REST sin estado; Passport.js simplifica la estrategia y es ampliamente conocido.

**Entorno local — Docker + Docker Compose.**
Empaqueta la aplicación con sus dependencias, resuelve las diferencias entre entornos de desarrollo y producción y permite levantar frontend + backend + microservicio + base de datos con un solo archivo, lo que facilita el trabajo en equipo y las pruebas. **No se usan Kubernetes ni una arquitectura de microservicios completa:** sería sobreingeniería para el MVP.

**Despliegue en la nube (requisito de la cátedra).**
Se cumple el requisito de tener al menos un componente principal online: **Frontend en Vercel**, **Backend en Render** y **PostgreSQL en Neon** (todos con capa gratuita suficiente para el proyecto). Se descarta *serverless* puro para el backend por los procesos con estado y las tareas programadas (revisión de plazos, notificaciones).

### 5.3. Experiencia previa del equipo

| Tecnología | Nivel del equipo | Plan |
|---|---|---|
| JavaScript / TypeScript | Intermedio | Base sólida para todo el stack |
| SQL / PostgreSQL | Básico–intermedio (consultas) | Reforzar modelado y migraciones |
| React | Parcial | Curva asumida: hooks, manejo de estado, routing |
| Node.js / Express | Parcial | Curva asumida: diseño de API REST, middlewares |
| Docker / Docker Compose | Básico | Curva asumida: Sprint 0 dedicado a setup |
| Python (`pdfplumber` / FastAPI) | Básico | Alcance acotado a un único microservicio |

El principio adoptado es **"el mejor stack es el que ya se domina"**: por eso el stack es mayormente JavaScript/TypeScript, sobre el que el equipo tiene base. Las condiciones que habilitan aprender lo que falta durante el proyecto son las que describe la teoría: es un **proyecto académico con condiciones flexibles**, el **objetivo incluye aprender**, y los **plazos admiten la curva** si el alcance se mantiene acotado.

### 5.4. Nota de arquitectura

- **Frontend:** SPA en React.
- **Backend:** monolito modular (un solo despliegue) con módulos internos de responsabilidad única: `causas`, `plazos`, `costas`, `usuarios/auth`, `notificaciones`, `plantillas`, `tareas`, `auditoría`.
- **Microservicio separado:** conversor PDF → texto.
- **Base de datos:** PostgreSQL.
- Los microservicios adicionales (notificaciones, cálculo de plazos como servicio propio) se evalúan recién para la Fase 2, si el volumen lo justifica.

---

## 6. Plan de trabajo

### 6.1. Objetivo general

Desarrollar e implementar el **MVP (Fase 1)** del Sistema de Gestión Integral para Estudios Jurídicos: una aplicación web funcional y desplegada en la nube que resuelva la gestión de causas, plazos procesales, costas, trabajo del equipo y auditoría para un estudio jurídico tipo de la Provincia de Córdoba.

### 6.2. Objetivos específicos (medibles)

1. Implementar el módulo de **causas** con CRUD completo, gestión de partes y carga de documentos PDF con extracción de texto, cubierto con pruebas automatizadas.
2. Implementar el **cálculo automático de plazos** con días hábiles y un calendario de días inhábiles de Córdoba configurable, validado con un conjunto de al menos 10 casos de prueba (incluyendo fines de semana y feria judicial).
3. Implementar el sistema de **alertas multinivel** y el **calendario compartido** del estudio.
4. Implementar el módulo de **costas** con seguimiento de cobros y un reporte de gastos exportable.
5. Implementar **autenticación**, **roles y permisos** (4 roles) y **registro de auditoría** de todas las acciones sensibles.
6. **Desplegar** la solución en la nube (frontend, backend y base de datos) con al menos un componente principal accesible online, y dejar el entorno local reproducible con `docker compose up`.
7. Entregar **documentación** (README, manual de instalación, documentación de la API) y un **video explicativo** (preferentemente en inglés).

### 6.3. Metodología y organización

- **Marco:** Scrum adaptado; **sprints de 2 semanas**; tablero **Kanban en GitHub Projects**.
- **Repositorio único** en GitHub con ramas por *feature* y *pull requests* revisados por el otro integrante antes de fusionar.
- **Ceremonias:** planificación al inicio de cada sprint y revisión + retro al cierre; reuniones sincrónicas con el tutor cuando las convoque.
- **Estructura del repositorio:**

```
sistemalegal/
├── README.md              # Documentación principal, instalación, tecnologías, integrantes
├── docs/                  # Informes y entregas (esta propuesta, diseño de BD, etc.)
├── frontend/              # Aplicación React + TypeScript
├── backend/               # API Node.js + Express + TypeScript (monolito modular)
├── pdf-service/           # Microservicio Python (conversión PDF → texto)
├── db/                    # Scripts DDL/DML, migraciones y datos de prueba
└── docker-compose.yml     # Orquestación del entorno local
```

### 6.4. Reparto de roles

Ambos integrantes trabajan *full-stack*; el foco principal se reparte así:

| Integrante | Foco principal |
|---|---|
| **Martín Maine** | Backend / API, modelo de datos y migraciones, microservicio PDF, despliegue (Docker, Render, Neon). |
| **Gevont Utzmazian** | Frontend React, UX, integración con la API, integración de IA (Claude). |
| **Ambos** | Definición de requisitos, pruebas, documentación, revisión cruzada de *pull requests*, preparación de la defensa oral. |

### 6.5. Cronograma (anclado a las fechas de la cátedra)

| Hito de la cátedra | Fecha máxima | Entregable |
|---|---|---|
| **1.ª Entrega** — Propuesta + repositorio | 30/08 | Este documento + URL del repositorio |
| **2.ª Entrega** — Diseño y módulos (Condición de Regular) | 27/09 | Esquema de la base de datos (relacional) + listado de módulos, aprobados por el tutor y el comité |
| **Entrega Final** — Informe + video + despliegue | 14/11 | Repositorio completo (código, BD, despliegue online funcionando), informe escrito y video explicativo (preferentemente en inglés) |
| **Defensa Oral** | Mesa de examen | Presentación y justificación ante el comité |

| Sprint | Semanas (aprox.) | Trabajo principal | Entregable del sprint | Dependencias |
|---|---|---|---|---|
| **S0 – Setup** | 01/09 – 14/09 | Estructura del repo, `docker-compose`, esquema inicial de BD, auth JWT básica, pipeline mínima. Inicio del **diseño de BD y del listado de módulos** para la 2.ª entrega. | Proyecto ejecutable *end-to-end* ("hola mundo" con login) | — |
| **S1 – Diseño + Causas** | 15/09 – 27/09 | Cierre del **esquema de BD** y del **listado de módulos** (**Entrega 27/09**). Módulo Causas: CRUD, partes, profesionales, repositorio documental (upload PDF). | Diseño de BD aprobado + alta/consulta de causas con documentos | S0 |
| **S2 – PDF + Plazos** | 28/09 – 11/10 | Microservicio PDF (extracción de texto y asociación a la causa). Motor de plazos: cálculo con días hábiles + calendario de inhábiles de Córdoba configurable, con casos de prueba. | Subir un PDF y ver su texto; calcular el vencimiento de un acto | S1 |
| **S3 – Alertas + Costas** | 12/10 – 25/10 | Alertas multinivel y calendario compartido del estudio. Módulo Costas: registro, cobros pendientes, reporte de gastos. | Alertas visibles + costas por causa + reporte exportable | S2 |
| **S4 – Roles + Operación + IA** | 26/10 – 08/11 | Roles y permisos (4 roles), auditoría completa, plantillas de escritos, tareas y delegación. Integración de IA (Claude) opcional. | Control de acceso + log de auditoría + plantillas + tareas | S1–S3 |
| **S5 – Cierre y despliegue** | 09/11 – 14/11 | *Hardening* (cifrado de datos sensibles), pruebas *end-to-end*, **despliegue en la nube** (Vercel + Render + Neon), informe escrito y **video en inglés**. | **Entrega Final (14/11):** MVP desplegado + informe + video | Todos |
| **Post‑entrega** | 15/11 – mesa | Preparación de la defensa oral; síntesis del trabajo. | Defensa | Entrega Final |

### 6.6. Entregables acumulados en el repositorio

Repositorio único con historial de *commits* y tablero de sprints; `docs/` con esta propuesta, el diseño de BD y los informes de avance; scripts DDL/DML y datos de prueba **ficticios** en `db/`; documentación de la API; manual de instalación con Docker en el README; despliegue online funcionando; video explicativo final.

### 6.7. Riesgos y mitigaciones

| ID | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| **R1** | El portal del Poder Judicial de Córdoba no ofrece API pública para consultar movimientos | Alta | Medio | En el MVP la "sincronización" es **carga manual o importación** de datos; la integración automática se evalúa para la Fase 2. Se documenta la limitación. |
| **R2** | Alcance amplio para 2 personas en un cuatrimestre | Alta | Alto | Priorización **MoSCoW**: causas + plazos son *Must*; costas, plantillas, tareas e IA son *Should / Could* y pueden recortarse sin romper el núcleo. |
| **R3** | Reglas de cómputo de plazos procesales mal modeladas (dominio jurídico complejo) | Media | Alto | Basarse en el CPCC de Córdoba y en el calendario oficial de feria/inhábiles; validar con casos de prueba; mantener los días inhábiles como **dato configurable**, nunca fijo en el código. |
| **R4** | Dependencia de Claude API (costo, clave, disponibilidad) | Media | Bajo | Las funciones de IA son **opcionales** y con degradación elegante: sin clave/créditos, el sistema funciona igual. |
| **R5** | Manejo de datos personales sensibles (Ley 25.326 de Protección de Datos Personales) | Media | Alto | En desarrollo, **solo datos ficticios**; cifrado de datos sensibles en reposo; control de acceso por rol; registro de auditoría; documentar el tratamiento de datos. |
| **R6** | Curva de aprendizaje (React, Docker, microservicio Python) | Media | Medio | **Sprint 0** dedicado a setup y aprendizaje; *pair programming*; uso de librerías estándar; el stack unificado en JS/TS reduce la superficie. |
| **R7** | Un integrante queda fuera de servicio (enfermedad, exámenes) | Media | Medio | Ambos trabajan *full-stack* aunque con foco; PRs revisados de forma cruzada; documentación al día. |
| **R8** | Servicios gratuitos de nube con límites (suspensión por inactividad, cuotas) | Baja | Bajo | Servicios con capa gratuita conocida (Vercel/Render/Neon); documentar el procedimiento de *redeploy*; el entorno local con Docker siempre disponible como respaldo para la demo. |

### 6.8. Criterios de éxito del MVP

- Un usuario puede **crear una causa**, subir un **PDF** y recuperar su **texto**.
- Dado un **acto procesal** y su fecha de notificación, el sistema **calcula correctamente el vencimiento** en un conjunto de al menos **10 casos de prueba** que cubren fines de semana y feria judicial.
- El sistema **emite una alerta** antes del vencimiento de un plazo.
- Se **registran y consultan costas** por causa y se **exporta un reporte**.
- Los **4 roles** tienen permisos diferenciados y toda acción sensible queda en el **log de auditoría**.
- El entorno local se levanta con un solo `docker compose up`, y **al menos un componente principal está desplegado y accesible online**.
- **Documentación y video** entregados.

---

## 7. Viabilidad

### 7.1. Viabilidad técnica

- Stack consolidado y de amplio soporte; el equipo maneja el lenguaje base (JS/TS y SQL) y la curva restante es abordable dentro del cuatrimestre si el alcance se mantiene acotado.
- Arquitectura de **monolito modular + un microservicio**, que evita complejidad innecesaria y mantiene separadas las responsabilidades (Frontend / Backend / Base de datos).
- **Sin dependencias críticas de terceros:** la IA es opcional y la integración con el Poder Judicial se acota a carga manual en el MVP (R1).
- Requisito de despliegue en la nube cubierto con servicios de capa gratuita (Vercel / Render / Neon).

### 7.2. Viabilidad operativa

- El sistema está pensado para un estudio jurídico tipo de 3 a 10 personas; solo requiere un navegador y una conexión a internet.
- La adopción se facilita con roles claros y una interfaz simple y acotada.
- **Cumplimiento:** tratamiento de datos personales conforme a la Ley 25.326; durante el desarrollo se usan exclusivamente datos ficticios.
- Al ser un caso académico, no hay un cliente obligado a adoptarlo: la validación operativa se hará mediante la **demo** y, de ser posible, con la devolución de un profesional del rubro.
- El mantenimiento posterior al MVP queda a cargo del equipo.

### 7.3. Viabilidad temporal

- El alcance del MVP está dividido en **6 sprints de 2 semanas** anclados a las fechas de la cátedra, con el **núcleo (causas + plazos) terminado antes de la mitad del cuatrimestre**.
- Los módulos posteriores (costas, plantillas, tareas, IA) son **recortables** sin comprometer la demostración ni la condición de Regular.
- El cronograma es compatible con los hitos: 2.ª entrega el **27/09** y entrega final el **14/11**.

---

## 8. Conclusión

El proyecto propone el desarrollo completo de la **Fase 1 (MVP)** de un Sistema de Gestión Integral para Estudios Jurídicos, orientado a una problemática **local y concreta** —la gestión manual de causas, plazos y costas en los estudios jurídicos de la Provincia de Córdoba— con posibilidad de transferencia al medio.

La Fase 1 constituye el núcleo funcional y la base arquitectónica del producto: resuelve los principales puntos de dolor identificados (riesgo de plazos vencidos, dispersión de la información, falta de control de costas y de trazabilidad), tiene un alcance realista para un equipo de dos personas en un cuatrimestre, y deja los cimientos para las Fases 2 y 3 sin deuda técnica. El stack elegido se apoya en tecnologías que el equipo ya conoce parcialmente (JavaScript/TypeScript y SQL), con una curva de aprendizaje acotada y justificada, y cumple el requisito de despliegue en la nube.

**Repositorio único:** https://github.com/martinmaine/sistemalegal

---

**Estado del proyecto:** En desarrollo · **Versión:** 0.1.0 (MVP) · **Documento:** Propuesta 1.ª Entrega
