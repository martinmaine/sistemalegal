# Frontend

Aplicación web (SPA) del Sistema de Gestión Integral para Estudios Jurídicos.

**Estado: Sprint S0.** Hay una pantalla de verificación del despliegue, que
comprueba que la cadena SPA → API → base responde de punta a punta. Las vistas
de los módulos entran a partir del Sprint S1.

## Tecnología

React + TypeScript, con Vite. Se despliega en Vercel con *root directory*
`frontend`.

## Cómo correrlo

Lo normal es levantarlo con el resto del sistema desde la raíz del repositorio:

```bash
docker compose up        # http://localhost:5173
```

Para trabajar solo en el frontend, con la API ya disponible:

```bash
npm install
npm run dev          # servidor de desarrollo en el puerto 5173
npm run build        # verifica tipos y compila a dist/
npm run typecheck
```

La URL de la API llega por `VITE_API_URL` y vale `http://localhost:4000` por
defecto. Es la URL que usa el **navegador**, así que en docker compose va
`localhost`, no el nombre del contenedor.

## Estructura

```
frontend/
├── index.html
├── src/
│   ├── main.tsx        Punto de entrada
│   ├── App.tsx         Pantalla de verificación del despliegue
│   ├── estilos.css
│   ├── servicios/      Cliente de la API REST
│   ├── tipos/          Tipos TypeScript compartidos con el backend
│   ├── paginas/        Vistas por módulo (S1)
│   ├── componentes/    Componentes reutilizables (S1)
│   └── hooks/          Lógica de estado reutilizable (S1)
└── public/
```

Ver [`../docs/arquitectura.md`](../docs/arquitectura.md) y
[`../docs/despliegue.md`](../docs/despliegue.md).
