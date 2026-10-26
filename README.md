# Sistema de Gestión Integral para Estudios Jurídicos

Aplicación web para la gestión integral de un estudio jurídico: administra causas y su
documentación, calcula y vigila plazos procesales, controla costas y cobros, organiza el
trabajo del equipo y registra auditoría completa. Incorpora asistencia con IA para el
análisis de textos legales y como apoyo a la búsqueda de jurisprudencia.

- **Mercado inicial:** Provincia de Córdoba, Argentina.
- **Arquitectura:** preparada para configurar otras provincias (días inhábiles y formatos de
  tribunales configurables); el MVP se valida solo con Córdoba.
- **Estado:** en desarrollo — Versión 0.1.0 (MVP, Fase 1). Esquema de base de datos
  y módulos definidos (2.ª entrega). **Fase 1 de producto completa**: autenticación con
  roles y permisos verificados en el servidor, panel de inicio, expedientes con su
  detalle y agenda de clientes, sobre datos reales de la base
  ([informe de la fase](docs/fase-1-fundaciones.md)).

> **Trabajo Final Integrador** — Tecnicatura Universitaria en Programación a Distancia.
>
> **1.ª entrega** — [propuesta de proyecto](docs/propuesta-proyecto.md)
>
> **2.ª entrega** — [arquitectura](docs/arquitectura.md) ·
> [esquema de base de datos](docs/esquema-base-de-datos.md) ·
> [listado de módulos](docs/listado-modulos.md)
>
> **Despliegue** — [pasos de instalación y publicación](docs/despliegue.md)

---

## Integrantes

