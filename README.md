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

Este sistema representa una solución integral y escalable para modernizar la gestión de estudios jurídicos argentinos. Comenzando con un MVP robusto en Córdoba, sienta las bases para una plataforma que puede expandirse regionalmente y competir con soluciones internacionales, manteniendo adaptabilidad a la regulación y procedimientos legales locales.

---

## 📞 Información de Contacto

Para más información sobre el proyecto, contacte a los autores.

---

**Estado del Proyecto:** En Desarrollo  
**Versión:** 0.1.0 (MVP)  
**Última Actualización:** 2024
