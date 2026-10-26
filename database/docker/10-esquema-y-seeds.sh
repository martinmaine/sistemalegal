#!/bin/sh
# Lo ejecuta la imagen de PostgreSQL la primera vez que se crea el volumen.
# Aplica el esquema consolidado y los datos ficticios, en el mismo orden que
# documenta database/README.md.
set -e

echo "[init] esquema consolidado"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /database/schema.sql

echo "[init] catálogos base"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /database/seed/001_catalogos.sql

echo "[init] datos de demostración (ficticios)"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /database/seed/002_datos_demo.sql

echo "[init] listo"
