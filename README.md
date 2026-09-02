# Sistema de Gestión Integral para Estudios Jurídicos

Aplicación web para la gestión integral de un estudio jurídico: administra causas y su
documentación, calcula y vigila plazos procesales, controla costas y cobros, organiza el
trabajo del equipo y registra auditoría completa. Incorpora asistencia con IA para el
análisis de textos legales y como apoyo a la búsqueda de jurisprudencia.

- **Mercado inicial:** Provincia de Córdoba, Argentina.
- **Arquitectura:** preparada para configurar otras provincias (días inhábiles y formatos de
  tribunales configurables); el MVP se valida solo con Córdoba.
- **Estado:** en desarrollo — Versión 0.1.0 (MVP, Fase 1).

> **Trabajo Final Integrador** — Tecnicatura Universitaria en Programación a Distancia.
> Propuesta completa de la 1.ª entrega en [`docs/propuesta-proyecto.md`](docs/propuesta-proyecto.md).

---

## Integrantes

| Integrante | GitHub |
|---|---|
| Martín Maine | [@martinmaine](https://github.com/martinmaine) |
| Gevont Utzmazian | [@gevontutmazian](https://github.com/gevontutmazian8) |

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
  roles y permisos (Super Admin, Admin, Jefe de Estudio, Empleado).
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
| Base de datos | PostgreSQL | Neon (alternativa: Supabase) |
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
├── README.md              # Este archivo
├── docs/                  # Informes y entregas (propuesta, diseño de BD, etc.)
├── frontend/              # Aplicación React + TypeScript
├── backend/               # API Node.js + Express + TypeScript (monolito modular)
├── pdf-service/           # Microservicio Python (conversión PDF → texto)
├── db/                    # Scripts DDL/DML, migraciones y datos de prueba
└── docker-compose.yml     # Orquestación del entorno local
```

> El código y los scripts se irán incorporando a partir del Sprint 0. Las carpetas anteriores
> son la estructura objetivo declarada para la 1.ª entrega.

---

## Instalación (entorno local)

> Instrucciones preliminares. Se completarán cuando exista código en el repositorio.

Requisitos: [Docker](https://www.docker.com/) y Docker Compose.

```bash
git clone https://github.com/martinmaine/sistemalegal.git
cd sistemalegal
cp .env.example .env      # completar variables (BD, JWT_SECRET, CLAUDE_API_KEY opcional)
docker compose up
```

Esto levantará el frontend, el backend, el microservicio PDF y una base PostgreSQL con datos
de prueba ficticios.

---

## Hoja de ruta (fechas de la cátedra)

| Hito | Fecha máxima | Entregable |
|---|---|---|
| 1.ª Entrega — Propuesta + repositorio | 30/08 | `docs/propuesta-proyecto.md` + URL del repo |
| 2.ª Entrega — Diseño y módulos (Regular) | 27/09 | Esquema de base de datos + listado de módulos |
| Entrega Final — Informe + video + despliegue | 14/11 | Repo completo, despliegue online, informe y video (preferentemente en inglés) |
| Defensa Oral | Mesa de examen | Presentación ante el comité |

El cronograma detallado por sprints está en la Sección 6 de la propuesta.

---

## Licencia

Proyecto académico — Trabajo Final Integrador. Uso educativo.
