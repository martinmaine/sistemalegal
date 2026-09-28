# Backend

API REST del Sistema de Gestión Integral para Estudios Jurídicos.

**Estado: pendiente.** La codificación comienza en el Sprint S0, una vez aprobada
la 2.ª entrega. Esta carpeta queda creada como parte de la estructura declarada.

## Tecnología

Node.js + Express + TypeScript, organizado como monolito modular. Se despliega en
Render.

## Estructura prevista

Una carpeta por módulo, y dentro de cada una las cuatro capas:

```
backend/
├── src/
│   ├── modulos/
│   │   ├── causas/         rutas · controlador · servicio · repositorio
│   │   ├── plazos/
│   │   ├── costas/
│   │   ├── documentos/
│   │   ├── usuarios-auth/
│   │   ├── notificaciones/
│   │   ├── calendario/
│   │   ├── plantillas/
│   │   ├── tareas/
│   │   ├── auditoria/
│   │   ├── configuracion/
│   │   └── ia/
│   ├── middlewares/        autenticación · autorización · auditoría
│   └── comun/              utilidades compartidas
└── tests/
```

Los 12 módulos están descritos en
[`../docs/listado-modulos.md`](../docs/listado-modulos.md). Las capas y su
justificación, en [`../docs/arquitectura.md`](../docs/arquitectura.md).
