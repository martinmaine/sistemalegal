# Sistema de Gestión Integral para Estudios Jurídicos

## 📋 Descripción General

Sistema integral de gestión para estudios jurídicos argentinos. Una solución moderna y escalable que automatiza la gestión de juicios, plazos procesales, costas, equipo de trabajo y generación de documentos, integrando tecnología de IA para análisis legales y búsqueda de jurisprudencia.

**Mercado Inicial:** Provincia de Córdoba, Argentina  
**Arquitectura:** Escalable hacia otras provincias argentinas

---

## 🎯 Objetivo

Automatizar la gestión integral de juicios y procesos legales para estudios jurídicos, eliminando procesos manuales, centralizando información y potenciando la toma de decisiones mediante herramientas de IA.

---

## 📊 Análisis de Campo

### Hallazgos Preliminares

- ✗ Gestión manual de plazos procesales (sin automatización)
- ✗ Necesidad de control de costas procesales y cobro de honorarios
- ✗ Falta de centralización de documentos e información de causas
- ✗ Demanda por herramientas para búsqueda de jurisprudencia
- ✗ Poco conocimiento sobre IA en la profesión legal

---

## 🚀 Fase 1: MVP (Mínimo Viable)

### Funcionalidades Principales

#### 📑 Gestión de Juicios
- CRUD completo de juicios y causas
- Gestión de partes e información de profesionales
- Upload de PDFs con extracción automática a texto
- Centralización de documentación

#### ⏰ Gestión de Plazos
- Cálculo automático de plazos con días hábiles
- Sincronización con calendario judicial de Justicia Córdoba
- Calendario compartido del estudio
- Alertas inteligentes multi-nivel (crítica, importante, informativa)

#### 💰 Gestión de Costas
- Registro y seguimiento de costas procesales
- Control de cobros pendientes
- Reportes de gastos

#### 🛠️ Herramientas Operativas
- Banco de plantillas por tipo de escrito y tribunal
- Sistema de tareas y delegación entre empleados
- Sincronización lectura del Poder Judicial (consulta de movimientos)
- Sistema de roles y permisos (Super Admin, Admin, Jefe Estudio, Empleado)

#### 🔒 Seguridad y Auditoría
- Auditoría completa: registro de accesos, usuario, fecha y hora
- Sistema de roles y permisos granular
- Encriptación de datos sensibles

---

## 💻 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Angular + TypeScript |
| **Portales Cliente** | React + TypeScript |
| **Backend** | Node.js + Express |
| **Base de Datos** | PostgreSQL |
| **Conversor PDF** | Python + pdfplumber |
| **IA** | Claude API (Anthropic) |
| **Autenticación** | JWT + Passport.js |
| **Hosting** | Docker + AWS/DigitalOcean |

---

## 🔧 Escalabilidad

### Multi-Provincia
- Configuración adaptable de días inhábiles por provincia
- Formatos de tribunales configurable

### Arquitectura Modular
- Microservicios independientes (PDF converter, calculador de plazos, notificaciones)
- API para integraciones externas (sistemas de tribunales, contabilidad, etc.)

---

## 📈 Fases de Desarrollo

### Fase 1: MVP ✅ (Actual)
Funcionalidades esenciales de gestión y automatización de procesos.

### Fase 2: Avanzada 🔜
- Historial unificado de comunicación con clientes (email, WhatsApp, teléfono)
- CRM completo: datos de clientes y historial de casos
- Dashboard ejecutivo para jefes de estudio (KPIs, tasas de victoria)
- Sistema de facturación y honorarios
- Búsqueda avanzada de jurisprudencia (SAIJ + bases locales)

### Fase 3: Ecosistema Completo 🎯
- Generador de escritos con IA
- Predicción de resultados basada en ML
- App móvil para abogados en terreno
- Marketplace de peritos y profesionales
- Integración automática con Poder Judicial

---

## 💡 Valor Estratégico

### Automatización
Elimina procesos manuales que actualmente consumen recursos significativos.

### Centralización
Sistematiza información dispersa en múltiples soportes.

### Control
Implementa controles y trazabilidad completa de causas y operaciones.

### Inteligencia
Genera capacidades analíticas para la toma de decisiones.

---

## 👥 Autores

- **Martín Maine**
- **Gevont Utzmazian**

---

## 📝 Conclusión

Este sistema representa una solución integral y escalable para modernizar la gestión de estudios jurídicos argentinos. Comenzando con un MVP robusto en Córdoba, sienta las bases para una plataforma que puede expandirse regionalmente y competir con soluciones internacionales, siempre manteniendo adaptabilidad a la regulación y procedimientos legales locales.
El presente proyecto propone el desarrollo e implementación completa de la Fase 1 (MVP) del Sistema de Gestión Integral para Estudios Jurídicos. Esta fase constituye el núcleo funcional de la plataforma y establece los cimientos arquitectónicos sobre los cuales se construirán las expansiones futuras.

La Fase 1 no solo representa un producto mínimamente viable, sino que funciona como un esqueleto modular y escalable que proporciona a los estudios jurídicos un conjunto comprehensivo de herramientas de modernización operativa. Su implementación garantiza:

Valor Estratégico:

•	Automatización integral de procesos manuales que actualmente consumen recursos significativos
•	Centralización y sistematización de información dispersa en múltiples soportes
•	Implementación de controles y trazabilidad completa de causas y operaciones
•	Generación de capacidades analíticas para la toma de decisiones

Viabilidad Técnica:

•	Arquitectura robusta y modular que permite escalamiento sin rediseños mayores
•	Tecnologías consolidadas y de amplio soporte en el mercado
•	Separación clara de responsabilidades entre componentes (Frontend, Backend, BD)
•	Capacidad de integración con sistemas externos presentes y futuros

Alcance Realista:

•	Funcionalidades esenciales que resuelven los principales puntos de dolor identificados
•	Scope definido que permite completar desarrollo en timeframe académico.
•	Base sólida para posteriores expansiones (Fases 2 y 3) sin deuda técnica

Por estas razones, la realización completa de la Fase 1 constituye el objetivo óptimo para este trabajo final, balanceando ambición técnica con viabilidad práctica.




**Estado del Proyecto:** En Desarrollo  
**Versión:** 0.1.0 (MVP)  
**Última Actualización:** 30/08/2026
