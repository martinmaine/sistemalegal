-- =============================================================================
-- SEED 001 — Catálogos de referencia
--
-- Datos de configuración necesarios para que el sistema arranque. A diferencia
-- de 002_datos_demo.sql, esto NO es de prueba: es la configuración base.
--
-- Todas las inserciones son idempotentes (ON CONFLICT DO NOTHING) y resuelven
-- las claves foráneas por código natural, no por UUID fijo.
--
-- -----------------------------------------------------------------------------
-- ADVERTENCIA PARA EL EQUIPO — completar antes de la entrega final
-- -----------------------------------------------------------------------------
-- 1. Los artículos del CPCC de Córdoba (Ley 8465) que fundan cada tipo_plazo
--    quedan en NULL a propósito. NO se inventan citas legales: deben tomarse
--    del texto oficial y cargarse con UPDATE. Los valores de cantidad_dias son
--    los de uso corriente y también requieren confirmación.
-- 2. Los feriados trasladables y los "días no laborables con fines turísticos"
--    se fijan por decreto cada año: hay que revisarlos contra el calendario
--    oficial del año en curso.
-- 3. Las fechas exactas de la feria judicial de julio las fija el TSJ por
--    Acuerdo Reglamentario. Las cargadas aquí son la ventana habitual.
-- 4. El listado de tribunales es un subconjunto para desarrollo, no el padrón
--    completo del Poder Judicial de Córdoba.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Jurisdicción
-- -----------------------------------------------------------------------------
INSERT INTO jurisdiccion (codigo, nombre, pais) VALUES
    ('AR-X', 'Córdoba', 'Argentina')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Fueros
-- -----------------------------------------------------------------------------
INSERT INTO fuero (jurisdiccion_id, codigo, nombre)
SELECT j.id, v.codigo, v.nombre
FROM jurisdiccion j,
     (VALUES
        ('CIV_COM', 'Civil y Comercial'),
        ('LABORAL', 'Laboral'),
        ('FAMILIA', 'Familia'),
        ('PENAL',   'Penal'),
        ('CONT_ADM','Contencioso Administrativo')
     ) AS v(codigo, nombre)
