# Backend

API REST del Sistema de Gestión Integral para Estudios Jurídicos.

**Estado: Sprint S0.** Están el andamiaje, el despliegue y el módulo `causas`
reducido a un listado de lectura, que sirve de molde para los demás. Los 11
módulos restantes entran a partir del Sprint S1.

## Tecnología

Node.js + Express + TypeScript, organizado como monolito modular. Se despliega
en Render con el blueprint [`../render.yaml`](../render.yaml).

## Cómo correrlo

Lo normal es levantarlo con el resto del sistema desde la raíz del repositorio:

```bash
docker compose up
```

Para trabajar solo en el backend, con una base ya disponible:

```bash
npm install
npm run dev        # recarga automática en el puerto 4000
npm test           # pruebas (las de integración necesitan DATABASE_URL)
npm run typecheck  # tipos de src/ y tests/
npm run build      # compila a dist/
```

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Estado del servicio y de la conexión a la base. Es el health check de Render. |
| `GET` | `/api/causas` | Lista las causas no eliminadas, con su fuero y estado. Acepta `?limite=`. |

`/health` devuelve 200 incluso con la base caída, y el estado real va en el
cuerpo: si devolviera 500, Render reiniciaría el servicio cada vez que la base se
pausa.

## Estructura

Una carpeta por módulo, y dentro de cada una las cuatro capas:

```
backend/
├── src/
│   ├── app.ts              Construcción de la app Express (sin escuchar puerto)
│   ├── index.ts            Arranque del servidor y apagado ordenado
│   ├── config.ts           Lectura y validación de variables de entorno
│   ├── db.ts               Pool de PostgreSQL (perezoso, con TLS)
│   ├── modulos/
│   │   └── causas/         rutas · controlador · servicio · repositorio
│   ├── middlewares/        manejador de errores (auth y auditoría en S1)
│   └── comun/              utilidades compartidas
└── tests/
```

Los módulos pendientes —plazos, costas, documentos, usuarios-auth,
notificaciones, calendario, plantillas, tareas, auditoría, configuración e IA—
están descritos en [`../docs/listado-modulos.md`](../docs/listado-modulos.md) y
se agregan copiando la estructura de `modulos/causas/`.

Las capas y su justificación, en
[`../docs/arquitectura.md`](../docs/arquitectura.md). Los pasos de despliegue, en
[`../docs/despliegue.md`](../docs/despliegue.md).
