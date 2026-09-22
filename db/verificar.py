#!/usr/bin/env python3
"""Verifica el esquema SQL sin necesidad de una instancia de PostgreSQL.

Comprueba, recorriendo el árbol sintáctico que produce el parser real del motor
(libpg_query, vía pglast):

  1. Sintaxis válida de PostgreSQL en migraciones, seeds y schema.sql.
  2. Toda clave foránea apunta a una tabla existente, creada ANTES en el orden
     de migración, y a una columna que es PK o UNIQUE.
  3. Los índices referencian tablas y columnas existentes.
  4. Los triggers referencian tablas y funciones definidas.
  5. Las vistas referencian relaciones existentes.
  6. Los INSERT de los seeds usan tablas y columnas existentes.

Uso (desde la raíz del repositorio):
    pip install pglast
    python db/verificar.py

Devuelve 0 si todo está bien, 1 si encuentra problemas.
"""
import glob
import os
import re
import sys

try:
    from pglast import parse_sql
    from pglast.parser import ParseError
except ImportError:
    print('Falta la dependencia pglast. Instalar con:  pip install pglast',
          file=sys.stderr)
    sys.exit(2)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRACIONES = sorted(glob.glob(os.path.join(RAIZ, 'db', 'migrations', '*.sql')))
SEEDS = sorted(glob.glob(os.path.join(RAIZ, 'db', 'seed', '*.sql')))
SCHEMA = os.path.join(RAIZ, 'db', 'schema.sql')


def leer(ruta):
    with open(ruta, encoding='utf-8') as f:
        return f.read()


def contype(c):
    t = c.get('contype')
    return t.get('name') if isinstance(t, dict) else t


def sval(x):
    return x['sval'] if isinstance(x, dict) and 'sval' in x else x


def verificar_sintaxis(problemas):
    archivos = MIGRACIONES + SEEDS + ([SCHEMA] if os.path.exists(SCHEMA) else [])
    total = 0
    for ruta in archivos:
        try:
            total += len(parse_sql(leer(ruta)))
        except ParseError as e:
            problemas.append('SINTAXIS {}: {}'.format(os.path.basename(ruta), e))
    return len(archivos), total


def construir_esquema(problemas):
    tablas, vistas, funciones = {}, {}, set()
    orden = 0
    for ruta in MIGRACIONES:
        corto = os.path.basename(ruta)
        try:
            arbol = parse_sql(leer(ruta))
        except ParseError:
            continue
        for raw in arbol:
            d = raw(skip_none=True)['stmt']
            tipo = d['@']

            if tipo == 'CreateFunctionStmt':
                funciones.add(sval(d['funcname'][-1]))

            elif tipo == 'ViewStmt':
                vistas[d['view']['relname']] = ruta

            elif tipo == 'CreateStmt':
                orden += 1
                nombre = d['relation']['relname']
                info = {'cols': set(), 'pk': set(), 'unique': set(),
                        'fks': [], 'orden': orden, 'archivo': corto}
                for elt in d.get('tableElts', []):
                    if elt.get('@') == 'ColumnDef':
                        col = elt['colname']
                        info['cols'].add(col)
                        for c in elt.get('constraints', []):
                            ct = contype(c)
                            if ct == 'CONSTR_PRIMARY':
                                info['pk'].add(col)
                            elif ct == 'CONSTR_UNIQUE':
                                info['unique'].add(col)
                            elif ct == 'CONSTR_FOREIGN':
                                info['fks'].append((col, c['pktable']['relname'],
                                                    [sval(a) for a in c.get('pk_attrs', [])]))
                    elif elt.get('@') == 'Constraint':
                        ct = contype(elt)
                        keys = [sval(k) for k in elt.get('keys', [])]
                        if ct == 'CONSTR_PRIMARY':
                            info['pk'].update(keys)
                        elif ct == 'CONSTR_UNIQUE':
                            info['unique'].update(keys)
                        elif ct == 'CONSTR_FOREIGN':
                            destino = elt['pktable']['relname']
                            cols_dest = [sval(a) for a in elt.get('pk_attrs', [])]
                            for fkc in [sval(k) for k in elt.get('fk_attrs', [])]:
                                info['fks'].append((fkc, destino, cols_dest))
                tablas[nombre] = info

            elif tipo == 'IndexStmt':
                tabla = d['relation']['relname']
                if tabla not in tablas:
                    problemas.append('INDICE {} sobre tabla inexistente {}'.format(
                        d.get('idxname'), tabla))
                else:
                    for p in d.get('indexParams', []):
                        col = p.get('name')
                        if col and col not in tablas[tabla]['cols']:
                            problemas.append('INDICE {}: columna inexistente {}.{}'.format(
                                d.get('idxname'), tabla, col))

            elif tipo == 'CreateTrigStmt':
                tabla = d['relation']['relname']
                fn = sval(d['funcname'][-1])
                if tabla not in tablas:
                    problemas.append('TRIGGER {} sobre tabla inexistente {}'.format(
                        d.get('trigname'), tabla))
                elif fn == 'fn_actualizar_timestamp' and \
                        'actualizado_en' not in tablas[tabla]['cols']:
                    problemas.append('TRIGGER {}: {} no tiene actualizado_en'.format(
                        d.get('trigname'), tabla))
                if fn not in funciones:
                    problemas.append('TRIGGER {}: funcion no definida {}'.format(
                        d.get('trigname'), fn))

    return tablas, vistas, funciones