WHERE j.codigo = 'AR-X'
ON CONFLICT (jurisdiccion_id, codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Tribunales (subconjunto de desarrollo — Córdoba Capital)
-- -----------------------------------------------------------------------------
INSERT INTO tribunal (jurisdiccion_id, fuero_id, nombre, nominacion, circunscripcion, sede)
SELECT j.id, f.id, v.nombre, v.nominacion, 'Primera', 'Córdoba Capital'
FROM jurisdiccion j
JOIN fuero f ON f.jurisdiccion_id = j.id
JOIN (VALUES
        ('CIV_COM', 'Juzgado de Primera Instancia Civil y Comercial', '1.ª'),
        ('CIV_COM', 'Juzgado de Primera Instancia Civil y Comercial', '2.ª'),
        ('CIV_COM', 'Juzgado de Primera Instancia Civil y Comercial', '3.ª'),
        ('CIV_COM', 'Cámara de Apelaciones en lo Civil y Comercial',  '1.ª'),
        ('LABORAL', 'Juzgado de Conciliación',                        '1.ª'),
        ('LABORAL', 'Cámara del Trabajo',                             '2.ª'),
        ('FAMILIA', 'Juzgado de Niñez, Adolescencia y Familia',       '1.ª')
     ) AS v(fuero_codigo, nombre, nominacion)
  ON v.fuero_codigo = f.codigo
WHERE j.codigo = 'AR-X'
ON CONFLICT (jurisdiccion_id, fuero_id, nombre, nominacion) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Tipos de causa
-- -----------------------------------------------------------------------------
INSERT INTO tipo_causa (fuero_id, codigo, nombre)
SELECT f.id, v.codigo, v.nombre
FROM fuero f
JOIN (VALUES
        ('CIV_COM', 'ORDINARIO',      'Juicio ordinario'),
        ('CIV_COM', 'ABREVIADO',      'Juicio abreviado'),
        ('CIV_COM', 'EJECUTIVO',      'Juicio ejecutivo'),
        ('CIV_COM', 'DESALOJO',       'Desalojo'),
        ('CIV_COM', 'DANOS',          'Daños y perjuicios'),
        ('LABORAL', 'DESPIDO',        'Despido'),
        ('LABORAL', 'ACCIDENTE',      'Accidente de trabajo'),
        ('FAMILIA', 'ALIMENTOS',      'Alimentos'),
        ('FAMILIA', 'DIVORCIO',       'Divorcio'),
        ('FAMILIA', 'SUCESION',       'Declaratoria de herederos')
     ) AS v(fuero_codigo, codigo, nombre)
  ON v.fuero_codigo = f.codigo
ON CONFLICT (fuero_id, codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Estados de causa
-- -----------------------------------------------------------------------------
INSERT INTO estado_causa (codigo, nombre, es_final, orden) VALUES
    ('PREPARACION',  'En preparación',            FALSE, 1),
    ('EN_TRAMITE',   'En trámite',                FALSE, 2),
    ('PRUEBA',       'Etapa probatoria',          FALSE, 3),
    ('ALEGATOS',     'Alegatos',                  FALSE, 4),
    ('SENTENCIA',    'Con sentencia',             FALSE, 5),
    ('APELACION',    'En apelación',              FALSE, 6),
    ('EJECUCION',    'En ejecución de sentencia', FALSE, 7),
    ('ARCHIVADA',    'Archivada',                 TRUE,  8),
    ('DESISTIDA',    'Desistida',                 TRUE,  9),
    ('CONCILIADA',   'Conciliada',                TRUE, 10)
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Tipos de documento
-- -----------------------------------------------------------------------------
INSERT INTO tipo_documento (codigo, nombre) VALUES
    ('ESCRITO',     'Escrito judicial'),
    ('CEDULA',      'Cédula de notificación'),
    ('OFICIO',      'Oficio'),
    ('PRUEBA',      'Elemento de prueba'),
    ('SENTENCIA',   'Sentencia o resolución'),
    ('PERICIA',     'Informe pericial'),
    ('PODER',       'Poder / mandato'),
    ('CONTRATO',    'Contrato'),
    ('COMPROBANTE', 'Comprobante de pago'),
    ('OTRO',        'Otro')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Conceptos de costa
-- -----------------------------------------------------------------------------
INSERT INTO concepto_costa (codigo, nombre, descripcion) VALUES
    ('TASA_JUSTICIA',  'Tasa de justicia',         'Tributo por el servicio de justicia'),
    ('APORTE_LEY',     'Aporte ley',               'Aporte a la caja de abogados'),
    ('SELLADO',        'Sellado',                  'Sellado de actuación'),
    ('NOTIFICACION',   'Gastos de notificación',   'Cédulas, mandamientos, oficios'),
    ('HONORARIO_PERITO','Honorarios de perito',    'Honorarios de peritos intervinientes'),
    ('HONORARIO_PROF', 'Honorarios profesionales', 'Honorarios de los profesionales del estudio'),
    ('PUBLICACION',    'Edictos y publicaciones',  'Publicación de edictos'),
    ('INFORME',        'Informes y certificaciones','Registros, informes, certificados'),
    ('MOVILIDAD',      'Movilidad y diligencias',  'Traslados y diligencias fuera del estudio'),
    ('OTRO',           'Otros gastos',             'Gastos no encuadrados en los anteriores')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Tipos de plazo (reglas oficiales — estudio_id NULL)
--
-- articulo_referencia queda NULL: ver la ADVERTENCIA del encabezado. Cargar con
-- UPDATE una vez verificado el texto del CPCC de Córdoba (Ley 8465).
-- -----------------------------------------------------------------------------
INSERT INTO tipo_plazo (estudio_id, jurisdiccion_id, fuero_id, codigo, nombre,
                        cantidad_dias, computo, articulo_referencia, prorrogable)
SELECT NULL, j.id, f.id, v.codigo, v.nombre, v.dias, v.computo, NULL, v.prorrogable
FROM jurisdiccion j
JOIN fuero f ON f.jurisdiccion_id = j.id
JOIN (VALUES
        ('CIV_COM', 'CONTESTAR_DEMANDA_ORD', 'Contestar demanda (ordinario)',     10, 'HABIL',   FALSE),
        ('CIV_COM', 'CONTESTAR_DEMANDA_ABR', 'Contestar demanda (abreviado)',      6, 'HABIL',   FALSE),
        ('CIV_COM', 'OPONER_EXCEPCIONES',    'Oponer excepciones',                 6, 'HABIL',   FALSE),
        ('CIV_COM', 'APELAR_SENTENCIA',      'Interponer recurso de apelación',    5, 'HABIL',   FALSE),
        ('CIV_COM', 'EXPRESAR_AGRAVIOS',     'Expresar agravios',                 10, 'HABIL',   FALSE),
        ('CIV_COM', 'OFRECER_PRUEBA',        'Ofrecer prueba',                    10, 'HABIL',   TRUE),
        ('CIV_COM', 'RECURSO_REPOSICION',    'Recurso de reposición',              3, 'HABIL',   FALSE),
        ('CIV_COM', 'CADUCIDAD_INSTANCIA',   'Caducidad de instancia',            12, 'CORRIDO', FALSE),
        ('LABORAL', 'CONTESTAR_DEMANDA_LAB', 'Contestar demanda laboral',         10, 'HABIL',   FALSE),
        ('FAMILIA', 'CONTESTAR_TRASLADO_FAM','Contestar traslado (familia)',       6, 'HABIL',   FALSE)
     ) AS v(fuero_codigo, codigo, nombre, dias, computo, prorrogable)
  ON v.fuero_codigo = f.codigo
WHERE j.codigo = 'AR-X';

-- -----------------------------------------------------------------------------
-- Días inhábiles — feriados nacionales de fecha fija
-- -----------------------------------------------------------------------------
INSERT INTO dia_inhabil (jurisdiccion_id, estudio_id, fecha, tipo, motivo)
SELECT j.id, NULL, v.fecha::date, 'FERIADO_NACIONAL', v.motivo
FROM jurisdiccion j,
     (VALUES
        ('2026-01-01', 'Año Nuevo'),
        ('2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia'),
        ('2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'),
        ('2026-05-01', 'Día del Trabajador'),
        ('2026-05-25', 'Día de la Revolución de Mayo'),
        ('2026-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano'),
        ('2026-07-09', 'Día de la Independencia'),
        ('2026-12-08', 'Inmaculada Concepción de María'),
        ('2026-12-25', 'Navidad')
     ) AS v(fecha, motivo)
WHERE j.codigo = 'AR-X'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Días inhábiles — feriados de fecha movible (derivados de la Pascua 2026:
-- domingo 5 de abril). Verificar el resto contra el decreto anual.
-- -----------------------------------------------------------------------------
INSERT INTO dia_inhabil (jurisdiccion_id, estudio_id, fecha, tipo, motivo)
SELECT j.id, NULL, v.fecha::date, 'FERIADO_NACIONAL', v.motivo
FROM jurisdiccion j,
     (VALUES
        ('2026-02-16', 'Carnaval'),
        ('2026-02-17', 'Carnaval'),
        ('2026-04-03', 'Viernes Santo')
     ) AS v(fecha, motivo)
WHERE j.codigo = 'AR-X'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Feria judicial de enero — el mes completo, generado con generate_series en
-- lugar de 31 filas escritas a mano.
-- -----------------------------------------------------------------------------
INSERT INTO dia_inhabil (jurisdiccion_id, estudio_id, fecha, tipo, motivo)
SELECT j.id, NULL, d::date, 'FERIA_JUDICIAL', 'Feria judicial de enero'
FROM jurisdiccion j,
     generate_series('2026-01-02'::date, '2026-01-31'::date, INTERVAL '1 day') AS d
WHERE j.codigo = 'AR-X'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Feria judicial de julio — ventana habitual. Confirmar contra el Acuerdo
-- Reglamentario del TSJ del año en curso.
-- -----------------------------------------------------------------------------
INSERT INTO dia_inhabil (jurisdiccion_id, estudio_id, fecha, tipo, motivo)
SELECT j.id, NULL, d::date, 'FERIA_JUDICIAL', 'Feria judicial de julio'
FROM jurisdiccion j,
     generate_series('2026-07-01'::date, '2026-07-15'::date, INTERVAL '1 day') AS d
WHERE j.codigo = 'AR-X'
  AND d::date <> '2026-07-09'::date   -- ya cargado como feriado nacional
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
INSERT INTO rol (codigo, nombre, descripcion, jerarquia) VALUES
    ('SUPER_ADMIN',  'Super Administrador', 'Opera la plataforma. No pertenece a ningún estudio.', 1),
    ('ADMIN',        'Administrador',       'Administra un estudio: usuarios, configuración y catálogos propios.', 2),
    ('JEFE_ESTUDIO', 'Jefe de Estudio',     'Gestiona causas, plazos y costas del estudio; delega tareas.', 3),
    ('EMPLEADO',     'Empleado',            'Opera sobre las causas en las que está asignado.', 4)
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Permisos — un par (módulo, acción) por operación sensible.
-- -----------------------------------------------------------------------------
INSERT INTO permiso (codigo, modulo, accion, descripcion)
SELECT m.modulo || '.' || a.accion, m.modulo, a.accion,
       'Permite ' || a.accion || ' en el módulo ' || m.modulo
FROM (VALUES
        ('causa'), ('persona'), ('documento'), ('plazo'), ('calendario'),
        ('alerta'), ('costa'), ('plantilla'), ('tarea'), ('usuario'),
        ('auditoria'), ('configuracion'), ('ia')
     ) AS m(modulo),
     (VALUES ('ver'), ('crear'), ('editar'), ('eliminar'), ('exportar')) AS a(accion)
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Asignación de permisos por rol
-- -----------------------------------------------------------------------------

-- SUPER_ADMIN y ADMIN: todos los permisos.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r, permiso p
WHERE r.codigo IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

-- JEFE_ESTUDIO: todo salvo la administración de usuarios y la configuración.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r, permiso p
WHERE r.codigo = 'JEFE_ESTUDIO'
  AND p.modulo NOT IN ('usuario', 'configuracion')
ON CONFLICT DO NOTHING;

-- EMPLEADO: opera el día a día, pero no elimina ni ve la auditoría.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r, permiso p
WHERE r.codigo = 'EMPLEADO'
  AND p.modulo NOT IN ('usuario', 'configuracion', 'auditoria')
  AND p.accion NOT IN ('eliminar')
ON CONFLICT DO NOTHING;
