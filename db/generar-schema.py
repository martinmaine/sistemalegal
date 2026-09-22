#!/usr/bin/env python3
"""Regenera db/schema.sql concatenando db/migrations/*.sql en orden.

schema.sql es un archivo derivado: existe para que el esquema completo pueda
leerse o aplicarse de una sola vez. La fuente de verdad son las migraciones.

Uso (desde la raíz del repositorio):
    python db/generar-schema.py
"""
import glob
import io
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRACIONES = os.path.join(RAIZ, 'db', 'migrations', '*.sql')
DESTINO = os.path.join(RAIZ, 'db', 'schema.sql')

ENCABEZADO = """-- =============================================================================
-- schema.sql — Esquema consolidado
--
-- Sistema de Gestion Integral para Estudios Juridicos
-- 2.a Entrega — Diseno de base de datos
--
-- ARCHIVO GENERADO: es la concatenacion en orden de db/migrations/*.sql.
-- No editar a mano. Para cambiar el esquema se agrega una migracion nueva y se
-- regenera este archivo con:  python db/generar-schema.py
--
-- Uso:  psql -d sistemalegal -f db/schema.sql
-- =============================================================================

"""


def main():
    archivos = sorted(glob.glob(MIGRACIONES))
    if not archivos:
        print('No se encontraron migraciones en db/migrations/', file=sys.stderr)
        return 1

    partes = [ENCABEZADO]
    for ruta in archivos:
        nombre = os.path.basename(ruta)
        partes.append('\n-- ####  {}  {}\n\n'.format(nombre, '#' * (60 - len(nombre))))
        partes.append(io.open(ruta, encoding='utf-8').read().rstrip() + '\n')

    io.open(DESTINO, 'w', encoding='utf-8', newline='\n').write(''.join(partes))
    print('{} generado a partir de {} migraciones ({} bytes)'.format(
        os.path.relpath(DESTINO, RAIZ), len(archivos), os.path.getsize(DESTINO)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