| Integrante | GitHub |
|---|---|
| Martín Maine | [@martinmaine](https://github.com/martinmaine) |
| Gevont Utmazian | [@gevontutmazian](https://github.com/gevontutmazian8) |

**Tutor:** Sergio Andrés Antonini

---

## Problema que resuelve

Los estudios jurídicos pequeños y medianos de Córdoba gestionan decenas de causas en
paralelo con herramientas manuales y fragmentadas (planillas, agendas de papel, calendarios
personales, documentación dispersa, mensajería informal). Esto genera riesgo de vencimiento
de plazos procesales perentorios, pérdida de tiempo profesional en tareas administrativas,
costas y honorarios mal controlados y ausencia de trazabilidad sobre quién hizo qué y cuándo.

El detalle del análisis del problema, los actores, la propuesta de valor, el análisis de
competencia, la justificación del stack, el plan de trabajo y la viabilidad están en
[`docs/propuesta-proyecto.md`](docs/propuesta-proyecto.md).

---

## Alcance del MVP (Fase 1)

- **Gestión de causas:** CRUD, partes y profesionales, carga de PDF con extracción de texto,
  repositorio documental por causa.
- **Gestión de plazos:** cálculo automático con días hábiles, calendario de días inhábiles y
  feria judicial de Córdoba configurable, calendario compartido del estudio, alertas
  multinivel (crítica / importante / informativa).
- **Gestión de costas:** registro y seguimiento de costas procesales, control de cobros
  pendientes, reporte de gastos exportable.
- **Operación:** banco de plantillas de escritos por tipo y tribunal, tareas y delegación
  entre integrantes, registro de movimientos del Poder Judicial (carga manual / importación),
  roles y permisos (Admin, Jefe de Estudio, Empleado).
- **Seguridad y auditoría:** registro de auditoría de acciones sensibles, permisos granulares
  por rol, cifrado de datos sensibles.

### Fuera de alcance del MVP

Facturación / AFIP · CRM e historial de comunicaciones · dashboard de KPIs · búsqueda
avanzada de jurisprudencia (SAIJ + bases locales) · generación de escritos con IA ·
predicción con ML · app móvil · marketplace de peritos · integración automática de escritura
con el Poder Judicial · portal de cliente · operación multi-provincia activa.

---

## Tecnologías

| Capa | Tecnología | Despliegue |
|---|---|---|
| Frontend (SPA) | React + TypeScript (Vite) | Vercel |
| Backend / API REST | Node.js + Express + TypeScript | Render |
| Base de datos | PostgreSQL | Supabase (alternativa: Neon) |
| Microservicio PDF → texto | Python + FastAPI + `pdfplumber` | Render (servicio separado) |
| IA | Claude API (Anthropic) | SaaS externo (opcional) |
| Autenticación | JWT + Passport.js | — |
| Entorno local | Docker + Docker Compose | — |
| Control de versiones y gestión | Git + GitHub + GitHub Projects | GitHub |

La justificación de cada elección está en la Sección 5 de la propuesta.

---

## Estructura del repositorio

```
sistemalegal/
├── README.md              Este archivo
├── docs/                  Documentación de las entregas
│   ├── propuesta-proyecto.md        1.ª entrega
│   ├── arquitectura.md              Arquitectura y decisiones técnicas
│   ├── esquema-base-de-datos.md     Modelo de datos, DER y diccionario
│   └── listado-modulos.md           Los 12 módulos a desarrollar
├── database/              Esquema PostgreSQL
│   ├── migrations/        Migraciones versionadas (fuente de verdad)
│   ├── seed/              Catálogos base y datos ficticios
│   └── schema.sql         Esquema consolidado
├── frontend/              Aplicación React + TypeScript
├── backend/               API Node + Express + TypeScript
├── docker-compose.yml     Entorno local completo
└── render.yaml            Configuración del servicio en Render
```

> **Fase 1.** El backend expone autenticación, panel, causas, personas y catálogos;
> el frontend tiene su sistema de diseño, su estructura de navegación y las tres
> pantallas centrales funcionando contra la API. El detalle de qué quedó hecho, qué
> decisiones se tomaron y qué falta está en
> [`docs/fase-1-fundaciones.md`](docs/fase-1-fundaciones.md).

---

## Instalación (entorno local)

Requisitos: [Docker](https://www.docker.com/) y Docker Compose. No hace falta instalar
Node ni PostgreSQL.

```bash
git clone https://github.com/martinmaine/sistemalegal.git
cd sistemalegal
cp .env.example .env      # los valores por defecto ya sirven para el entorno local
docker compose up
```

Levanta el frontend en http://localhost:5173, el backend en http://localhost:4000 y una
base PostgreSQL con el esquema y los datos ficticios ya aplicados. El microservicio PDF se
suma cuando entre el módulo de documentos.

> Si ya tenés un PostgreSQL ocupando el puerto 5432, poné `PUERTO_DB=5433` en el `.env`.

Para entrar se usa cualquiera de los usuarios de demostración, todos con la contraseña
`Demo1234!`:

| Correo | Rol | Qué puede hacer |
|---|---|---|
| `admin@estudiodemo.test` | Administrador | Todo, incluidas usuarios y configuración |
| `jefe@estudiodemo.test` | Jefe de Estudio | Todo salvo usuarios y configuración |
| `empleado1@estudiodemo.test` | Empleado | Opera el día a día; no elimina ni ve auditoría |

Los permisos no están en el código: son filas de `rol_permiso`, y el backend los
verifica en cada petición.

> Estas credenciales existen solo en los datos ficticios de
> `database/seed/002_datos_demo.sql`. En una instalación real el administrador crea
> los usuarios del estudio.

Los pasos de publicación en Supabase, Render y Vercel están en
[`docs/despliegue.md`](docs/despliegue.md).

### Solo la base de datos (disponible ahora)

El esquema puede crearse con PostgreSQL 13 o superior:

```bash
createdb sistemalegal
psql -d sistemalegal -f database/schema.sql
psql -d sistemalegal -f database/seed/001_catalogos.sql
psql -d sistemalegal -f database/seed/002_datos_demo.sql
```

También se puede levantar con Docker sin instalar PostgreSQL. Los pasos, los
usuarios de demostración y las advertencias están en
[`database/README.md`](database/README.md).

---

## Hoja de ruta (fechas de la cátedra)

| Hito | Fecha máxima | Entregable | Estado |
|---|---|---|---|
| 1.ª Entrega — Propuesta + repositorio | 30/08 | `docs/propuesta-proyecto.md` + URL del repo | Aprobada |
| 2.ª Entrega — Diseño y módulos (Regular) | 27/09 | `docs/` (arquitectura, esquema, módulos) + `database/` | Subido — pendiente de aprobación del tutor |
| Entrega Final — Informe + video + despliegue | 14/11 | Repo completo, despliegue online, informe y video (preferentemente en inglés) | Pendiente |
| Defensa Oral | Mesa de examen | Presentación ante el comité | Pendiente |

El cronograma detallado por sprints está en la Sección 6 de la propuesta.

---

## Licencia

Proyecto académico — Trabajo Final Integrador. Uso educativo.