def verificar_fks(tablas, problemas):
    total = 0
    for tabla, info in sorted(tablas.items(), key=lambda x: x[1]['orden']):
        for col, destino, cols_dest in info['fks']:
            total += 1
            if col not in info['cols']:
                problemas.append('FK {}.{}: columna origen inexistente'.format(tabla, col))
            if destino not in tablas:
                problemas.append('FK {}.{} -> {}: TABLA DESTINO INEXISTENTE'.format(
                    tabla, col, destino))
                continue
            dest = tablas[destino]
            if dest['orden'] > info['orden']:
                problemas.append('FK {}.{} -> {}: el destino se crea DESPUES'.format(
                    tabla, col, destino))
            objetivo = cols_dest[0] if cols_dest else (
                sorted(dest['pk'])[0] if dest['pk'] else None)
            if objetivo is None:
                problemas.append('FK {}.{} -> {}: destino sin PK'.format(tabla, col, destino))
            elif objetivo not in dest['cols']:
                problemas.append('FK {}.{} -> {}.{}: columna destino inexistente'.format(
                    tabla, col, destino, objetivo))
            elif objetivo not in dest['pk'] and objetivo not in dest['unique']:
                problemas.append('FK {}.{} -> {}.{}: el destino no es PK ni UNIQUE'.format(
                    tabla, col, destino, objetivo))
    return total


def verificar_vistas(tablas, vistas, problemas):
    for vista, ruta in vistas.items():
        sql = leer(ruta)
        bloque = sql.split('CREATE VIEW ' + vista)[1].split(';')[0]
        for ref in re.findall(r'\b(?:FROM|JOIN)\s+([a-z_]+)', bloque):
            if ref not in tablas and ref not in vistas:
                problemas.append('VISTA {}: relacion inexistente {}'.format(vista, ref))


def verificar_seeds(tablas, problemas):
    total = 0
    for ruta in SEEDS:
        corto = os.path.basename(ruta)
        try:
            arbol = parse_sql(leer(ruta))
        except ParseError:
            continue
        for raw in arbol:
            d = raw(skip_none=True)['stmt']
            if d['@'] != 'InsertStmt':
                continue
            total += 1
            tabla = d['relation']['relname']
            if tabla not in tablas:
                problemas.append('{}: INSERT en tabla inexistente {}'.format(corto, tabla))
                continue
            for c in d.get('cols', []):
                nombre = c.get('name')
                if nombre and nombre not in tablas[tabla]['cols']:
                    problemas.append('{}: INSERT INTO {} usa columna inexistente {}'.format(
                        corto, tabla, nombre))
    return total


def main():
    problemas = []

    n_archivos, n_sentencias = verificar_sintaxis(problemas)
    tablas, vistas, funciones = construir_esquema(problemas)
    n_fks = verificar_fks(tablas, problemas)
    verificar_vistas(tablas, vistas, problemas)
    n_inserts = verificar_seeds(tablas, problemas)

    print('Archivos SQL   : {}'.format(n_archivos))
    print('Sentencias     : {}'.format(n_sentencias))
    print('Tablas         : {}'.format(len(tablas)))
    print('Vistas         : {}'.format(len(vistas)))
    print('Funciones      : {}'.format(len(funciones)))
    print('Claves foraneas: {}'.format(n_fks))
    print('INSERT en seeds: {}'.format(n_inserts))
    print('')

    if problemas:
        print('PROBLEMAS ({}):'.format(len(problemas)))
        for p in problemas:
            print('  - ' + p)
        return 1

    print('OK: sintaxis valida, sin FK rotas, sin dependencias fuera de orden,')
    print('    indices y triggers coherentes, seeds consistentes con el esquema.')
    print('')
    print('NOTA: esto NO reemplaza ejecutar el esquema. Para la prueba de humo')
    print('      contra PostgreSQL real:  node db/probar.mjs')
    return 0


if __name__ == '__main__':
    sys.exit(main())
