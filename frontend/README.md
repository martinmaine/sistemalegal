# Frontend

Aplicación web (SPA) del Sistema de Gestión Integral para Estudios Jurídicos.

**Estado: pendiente.** La codificación comienza en el Sprint S0, una vez aprobada
la 2.ª entrega. Esta carpeta queda creada como parte de la estructura declarada.

## Tecnología

React + TypeScript, con Vite. Se despliega en Vercel.

## Estructura prevista

```
frontend/
├── src/
│   ├── paginas/        Vistas por módulo (causas, plazos, costas...)
│   ├── componentes/    Componentes reutilizables
│   ├── servicios/      Cliente de la API REST
│   ├── hooks/          Lógica de estado reutilizable
│   └── tipos/          Tipos TypeScript compartidos con el backend
└── public/
```

Ver [`../docs/arquitectura.md`](../docs/arquitectura.md).
