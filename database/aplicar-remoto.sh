#!/usr/bin/env bash
#
# Aplica el esquema y los seeds a una base PostgreSQL remota (Supabase).
#
# Uso:
#   export DATABASE_URL='postgresql://postgres.xxx:CLAVE@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require'
#   ./database/aplicar-remoto.sh
#
# La cadena tiene que ser la del POOLER compartido en MODO SESION (puerto 5432).
# No la de modo transaccion (6543), que no acompaña bien al DDL, ni la conexion
# directa (db.<ref>.supabase.co), que es IPv6.
#
# No hace falta tener psql instalado: el cliente sale de la imagen de Docker.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: falta DATABASE_URL." >&2
  echo "       Exportala con la cadena del pooler en modo sesion (puerto 5432)." >&2
  exit 1
fi

case "$DATABASE_URL" in
  *:6543/*)
    echo "ERROR: esa es la cadena de modo transaccion (6543)." >&2
    echo "       Para aplicar migraciones usa la de modo sesion (5432)." >&2
    exit 1
    ;;
  *db.*.supabase.co*)
    echo "ERROR: esa es la conexion directa de Supabase, que es IPv6." >&2
    echo "       Usa la del pooler compartido: aws-X-REGION.pooler.supabase.com" >&2
    exit 1
    ;;
esac

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
IMAGEN="postgres:18"

# MSYS_NO_PATHCONV evita que Git Bash en Windows reescriba las rutas del volumen.
export MSYS_NO_PATHCONV=1

aplicar() {
  echo "[aplicar] $1"
  docker run --rm \
    -e DATABASE_URL \
    -e ARCHIVO="/database/$1" \
    -v "$RAIZ/database:/database:ro" \
    "$IMAGEN" \
    sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$ARCHIVO"'
}

# El orden importa, y ON_ERROR_STOP=1 tambien: sin el, psql sigue despues de un
# error y el esquema queda a medias pareciendo que funciono.
aplicar schema.sql
aplicar seed/001_catalogos.sql
aplicar seed/002_datos_demo.sql

echo "[aplicar] verificacion"
docker run --rm -e DATABASE_URL "$IMAGEN" \
  sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    select (select count(*) from causa)        as causas,
           (select count(*) from fuero)        as fueros,
           (select count(*) from estado_causa) as estados"'

echo "[aplicar] listo"
