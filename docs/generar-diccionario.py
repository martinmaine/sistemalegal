#!/usr/bin/env python3
"""Regenera el diccionario de datos de la 2.ª entrega a partir del DDL.

Lee db/migrations/*.sql, recorre el árbol sintáctico de PostgreSQL y reescribe
la sección del diccionario dentro de docs/entrega-2-diseno-y-modulos.md, entre
los marcadores INICIO/FIN DICCIONARIO.

Se genera desde el SQL para que el documento no pueda contradecir al esquema.

Uso (desde la raíz del repositorio):
    pip install pglast
    python docs/generar-diccionario.py
"""
import glob
import io
import os
import sys

try:
    from pglast import parse_sql
except ImportError:
    print('Falta la dependencia pglast. Instalar con:  pip install pglast',
          file=sys.stderr)
    sys.exit(2)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCUMENTO = os.path.join(RAIZ, 'docs', 'entrega-2-diseno-y-modulos.md')
INICIO = '<!-- INICIO DICCIONARIO (generado: no editar a mano) -->'
FIN = '<!-- FIN DICCIONARIO -->'

TIPOS = {
    'int2': 'SMALLINT', 'int4': 'INTEGER', 'int8': 'BIGINT',
    'varchar': 'VARCHAR', 'bpchar': 'CHAR', 'text': 'TEXT',
    'uuid': 'UUID', 'bool': 'BOOLEAN', 'date': 'DATE',
    'timestamptz': 'TIMESTAMPTZ', 'numeric': 'NUMERIC',
    'jsonb': 'JSONB', 'inet': 'INET',
}

BLOQUES = {
    '002_catalogos_juridicos.sql': 'Catálogos jurídicos',
    '003_tenencia_y_seguridad.sql': 'Tenencia y seguridad',
    '004_causas.sql': 'Causas',
    '005_documentos.sql': 'Documentos',
    '006_plazos_y_calendario.sql': 'Plazos y calendario',
    '007_alertas_y_notificaciones.sql': 'Alertas y notificaciones',
    '008_costas.sql': 'Costas',
    '009_operacion.sql': 'Plantillas y tareas',
    '010_ia.sql': 'IA (opcional)',
    '011_auditoria.sql': 'Auditoría',
}


def contype(c):
    t = c.get('contype')
    return t.get('name') if isinstance(t, dict) else t


def tipo_str(tn):
    base = TIPOS.get(tn['names'][-1]['sval'], tn['names'][-1]['sval'].upper())
    mods = []
    for m in tn.get('typmods', []) or []:
        v = m.get('val', m)
        if isinstance(v, dict) and 'ival' in v:
            iv = v['ival']
            mods.append(str(iv.get('ival', 0) if isinstance(iv, dict) else iv))
    return '{}({})'.format(base, ','.join(mods)) if mods else base


def generar():
    salida = []
    for ruta in sorted(glob.glob(os.path.join(RAIZ, 'db', 'migrations', '*.sql'))):
        nombre = os.path.basename(ruta)
        if nombre not in BLOQUES:
            continue
        salida.append('\n### {}\n'.format(BLOQUES[nombre]))
        salida.append('\n> Origen: `db/migrations/{}`\n'.format(nombre))

        for raw in parse_sql(io.open(ruta, encoding='utf-8').read()):
            d = raw(skip_none=True)['stmt']
            if d['@'] != 'CreateStmt':
                continue

            filas, restricciones = [], []
            for elt in d.get('tableElts', []):
                if elt.get('@') == 'ColumnDef':
                    col, tipo, notas, nulo = elt['colname'], tipo_str(elt['typeName']), [], 'sí'
                    for c in elt.get('constraints', []):
                        ct = contype(c)
                        if ct == 'CONSTR_NOTNULL':
                            nulo = 'no'
                        elif ct == 'CONSTR_PRIMARY':
                            notas.append('**PK**')
                            nulo = 'no'
                        elif ct == 'CONSTR_UNIQUE':
                            notas.append('UNIQUE')
                        elif ct == 'CONSTR_FOREIGN':
                            notas.append('FK → `{}`'.format(c['pktable']['relname']))
                        elif ct == 'CONSTR_IDENTITY':
                            notas.append('identidad')
                            nulo = 'no'
                    notas = list(dict.fromkeys(notas))
                    if '**PK**' in notas:
                        notas.remove('**PK**')
                        notas.insert(0, '**PK**')
                    filas.append((col, tipo, nulo, ', '.join(notas)))
                elif elt.get('@') == 'Constraint':
                    ct, nombre_c = contype(elt), elt.get('conname', '')
                    keys = [k['sval'] for k in elt.get('keys', [])]
                    if ct == 'CONSTR_CHECK':
                        restricciones.append(nombre_c)
                    elif ct == 'CONSTR_UNIQUE':
                        restricciones.append('{} (UNIQUE {})'.format(nombre_c, ', '.join(keys)))
                    elif ct == 'CONSTR_PRIMARY':
                        for i, f in enumerate(filas):
                            if f[0] in keys:
                                filas[i] = (f[0], f[1], 'no', ('**PK**, ' + f[3]).strip(', '))

            salida.append('\n#### `{}`\n\n'.format(d['relation']['relname']))
            salida.append('| Columna | Tipo | Nulo | Notas |\n|---|---|---|---|\n')
            for col, tipo, nulo, notas in filas:
                salida.append('| `{}` | {} | {} | {} |\n'.format(col, tipo, nulo, notas))
            if restricciones:
                salida.append('\nRestricciones de tabla: {}\n'.format(
                    ', '.join('`{}`'.format(c) for c in restricciones if c)))

    return ''.join(salida).strip()


def main():
    if not os.path.exists(DOCUMENTO):
        print('No se encontró {}'.format(DOCUMENTO), file=sys.stderr)
        return 1

    texto = io.open(DOCUMENTO, encoding='utf-8').read()
    if INICIO not in texto or FIN not in texto:
        print('No se encontraron los marcadores del diccionario.', file=sys.stderr)
        return 1

    antes = texto.split(INICIO)[0]
    despues = texto.split(FIN)[1]
    nuevo = antes + INICIO + '\n\n' + generar() + '\n\n' + FIN + despues

    io.open(DOCUMENTO, 'w', encoding='utf-8', newline='\n').write(nuevo)
    print('Diccionario regenerado en docs/{}'.format(os.path.basename(DOCUMENTO)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
