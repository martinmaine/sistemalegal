-- =============================================================================
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


-- ####  001_extensiones_y_funciones.sql  #############################

-- =============================================================================
-- 001 — Extensiones y funciones compartidas
-- Sistema de Gestión Integral para Estudios Jurídicos
-- =============================================================================

-- gen_random_uuid() es nativo desde PostgreSQL 13; pgcrypto lo provee en versiones
-- anteriores y aporta funciones de hash usadas para tokens.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Búsqueda de texto insensible a tildes sobre el texto extraído de los PDF.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- -----------------------------------------------------------------------------
-- Mantiene actualizado_en en cada UPDATE. Se asocia por trigger a toda tabla
-- que declare esa columna, para no repetir la lógica en la capa de aplicación.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_actualizar_timestamp() IS
    'Trigger BEFORE UPDATE: refresca la columna actualizado_en.';

-- -----------------------------------------------------------------------------
-- Normaliza texto quitando tildes y diacríticos, para la búsqueda documental.
--
-- Por qué existe esta envoltura: el diccionario español de PostgreSQL reduce
-- 'NOTIFICACIÓN' al lexema 'notif', pero 'NOTIFICACION' sin tilde no la
-- reconoce y la deja entera como 'notificacion'. Son lexemas distintos, así que
-- quien busque sin tildes —lo normal en un buscador— no encontraría el
-- documento. Normalizar ambos lados resuelve el problema.
--
-- No se puede usar unaccent() directamente en un índice: está declarada STABLE
-- porque depende del diccionario que se le pase. Fijando el diccionario de forma
-- explícita, el resultado sí es determinista y la envoltura puede declararse
-- IMMUTABLE, que es lo que exige un índice de expresión.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sin_acentos(texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
    -- Dos detalles que hacen falta para que esto funcione dentro de un índice:
    --
    --  1. El cast a regdictionary es obligatorio: sin él el literal llega como
    --     'unknown' y PostgreSQL no resuelve la variante de dos argumentos.
    --  2. Tanto la función como el diccionario van calificados con su esquema.
    --     Al construir un índice de expresión PostgreSQL restringe el
    --     search_path, así que un 'unaccent' a secas no se encuentra y la
    --     creación del índice falla.
    SELECT public.unaccent('public.unaccent'::regdictionary, texto);
$$;

COMMENT ON FUNCTION fn_sin_acentos(TEXT) IS
    'Quita tildes y diacríticos. IMMUTABLE para poder usarse en índices. '
    'La aplicación debe aplicarla también al término buscado.';

-- ####  002_catalogos_juridicos.sql  #################################

-- =============================================================================
-- 002 — Catálogos jurídicos (independientes del inquilino)
--
-- Estas tablas modelan la estructura del Poder Judicial y las clasificaciones
-- procesales. NO llevan estudio_id: son datos de referencia compartidos por
-- todos los estudios. Mantenerlos como DATOS y no como constantes en el código
-- es lo que habilita configurar otra provincia sin recompilar (propuesta §3.1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- jurisdiccion — provincia / ámbito federal. El MVP se valida solo con Córdoba.
-- -----------------------------------------------------------------------------
CREATE TABLE jurisdiccion (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      VARCHAR(10)  NOT NULL UNIQUE,
    nombre      VARCHAR(100) NOT NULL,
    pais        VARCHAR(50)  NOT NULL DEFAULT 'Argentina',
    activa      BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE jurisdiccion IS
    'Provincia o ámbito federal. Raíz de la configuración multi-provincia.';
COMMENT ON COLUMN jurisdiccion.codigo IS 'Código ISO 3166-2, p. ej. AR-X para Córdoba.';

-- -----------------------------------------------------------------------------
-- fuero — Civil y Comercial, Laboral, Familia, Penal...
-- -----------------------------------------------------------------------------
CREATE TABLE fuero (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiccion_id  UUID NOT NULL REFERENCES jurisdiccion(id) ON DELETE RESTRICT,
    codigo           VARCHAR(20)  NOT NULL,
    nombre           VARCHAR(100) NOT NULL,
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_fuero_jurisdiccion_codigo UNIQUE (jurisdiccion_id, codigo)
);

CREATE INDEX ix_fuero_jurisdiccion ON fuero (jurisdiccion_id);

-- -----------------------------------------------------------------------------
-- tribunal — juzgado o cámara concreta donde tramita la causa.
-- -----------------------------------------------------------------------------
CREATE TABLE tribunal (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiccion_id  UUID NOT NULL REFERENCES jurisdiccion(id) ON DELETE RESTRICT,
    fuero_id         UUID NOT NULL REFERENCES fuero(id)        ON DELETE RESTRICT,
    nombre           VARCHAR(200) NOT NULL,
    nominacion       VARCHAR(50),
    circunscripcion  VARCHAR(100),
    sede             VARCHAR(100),
    domicilio        VARCHAR(200),
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_tribunal_identidad
        UNIQUE (jurisdiccion_id, fuero_id, nombre, nominacion)
);

CREATE INDEX ix_tribunal_fuero ON tribunal (fuero_id);

COMMENT ON COLUMN tribunal.nominacion IS
    'Nominación del juzgado (1.ª, 2.ª, ...), tal como la usa el fuero en Córdoba.';

-- -----------------------------------------------------------------------------
-- tipo_causa — materia u objeto del juicio, dependiente del fuero.
-- -----------------------------------------------------------------------------
CREATE TABLE tipo_causa (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fuero_id   UUID NOT NULL REFERENCES fuero(id) ON DELETE RESTRICT,
    codigo     VARCHAR(30)  NOT NULL,
    nombre     VARCHAR(150) NOT NULL,
    activo     BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_tipo_causa_fuero_codigo UNIQUE (fuero_id, codigo)
);

-- -----------------------------------------------------------------------------
-- estado_causa — ciclo de vida procesal. es_final marca los estados terminales.
-- -----------------------------------------------------------------------------
CREATE TABLE estado_causa (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo     VARCHAR(30)  NOT NULL UNIQUE,
    nombre     VARCHAR(100) NOT NULL,
    es_final   BOOLEAN      NOT NULL DEFAULT FALSE,
    orden      SMALLINT     NOT NULL DEFAULT 0,
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON COLUMN estado_causa.es_final IS
    'TRUE en estados que cierran la causa (archivada, desistida, sentencia firme).';

-- -----------------------------------------------------------------------------
-- tipo_documento — clasificación del repositorio documental.
-- -----------------------------------------------------------------------------
CREATE TABLE tipo_documento (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo     VARCHAR(30)  NOT NULL UNIQUE,
    nombre     VARCHAR(100) NOT NULL,
    activo     BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- concepto_costa — naturaleza del gasto procesal (tasa, aporte, sellado...).
-- -----------------------------------------------------------------------------
CREATE TABLE concepto_costa (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo       VARCHAR(30)  NOT NULL UNIQUE,
    nombre       VARCHAR(100) NOT NULL,
    descripcion  VARCHAR(300),
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ####  003_tenencia_y_seguridad.sql  ################################

-- =============================================================================
-- 003 — Tenencia (multi-estudio) y seguridad
--
-- estudio es la raíz del inquilino: toda tabla de negocio cuelga de ella a
-- través de estudio_id. usuario.estudio_id es NULL únicamente para el rol
-- SUPER_ADMIN, que opera la plataforma y no pertenece a ningún estudio.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- estudio — el inquilino (tenant).
-- -----------------------------------------------------------------------------
CREATE TABLE estudio (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social     VARCHAR(150) NOT NULL,
    nombre_fantasia  VARCHAR(150),
    cuit             VARCHAR(13)  NOT NULL UNIQUE,
    email_contacto   VARCHAR(150),
    telefono         VARCHAR(30),
    domicilio        VARCHAR(200),
    jurisdiccion_id  UUID NOT NULL REFERENCES jurisdiccion(id) ON DELETE RESTRICT,
    activo           BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_estudio_cuit_formato CHECK (cuit ~ '^[0-9]{2}-[0-9]{8}-[0-9]$')
);

CREATE TRIGGER tg_estudio_actualizado
    BEFORE UPDATE ON estudio
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON TABLE estudio IS
    'Inquilino del sistema. Su jurisdicción determina qué calendario de días '
    'inhábiles y qué catálogo de tribunales ve por defecto.';

-- -----------------------------------------------------------------------------
-- rol — los cuatro roles jerárquicos declarados en la propuesta (§3.3).
-- -----------------------------------------------------------------------------
CREATE TABLE rol (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo       VARCHAR(20)  NOT NULL UNIQUE,
    nombre       VARCHAR(60)  NOT NULL,
    descripcion  VARCHAR(300),
    jerarquia    SMALLINT     NOT NULL,
    creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_rol_codigo CHECK (
        codigo IN ('SUPER_ADMIN', 'ADMIN', 'JEFE_ESTUDIO', 'EMPLEADO')
    )
);

COMMENT ON COLUMN rol.jerarquia IS
    'Menor número = más privilegios. Permite comparaciones de nivel sin '
    'codificar los nombres de rol en la aplicación.';

-- -----------------------------------------------------------------------------
-- permiso — unidad granular de autorización, con formato modulo.accion.
-- -----------------------------------------------------------------------------
CREATE TABLE permiso (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo       VARCHAR(60)  NOT NULL UNIQUE,
    modulo       VARCHAR(40)  NOT NULL,
    accion       VARCHAR(40)  NOT NULL,
    descripcion  VARCHAR(300),
    creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_permiso_modulo ON permiso (modulo);

COMMENT ON COLUMN permiso.codigo IS 'Formato modulo.accion, p. ej. causa.eliminar.';

-- -----------------------------------------------------------------------------
-- rol_permiso — N:M. Es lo que hace granulares los permisos: cambiar qué puede
-- hacer un rol es un INSERT/DELETE, no un cambio de código.
-- -----------------------------------------------------------------------------
CREATE TABLE rol_permiso (
    rol_id      UUID NOT NULL REFERENCES rol(id)     ON DELETE CASCADE,
    permiso_id  UUID NOT NULL REFERENCES permiso(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

-- -----------------------------------------------------------------------------
-- usuario — integrante del estudio (o Super Admin de la plataforma).
-- -----------------------------------------------------------------------------
CREATE TABLE usuario (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id        UUID REFERENCES estudio(id) ON DELETE RESTRICT,
    rol_id            UUID NOT NULL REFERENCES rol(id) ON DELETE RESTRICT,
    email             VARCHAR(150) NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    nombre            VARCHAR(80)  NOT NULL,
    apellido          VARCHAR(80)  NOT NULL,
    matricula         VARCHAR(50),
    telefono          VARCHAR(30),
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acceso_en  TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_usuario_email_formato CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- El login es global, por eso la unicidad del email no se acota al estudio.
CREATE UNIQUE INDEX uq_usuario_email ON usuario (lower(email));
CREATE INDEX ix_usuario_estudio ON usuario (estudio_id);

CREATE TRIGGER tg_usuario_actualizado
    BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON COLUMN usuario.matricula IS
    'Matrícula profesional. Obligatoria de hecho para abogados, opcional para '
    'personal administrativo, por eso no se restringe en la base.';

-- -----------------------------------------------------------------------------
-- Regla de ámbito: SUPER_ADMIN no pertenece a ningún estudio; cualquier otro
-- rol debe pertenecer a uno. No se puede expresar con un CHECK porque el dato
-- que decide (rol.codigo) vive en otra tabla, así que se valida con trigger.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_ambito_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_codigo_rol VARCHAR(20);
BEGIN
    SELECT codigo INTO v_codigo_rol FROM rol WHERE id = NEW.rol_id;

    IF v_codigo_rol = 'SUPER_ADMIN' AND NEW.estudio_id IS NOT NULL THEN
        RAISE EXCEPTION 'Un SUPER_ADMIN no puede pertenecer a un estudio';
    END IF;

    IF v_codigo_rol <> 'SUPER_ADMIN' AND NEW.estudio_id IS NULL THEN
        RAISE EXCEPTION 'El rol % requiere estudio_id', v_codigo_rol;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tg_usuario_ambito
    BEFORE INSERT OR UPDATE OF rol_id, estudio_id ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_validar_ambito_usuario();

-- -----------------------------------------------------------------------------
-- refresh_token — permite revocar sesiones. Se guarda el HASH del token, nunca
-- el token en claro: si se filtra la base, los tokens no son reutilizables.
-- -----------------------------------------------------------------------------
CREATE TABLE refresh_token (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    token_hash   CHAR(64)    NOT NULL UNIQUE,
    emitido_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en    TIMESTAMPTZ NOT NULL,
    revocado_en  TIMESTAMPTZ,
    ip           INET,
    user_agent   VARCHAR(300),
    CONSTRAINT ck_refresh_token_vigencia CHECK (expira_en > emitido_en)
);

CREATE INDEX ix_refresh_token_usuario ON refresh_token (usuario_id)
    WHERE revocado_en IS NULL;

COMMENT ON COLUMN refresh_token.token_hash IS 'SHA-256 en hexadecimal del refresh token.';

-- ####  004_causas.sql  ##############################################

-- =============================================================================
-- 004 — Módulo Causas
--
-- Decisión de modelado: persona es una entidad REUTILIZABLE del estudio, no un
-- dato embebido en la causa. La misma persona puede ser demandada en una causa
-- y cliente en otra; el carácter procesal es una propiedad del VÍNCULO
-- (parte_causa), no de la persona.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- persona — física o jurídica. Agenda única de partes y clientes del estudio.
-- -----------------------------------------------------------------------------
CREATE TABLE persona (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id         UUID NOT NULL REFERENCES estudio(id) ON DELETE RESTRICT,
    tipo_persona       VARCHAR(10)  NOT NULL,
    nombre             VARCHAR(80),
    apellido           VARCHAR(80),
    razon_social       VARCHAR(150),
    tipo_documento     VARCHAR(10),
    numero_documento   VARCHAR(20),
    cuit_cuil          VARCHAR(13),
    email              VARCHAR(150),
    telefono           VARCHAR(30),
    domicilio          VARCHAR(200),
    localidad          VARCHAR(100),
    provincia          VARCHAR(100),
    observaciones      TEXT,
    eliminado_en       TIMESTAMPTZ,
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_persona_tipo CHECK (tipo_persona IN ('FISICA', 'JURIDICA')),
    CONSTRAINT ck_persona_tipo_documento CHECK (
        tipo_documento IS NULL OR
        tipo_documento IN ('DNI', 'LC', 'LE', 'CI', 'PASAPORTE', 'CUIT', 'CUIL')
    ),
    -- Una persona física necesita nombre y apellido; una jurídica, razón social.
    CONSTRAINT ck_persona_identificacion CHECK (
        (tipo_persona = 'FISICA'   AND nombre IS NOT NULL AND apellido IS NOT NULL)
     OR (tipo_persona = 'JURIDICA' AND razon_social IS NOT NULL)
    )
);

-- Un mismo documento no puede repetirse dentro del estudio entre personas vivas.
CREATE UNIQUE INDEX uq_persona_documento
    ON persona (estudio_id, tipo_documento, numero_documento)
    WHERE eliminado_en IS NULL AND numero_documento IS NOT NULL;

CREATE INDEX ix_persona_estudio ON persona (estudio_id) WHERE eliminado_en IS NULL;

CREATE TRIGGER tg_persona_actualizado
    BEFORE UPDATE ON persona
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- -----------------------------------------------------------------------------
-- causa — el expediente. Entidad central del sistema.
-- -----------------------------------------------------------------------------
CREATE TABLE causa (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id         UUID NOT NULL REFERENCES estudio(id)      ON DELETE RESTRICT,
    numero_expediente  VARCHAR(50),
    caratula           VARCHAR(300) NOT NULL,
    tribunal_id        UUID REFERENCES tribunal(id)              ON DELETE RESTRICT,
    fuero_id           UUID NOT NULL REFERENCES fuero(id)        ON DELETE RESTRICT,
    tipo_causa_id      UUID REFERENCES tipo_causa(id)            ON DELETE RESTRICT,
    estado_causa_id    UUID NOT NULL REFERENCES estado_causa(id) ON DELETE RESTRICT,
    fecha_inicio       DATE NOT NULL,
    fecha_cierre       DATE,
    monto_reclamado    NUMERIC(14,2),
    moneda             CHAR(3) NOT NULL DEFAULT 'ARS',
    observaciones      TEXT,
    creado_por         UUID REFERENCES usuario(id) ON DELETE SET NULL,
    eliminado_en       TIMESTAMPTZ,
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_causa_fechas CHECK (fecha_cierre IS NULL OR fecha_cierre >= fecha_inicio),
    CONSTRAINT ck_causa_monto  CHECK (monto_reclamado IS NULL OR monto_reclamado >= 0)
);

-- El número de expediente es único dentro del estudio, pero puede faltar
-- mientras la causa está en preparación (todavía sin radicar).
CREATE UNIQUE INDEX uq_causa_expediente
    ON causa (estudio_id, numero_expediente)
    WHERE eliminado_en IS NULL AND numero_expediente IS NOT NULL;

CREATE INDEX ix_causa_estudio_estado ON causa (estudio_id, estado_causa_id)
    WHERE eliminado_en IS NULL;
CREATE INDEX ix_causa_tribunal ON causa (tribunal_id);

CREATE TRIGGER tg_causa_actualizado
    BEFORE UPDATE ON causa
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON COLUMN causa.caratula IS
    'Carátula del expediente, tal como la registra el tribunal.';

-- -----------------------------------------------------------------------------
-- parte_causa — vínculo persona <-> causa con su carácter procesal.
-- -----------------------------------------------------------------------------
CREATE TABLE parte_causa (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    causa_id       UUID NOT NULL REFERENCES causa(id)   ON DELETE CASCADE,
    persona_id     UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    caracter       VARCHAR(20) NOT NULL,
    es_cliente     BOOLEAN     NOT NULL DEFAULT FALSE,
    fecha_alta     DATE        NOT NULL DEFAULT CURRENT_DATE,
    observaciones  VARCHAR(300),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_parte_caracter CHECK (
        caracter IN ('ACTOR', 'DEMANDADO', 'CODEMANDADO', 'TERCERO', 'PERITO', 'TESTIGO')
    ),
    CONSTRAINT uq_parte_causa UNIQUE (causa_id, persona_id, caracter)
);

CREATE INDEX ix_parte_causa_causa   ON parte_causa (causa_id);
CREATE INDEX ix_parte_causa_persona ON parte_causa (persona_id);

COMMENT ON COLUMN parte_causa.es_cliente IS
    'TRUE si esta parte es el cliente del estudio en esta causa. El estudio '
    'puede representar al actor en un expediente y al demandado en otro.';

-- -----------------------------------------------------------------------------
-- profesional_causa — quiénes del estudio trabajan la causa y con qué rol
-- procesal. Es la base del filtro "mis causas" y de la delegación de tareas.
-- -----------------------------------------------------------------------------
CREATE TABLE profesional_causa (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    causa_id           UUID NOT NULL REFERENCES causa(id)   ON DELETE CASCADE,
    usuario_id         UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    rol_en_causa       VARCHAR(20) NOT NULL,
    fecha_asignacion   DATE        NOT NULL DEFAULT CURRENT_DATE,
    fecha_baja         DATE,
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_profesional_rol CHECK (
        rol_en_causa IN ('TITULAR', 'PATROCINANTE', 'APODERADO', 'COLABORADOR')
    ),
    CONSTRAINT ck_profesional_fechas CHECK (
        fecha_baja IS NULL OR fecha_baja >= fecha_asignacion
    )
);

-- Un profesional no puede estar asignado dos veces a la vez en la misma causa.
CREATE UNIQUE INDEX uq_profesional_causa_activo
    ON profesional_causa (causa_id, usuario_id)
    WHERE fecha_baja IS NULL;

CREATE INDEX ix_profesional_causa_usuario ON profesional_causa (usuario_id)
    WHERE fecha_baja IS NULL;

-- -----------------------------------------------------------------------------
-- movimiento_causa — historial procesal del expediente.
--
-- Riesgo R1 de la propuesta: el Poder Judicial de Córdoba no ofrece API pública
-- de lectura, por eso origen distingue la carga manual de una importación.
-- Cuando exista integración automática se agrega el valor 'SINCRONIZACION' al
-- CHECK, sin migrar datos existentes.
-- -----------------------------------------------------------------------------
CREATE TABLE movimiento_causa (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    causa_id             UUID NOT NULL REFERENCES causa(id) ON DELETE CASCADE,
    fecha                DATE NOT NULL,
    tipo                 VARCHAR(100),
    descripcion          TEXT NOT NULL,
    origen               VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    referencia_externa   VARCHAR(100),
    registrado_por       UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_movimiento_origen CHECK (origen IN ('MANUAL', 'IMPORTACION'))
);

CREATE INDEX ix_movimiento_causa_fecha ON movimiento_causa (causa_id, fecha DESC);

-- ####  005_documentos.sql  ##########################################

-- =============================================================================
-- 005 — Módulo Documentos
--
-- Decisión de modelado: el texto extraído del PDF vive en una tabla APARTE
-- (documento_texto) en relación 1:1 con documento. Motivos:
--   1. Es un campo potencialmente de megabytes que casi nunca se necesita al
--      listar documentos; separarlo evita que Postgres lo cargue de más.
--   2. La extracción es asíncrona (la hace el microservicio Python), así que su
--      resultado tiene su propio ciclo de vida y su propio estado de error.
--
-- El archivo binario NO se guarda en la base: en la tabla va la ruta al
-- almacenamiento de objetos. La base guarda metadatos, no blobs.
-- =============================================================================

CREATE TABLE documento (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id          UUID NOT NULL REFERENCES estudio(id)        ON DELETE RESTRICT,
    causa_id            UUID NOT NULL REFERENCES causa(id)          ON DELETE CASCADE,
    tipo_documento_id   UUID REFERENCES tipo_documento(id)          ON DELETE RESTRICT,
    nombre_archivo      VARCHAR(255) NOT NULL,
    nombre_original     VARCHAR(255) NOT NULL,
    mime_type           VARCHAR(100) NOT NULL,
    tamano_bytes        BIGINT       NOT NULL,
    ruta_almacenamiento VARCHAR(500) NOT NULL,
    hash_sha256         CHAR(64)     NOT NULL,
    estado_extraccion   VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE',
    descripcion         VARCHAR(300),
    subido_por          UUID REFERENCES usuario(id) ON DELETE SET NULL,
    fecha_subida        TIMESTAMPTZ NOT NULL DEFAULT now(),
    eliminado_en        TIMESTAMPTZ,

    CONSTRAINT ck_documento_tamano CHECK (tamano_bytes > 0),
    CONSTRAINT ck_documento_estado_extraccion CHECK (
        estado_extraccion IN ('NO_APLICA', 'PENDIENTE', 'PROCESANDO', 'COMPLETADA', 'ERROR')
    )
);

-- Evita subir dos veces el mismo archivo al mismo estudio: el hash identifica
-- el contenido, no el nombre.
CREATE UNIQUE INDEX uq_documento_hash
    ON documento (estudio_id, hash_sha256)
    WHERE eliminado_en IS NULL;

CREATE INDEX ix_documento_causa ON documento (causa_id) WHERE eliminado_en IS NULL;

-- Índice para que el worker de extracción encuentre su cola de trabajo.
CREATE INDEX ix_documento_pendiente_extraccion
    ON documento (estado_extraccion, fecha_subida)
    WHERE estado_extraccion IN ('PENDIENTE', 'ERROR');

COMMENT ON COLUMN documento.estado_extraccion IS
    'NO_APLICA para archivos que no son PDF. El resto es la cola del '
    'microservicio de extracción.';
COMMENT ON COLUMN documento.ruta_almacenamiento IS
    'Clave del objeto en el almacenamiento de archivos. La base nunca guarda '
    'el binario.';

-- -----------------------------------------------------------------------------
-- documento_texto — resultado de la extracción PDF -> texto.
-- -----------------------------------------------------------------------------
CREATE TABLE documento_texto (
    documento_id       UUID PRIMARY KEY REFERENCES documento(id) ON DELETE CASCADE,
    texto              TEXT,
    cantidad_paginas   INTEGER,
    motor_extraccion   VARCHAR(50) NOT NULL DEFAULT 'pdfplumber',
    fecha_extraccion   TIMESTAMPTZ NOT NULL DEFAULT now(),
    mensaje_error      TEXT,

    CONSTRAINT ck_documento_texto_paginas CHECK (
        cantidad_paginas IS NULL OR cantidad_paginas > 0
    )
);

-- Búsqueda de texto completo en español sobre el contenido de los PDF.
-- Es un índice de expresión: no requiere una columna tsvector materializada.
--
-- El texto se normaliza con fn_sin_acentos (ver migración 001) porque el
-- diccionario español genera lexemas distintos para 'NOTIFICACIÓN' y
-- 'NOTIFICACION', y nadie escribe tildes en un buscador.
--
-- IMPORTANTE para el módulo de documentos: la consulta debe normalizarse igual,
--     WHERE to_tsvector('spanish', fn_sin_acentos(texto))
--           @@ to_tsquery('spanish', fn_sin_acentos(:termino))
-- o el índice no se usa y la búsqueda vuelve a fallar con las tildes.
CREATE INDEX ix_documento_texto_busqueda
    ON documento_texto
    USING GIN (to_tsvector('spanish', fn_sin_acentos(coalesce(texto, ''))));

COMMENT ON TABLE documento_texto IS
    'Texto plano extraído por el microservicio Python. Relación 1:1 con '
    'documento; se separa por tamaño y por tener ciclo de vida asíncrono.';

-- ####  006_plazos_y_calendario.sql  #################################

-- =============================================================================
-- 006 — Módulo Plazos y Calendario
--
-- Núcleo del valor del sistema y objetivo específico n.º 2 de la propuesta.
--
-- Arquitectura del cómputo (mitigación del riesgo R3):
--   * tipo_plazo   = la REGLA (cuántos días, hábiles o corridos, qué artículo).
--   * dia_inhabil  = el CALENDARIO (feriados, feria judicial, asuetos).
--   * plazo        = la INSTANCIA aplicada a una causa concreta.
--
-- El algoritmo de cómputo vive en el backend TypeScript, no en la base: debe
-- ser testeable con los 10+ casos de prueba que exige la propuesta. La base
-- guarda el resultado y los insumos que lo justifican, de modo que un recálculo
-- siempre sea reproducible y auditable.
--
-- Nada de esto está fijo en el código: agregar una provincia es insertar filas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tipo_plazo — catálogo de reglas procesales.
--
-- estudio_id NULL  => regla oficial, compartida por todos los estudios.
-- estudio_id != NULL => regla propia del estudio (plazos internos, recordatorios).
-- -----------------------------------------------------------------------------
CREATE TABLE tipo_plazo (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id            UUID REFERENCES estudio(id)      ON DELETE CASCADE,
    jurisdiccion_id       UUID NOT NULL REFERENCES jurisdiccion(id) ON DELETE RESTRICT,
    fuero_id              UUID REFERENCES fuero(id)        ON DELETE RESTRICT,
    codigo                VARCHAR(50)  NOT NULL,
    nombre                VARCHAR(150) NOT NULL,
    cantidad_dias         SMALLINT     NOT NULL,
    computo               VARCHAR(10)  NOT NULL,
    articulo_referencia   VARCHAR(100),
    prorrogable           BOOLEAN      NOT NULL DEFAULT FALSE,
    activo                BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en             TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_tipo_plazo_dias    CHECK (cantidad_dias > 0),
    CONSTRAINT ck_tipo_plazo_computo CHECK (computo IN ('HABIL', 'CORRIDO'))
);

-- Unicidad separada para reglas oficiales y reglas propias del estudio:
-- un índice único ordinario trataría los NULL como distintos entre sí.
CREATE UNIQUE INDEX uq_tipo_plazo_oficial
    ON tipo_plazo (jurisdiccion_id, codigo)
    WHERE estudio_id IS NULL;

CREATE UNIQUE INDEX uq_tipo_plazo_estudio
    ON tipo_plazo (estudio_id, codigo)
    WHERE estudio_id IS NOT NULL;

COMMENT ON COLUMN tipo_plazo.articulo_referencia IS
    'Norma que funda el plazo, p. ej. el artículo del CPCC de Córdoba. Permite '
    'justificar el cómputo ante el cliente y ante el tribunal.';
COMMENT ON COLUMN tipo_plazo.computo IS
    'HABIL descuenta sábados, domingos y los dia_inhabil de la jurisdicción. '
    'CORRIDO cuenta todos los días del calendario.';

-- -----------------------------------------------------------------------------
-- dia_inhabil — el calendario configurable. Requisito explícito de la propuesta:
-- "mantener los días inhábiles como dato configurable, nunca fijo en el código".
--
-- estudio_id NULL  => inhábil oficial de la jurisdicción (feriado, feria).
-- estudio_id != NULL => inhábil propio del estudio (asueto interno).
-- -----------------------------------------------------------------------------
CREATE TABLE dia_inhabil (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiccion_id   UUID NOT NULL REFERENCES jurisdiccion(id) ON DELETE RESTRICT,
    estudio_id        UUID REFERENCES estudio(id) ON DELETE CASCADE,
    fecha             DATE         NOT NULL,
    tipo              VARCHAR(25)  NOT NULL,
    motivo            VARCHAR(200) NOT NULL,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_dia_inhabil_tipo CHECK (
        tipo IN ('FERIADO_NACIONAL', 'FERIADO_PROVINCIAL', 'FERIA_JUDICIAL',
                 'ASUETO', 'OTRO')
    )
);

CREATE UNIQUE INDEX uq_dia_inhabil_oficial
    ON dia_inhabil (jurisdiccion_id, fecha)
    WHERE estudio_id IS NULL;

CREATE UNIQUE INDEX uq_dia_inhabil_estudio
    ON dia_inhabil (estudio_id, fecha)
    WHERE estudio_id IS NOT NULL;

-- El motor de cómputo consulta por rango de fechas dentro de una jurisdicción.
CREATE INDEX ix_dia_inhabil_busqueda ON dia_inhabil (jurisdiccion_id, fecha);

COMMENT ON TABLE dia_inhabil IS
    'Calendario de días no laborables judiciales. La feria judicial se carga '
    'como una fila por día, de modo que el motor de cómputo use una sola regla.';

-- -----------------------------------------------------------------------------
-- plazo — instancia concreta sobre una causa.
--
-- Se guardan a la vez los INSUMOS del cálculo (fecha de notificación, días,
-- tipo de cómputo) y su RESULTADO (fecha_vencimiento). Guardar solo el
-- resultado impediría auditar cómo se llegó a él; guardar solo los insumos
-- obligaría a recalcular en cada consulta y a depender de que el calendario
-- histórico nunca cambie.
-- -----------------------------------------------------------------------------
CREATE TABLE plazo (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id                  UUID NOT NULL REFERENCES estudio(id)   ON DELETE RESTRICT,
    causa_id                    UUID NOT NULL REFERENCES causa(id)     ON DELETE CASCADE,
    tipo_plazo_id               UUID REFERENCES tipo_plazo(id)         ON DELETE RESTRICT,
    descripcion                 VARCHAR(300) NOT NULL,
    fecha_notificacion          DATE     NOT NULL,
    fecha_inicio_computo        DATE     NOT NULL,
    cantidad_dias               SMALLINT NOT NULL,
    computo                     VARCHAR(10) NOT NULL,
    fecha_vencimiento           DATE     NOT NULL,
    fecha_vencimiento_original  DATE     NOT NULL,
    estado                      VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    responsable_id              UUID REFERENCES usuario(id) ON DELETE SET NULL,
    fecha_cumplimiento          DATE,
    observaciones               TEXT,
    creado_por                  UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_plazo_dias    CHECK (cantidad_dias > 0),
    CONSTRAINT ck_plazo_computo CHECK (computo IN ('HABIL', 'CORRIDO')),
    CONSTRAINT ck_plazo_estado  CHECK (
        estado IN ('PENDIENTE', 'CUMPLIDO', 'VENCIDO', 'SUSPENDIDO', 'CANCELADO')
    ),
    -- El cómputo empieza el día de la notificación o después, nunca antes.
    CONSTRAINT ck_plazo_inicio_computo CHECK (fecha_inicio_computo >= fecha_notificacion),
    CONSTRAINT ck_plazo_vencimiento    CHECK (fecha_vencimiento >= fecha_inicio_computo),
    -- Un plazo cumplido tiene que decir cuándo se cumplió.
    CONSTRAINT ck_plazo_cumplimiento CHECK (
        (estado = 'CUMPLIDO' AND fecha_cumplimiento IS NOT NULL)
     OR (estado <> 'CUMPLIDO')
    )
);

CREATE INDEX ix_plazo_causa ON plazo (causa_id);

-- Consulta central del sistema: "¿qué vence próximamente en este estudio?".
CREATE INDEX ix_plazo_vigilancia
    ON plazo (estudio_id, fecha_vencimiento)
    WHERE estado IN ('PENDIENTE', 'SUSPENDIDO');

CREATE INDEX ix_plazo_responsable ON plazo (responsable_id)
    WHERE estado = 'PENDIENTE';

CREATE TRIGGER tg_plazo_actualizado
    BEFORE UPDATE ON plazo
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON COLUMN plazo.fecha_inicio_computo IS
    'Primer día que efectivamente cuenta. Suele ser el día hábil siguiente a la '
    'notificación; se persiste porque la regla varía según el acto.';
COMMENT ON COLUMN plazo.fecha_vencimiento_original IS
    'Vencimiento del primer cálculo. Se conserva para poder mostrar el efecto '
    'de prórrogas y suspensiones sin perder el dato inicial.';
COMMENT ON COLUMN plazo.tipo_plazo_id IS
    'NULL cuando el usuario carga un plazo a medida que no responde a ninguna '
    'regla del catálogo.';

-- -----------------------------------------------------------------------------
-- plazo_suspension — tramos en que el plazo no corre (feria, suspensión
-- acordada, incidente). Es 1:N: un plazo puede suspenderse más de una vez.
-- -----------------------------------------------------------------------------
CREATE TABLE plazo_suspension (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plazo_id        UUID NOT NULL REFERENCES plazo(id) ON DELETE CASCADE,
    fecha_desde     DATE NOT NULL,
    fecha_hasta     DATE,
    motivo          VARCHAR(200) NOT NULL,
    registrado_por  UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_plazo_suspension_fechas CHECK (
        fecha_hasta IS NULL OR fecha_hasta >= fecha_desde
    )
);

CREATE INDEX ix_plazo_suspension_plazo ON plazo_suspension (plazo_id);

COMMENT ON COLUMN plazo_suspension.fecha_hasta IS
    'NULL mientras la suspensión sigue vigente y no tiene fecha de reanudación.';

-- -----------------------------------------------------------------------------
-- evento_calendario — calendario compartido del estudio.
--
-- Un vencimiento de plazo se refleja como evento (plazo_id), pero el calendario
-- también aloja audiencias y reuniones que no son plazos.
-- -----------------------------------------------------------------------------
CREATE TABLE evento_calendario (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id      UUID NOT NULL REFERENCES estudio(id) ON DELETE RESTRICT,
    causa_id        UUID REFERENCES causa(id) ON DELETE CASCADE,
    plazo_id        UUID REFERENCES plazo(id) ON DELETE CASCADE,
    titulo          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    tipo            VARCHAR(20)  NOT NULL,
    fecha_inicio    TIMESTAMPTZ  NOT NULL,
    fecha_fin       TIMESTAMPTZ  NOT NULL,
    todo_el_dia     BOOLEAN      NOT NULL DEFAULT FALSE,
    lugar           VARCHAR(200),
    creado_por      UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_evento_tipo CHECK (
        tipo IN ('AUDIENCIA', 'VENCIMIENTO', 'REUNION', 'OTRO')
    ),
    CONSTRAINT ck_evento_fechas CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX ix_evento_calendario_rango
    ON evento_calendario (estudio_id, fecha_inicio, fecha_fin);

CREATE TRIGGER tg_evento_calendario_actualizado
    BEFORE UPDATE ON evento_calendario
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- ####  007_alertas_y_notificaciones.sql  ############################

-- =============================================================================
-- 007 — Módulo Alertas y Notificaciones
--
-- Decisión de modelado: se separan tres conceptos que suelen confundirse.
--   regla_alerta  = la POLÍTICA   ("avisar 5 días antes, en nivel CRÍTICA").
--   alerta        = el HECHO      ("este plazo concreto dispara ese aviso").
--   notificacion  = la ENTREGA    ("a este usuario, por este canal").
--
-- Fusionarlas impediría avisar a varios responsables del mismo plazo con un
-- solo hecho de negocio, y haría imposible saber si un aviso se entregó pero
-- no se leyó.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- regla_alerta — configuración multinivel por estudio.
--
-- tipo_plazo_id NULL => regla general del estudio, aplica a todo plazo que no
-- tenga una regla específica para su tipo.
-- -----------------------------------------------------------------------------
CREATE TABLE regla_alerta (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id          UUID NOT NULL REFERENCES estudio(id)    ON DELETE CASCADE,
    tipo_plazo_id       UUID REFERENCES tipo_plazo(id)          ON DELETE CASCADE,
    dias_anticipacion   SMALLINT    NOT NULL,
    nivel               VARCHAR(12) NOT NULL,
    activa              BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_regla_alerta_dias CHECK (dias_anticipacion >= 0),
    CONSTRAINT ck_regla_alerta_nivel CHECK (
        nivel IN ('CRITICA', 'IMPORTANTE', 'INFORMATIVA')
    )
);

CREATE UNIQUE INDEX uq_regla_alerta_general
    ON regla_alerta (estudio_id, dias_anticipacion)
    WHERE tipo_plazo_id IS NULL;

CREATE UNIQUE INDEX uq_regla_alerta_por_tipo
    ON regla_alerta (estudio_id, tipo_plazo_id, dias_anticipacion)
    WHERE tipo_plazo_id IS NOT NULL;

COMMENT ON COLUMN regla_alerta.dias_anticipacion IS
    'Días hábiles antes del vencimiento en que se dispara el aviso. 0 significa '
    'el mismo día del vencimiento.';

-- -----------------------------------------------------------------------------
-- alerta — instancia programada contra un plazo concreto.
-- -----------------------------------------------------------------------------
CREATE TABLE alerta (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id         UUID NOT NULL REFERENCES estudio(id)   ON DELETE CASCADE,
    plazo_id           UUID NOT NULL REFERENCES plazo(id)     ON DELETE CASCADE,
    regla_alerta_id    UUID REFERENCES regla_alerta(id)       ON DELETE SET NULL,
    nivel              VARCHAR(12)  NOT NULL,
    fecha_programada   DATE         NOT NULL,
    mensaje            VARCHAR(500) NOT NULL,
    estado             VARCHAR(15)  NOT NULL DEFAULT 'PROGRAMADA',
    disparada_en       TIMESTAMPTZ,
    creado_en          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_alerta_nivel CHECK (
        nivel IN ('CRITICA', 'IMPORTANTE', 'INFORMATIVA')
    ),
    CONSTRAINT ck_alerta_estado CHECK (
        estado IN ('PROGRAMADA', 'DISPARADA', 'DESCARTADA')
    ),
    CONSTRAINT ck_alerta_disparo CHECK (
        (estado = 'DISPARADA' AND disparada_en IS NOT NULL)
     OR (estado <> 'DISPARADA')
    )
);

-- Una regla no puede generar dos alertas para el mismo plazo: hace idempotente
-- al proceso programado que recorre los vencimientos.
CREATE UNIQUE INDEX uq_alerta_plazo_regla
    ON alerta (plazo_id, regla_alerta_id)
    WHERE regla_alerta_id IS NOT NULL;

-- Cola del proceso programado que dispara los avisos del día.
CREATE INDEX ix_alerta_pendiente
    ON alerta (fecha_programada)
    WHERE estado = 'PROGRAMADA';

-- -----------------------------------------------------------------------------
-- notificacion — entrega concreta a un usuario por un canal.
--
-- alerta_id NULL permite notificaciones que no nacen de un plazo (por ejemplo,
-- "te asignaron una tarea").
-- -----------------------------------------------------------------------------
CREATE TABLE notificacion (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    alerta_id    UUID REFERENCES alerta(id) ON DELETE CASCADE,
    titulo       VARCHAR(200) NOT NULL,
    mensaje      VARCHAR(500) NOT NULL,
    canal        VARCHAR(10)  NOT NULL DEFAULT 'IN_APP',
    enviada_en   TIMESTAMPTZ,
    leida_en     TIMESTAMPTZ,
    creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_notificacion_canal CHECK (canal IN ('IN_APP', 'EMAIL'))
);

-- Bandeja del usuario: no leídas primero, más recientes arriba.
CREATE INDEX ix_notificacion_bandeja
    ON notificacion (usuario_id, creado_en DESC)
    WHERE leida_en IS NULL;

-- ####  008_costas.sql  ##############################################

-- =============================================================================
-- 008 — Módulo Costas
--
-- Decisión de modelado: costa (lo devengado) y cobro (lo percibido) son tablas
-- distintas en relación 1:N. Una costa puede cobrarse en cuotas, y el saldo
-- pendiente se deriva de la diferencia. Guardar un único campo "monto_cobrado"
-- en costa perdería el detalle de cada pago, que es justamente lo que reclama
-- el objetivo de "control de cobros pendientes".
--
-- Todo importe es NUMERIC, nunca punto flotante: son datos de dinero.
-- =============================================================================

CREATE TABLE costa (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id               UUID NOT NULL REFERENCES estudio(id)        ON DELETE RESTRICT,
    causa_id                 UUID NOT NULL REFERENCES causa(id)          ON DELETE CASCADE,
    concepto_costa_id        UUID NOT NULL REFERENCES concepto_costa(id) ON DELETE RESTRICT,
    descripcion              VARCHAR(300),
    monto                    NUMERIC(14,2) NOT NULL,
    moneda                   CHAR(3)       NOT NULL DEFAULT 'ARS',
    fecha_devengamiento      DATE          NOT NULL,
    fecha_vencimiento_pago   DATE,
    a_cargo_de               VARCHAR(12)   NOT NULL,
    estado_cobro             VARCHAR(12)   NOT NULL DEFAULT 'PENDIENTE',
    comprobante              VARCHAR(100),
    registrado_por           UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en                TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en           TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT ck_costa_monto CHECK (monto > 0),
    CONSTRAINT ck_costa_a_cargo CHECK (
        a_cargo_de IN ('ESTUDIO', 'CLIENTE', 'CONTRARIA')
    ),
    CONSTRAINT ck_costa_estado CHECK (
        estado_cobro IN ('PENDIENTE', 'PARCIAL', 'COBRADO', 'INCOBRABLE')
    ),
    CONSTRAINT ck_costa_fechas CHECK (
        fecha_vencimiento_pago IS NULL OR fecha_vencimiento_pago >= fecha_devengamiento
    )
);

CREATE INDEX ix_costa_causa ON costa (causa_id);

-- Consulta del tablero de cobranza: qué queda por cobrar en el estudio.
CREATE INDEX ix_costa_pendiente
    ON costa (estudio_id, fecha_vencimiento_pago)
    WHERE estado_cobro IN ('PENDIENTE', 'PARCIAL');

-- Reporte de gastos por período.
CREATE INDEX ix_costa_devengamiento ON costa (estudio_id, fecha_devengamiento);

CREATE TRIGGER tg_costa_actualizado
    BEFORE UPDATE ON costa
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON COLUMN costa.a_cargo_de IS
    'Quién soporta el gasto. Distingue el gasto que el estudio adelanta y debe '
    'recuperar del que corre por cuenta del cliente o de la contraria.';
COMMENT ON COLUMN costa.estado_cobro IS
    'Derivable de la suma de cobros, pero se persiste para poder indexar el '
    'tablero de cobranza sin agregar en cada consulta. Lo mantiene el módulo '
    'de costas al registrar cada cobro.';

-- -----------------------------------------------------------------------------
-- cobro — pago (total o parcial) imputado a una costa.
-- -----------------------------------------------------------------------------
CREATE TABLE cobro (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    costa_id         UUID NOT NULL REFERENCES costa(id) ON DELETE CASCADE,
    monto            NUMERIC(14,2) NOT NULL,
    fecha            DATE          NOT NULL DEFAULT CURRENT_DATE,
    medio_pago       VARCHAR(15)   NOT NULL,
    comprobante      VARCHAR(100),
    observaciones    VARCHAR(300),
    registrado_por   UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en        TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT ck_cobro_monto CHECK (monto > 0),
    CONSTRAINT ck_cobro_medio CHECK (
        medio_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'OTRO')
    )
);

CREATE INDEX ix_cobro_costa ON cobro (costa_id);
CREATE INDEX ix_cobro_fecha ON cobro (fecha);

-- ####  009_operacion.sql  ###########################################

-- =============================================================================
-- 009 — Módulos Plantillas y Tareas (operación del estudio)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- plantilla_escrito — banco de modelos de escritos por tipo y por tribunal.
--
-- estudio_id NULL => plantilla base provista por el sistema.
-- tribunal_id     => plantilla afinada a las exigencias formales de ese tribunal.
-- -----------------------------------------------------------------------------
CREATE TABLE plantilla_escrito (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id          UUID REFERENCES estudio(id)        ON DELETE CASCADE,
    tipo_documento_id   UUID REFERENCES tipo_documento(id) ON DELETE RESTRICT,
    fuero_id            UUID REFERENCES fuero(id)          ON DELETE RESTRICT,
    tribunal_id         UUID REFERENCES tribunal(id)       ON DELETE RESTRICT,
    nombre              VARCHAR(150) NOT NULL,
    descripcion         VARCHAR(300),
    contenido           TEXT NOT NULL,
    version             SMALLINT    NOT NULL DEFAULT 1,
    activa              BOOLEAN     NOT NULL DEFAULT TRUE,
    creada_por          UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_plantilla_version CHECK (version > 0)
);

CREATE INDEX ix_plantilla_estudio ON plantilla_escrito (estudio_id) WHERE activa;
CREATE INDEX ix_plantilla_tribunal ON plantilla_escrito (tribunal_id) WHERE activa;

CREATE TRIGGER tg_plantilla_actualizado
    BEFORE UPDATE ON plantilla_escrito
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON COLUMN plantilla_escrito.contenido IS
    'Texto del modelo con marcadores sustituibles del tipo {{caratula}}, '
    '{{tribunal}}, {{actor}}. El módulo de plantillas los resuelve contra la causa.';

-- -----------------------------------------------------------------------------
-- tarea — trabajo delegable entre integrantes del estudio.
--
-- causa_id y plazo_id son opcionales: existen tareas administrativas que no
-- cuelgan de ninguna causa, y tareas que nacen de vigilar un plazo concreto.
-- -----------------------------------------------------------------------------
CREATE TABLE tarea (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id          UUID NOT NULL REFERENCES estudio(id) ON DELETE RESTRICT,
    causa_id            UUID REFERENCES causa(id) ON DELETE CASCADE,
    plazo_id            UUID REFERENCES plazo(id) ON DELETE SET NULL,
    titulo              VARCHAR(200) NOT NULL,
    descripcion         TEXT,
    asignada_a          UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creada_por          UUID REFERENCES usuario(id) ON DELETE SET NULL,
    prioridad           VARCHAR(6)  NOT NULL DEFAULT 'MEDIA',
    estado              VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
    fecha_vencimiento   DATE,
    completada_en       TIMESTAMPTZ,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_tarea_prioridad CHECK (prioridad IN ('ALTA', 'MEDIA', 'BAJA')),
    CONSTRAINT ck_tarea_estado CHECK (
        estado IN ('PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'CANCELADA')
    ),
    CONSTRAINT ck_tarea_completada CHECK (
        (estado = 'COMPLETADA' AND completada_en IS NOT NULL)
     OR (estado <> 'COMPLETADA')
    )
);

-- Tablero personal: "mis tareas abiertas", por vencimiento.
CREATE INDEX ix_tarea_asignada
    ON tarea (asignada_a, fecha_vencimiento)
    WHERE estado IN ('PENDIENTE', 'EN_CURSO');

CREATE INDEX ix_tarea_causa ON tarea (causa_id);

CREATE TRIGGER tg_tarea_actualizado
    BEFORE UPDATE ON tarea
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- ####  010_ia.sql  ##################################################

-- =============================================================================
-- 010 — Módulo IA (opcional)
--
-- La propuesta define la IA como dependencia externa OPCIONAL con degradación
-- elegante: sin clave de API el sistema funciona igual (riesgo R4). Por eso
-- ninguna otra tabla depende de esta, y el estado SIN_SERVICIO deja constancia
-- de las consultas que no se pudieron atender.
--
-- Registrar tokens y costo estimado permite controlar el gasto de la API, que
-- es justamente lo que hace riesgosa la dependencia.
-- =============================================================================

CREATE TABLE consulta_ia (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id        UUID NOT NULL REFERENCES estudio(id)  ON DELETE CASCADE,
    usuario_id        UUID REFERENCES usuario(id)           ON DELETE SET NULL,
    causa_id          UUID REFERENCES causa(id)             ON DELETE SET NULL,
    documento_id      UUID REFERENCES documento(id)         ON DELETE SET NULL,
    tipo              VARCHAR(30) NOT NULL,
    prompt            TEXT        NOT NULL,
    respuesta         TEXT,
    modelo            VARCHAR(80),
    tokens_entrada    INTEGER,
    tokens_salida     INTEGER,
    costo_estimado    NUMERIC(10,4),
    estado            VARCHAR(12) NOT NULL DEFAULT 'OK',
    mensaje_error     TEXT,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_consulta_ia_tipo CHECK (
        tipo IN ('ANALISIS_TEXTO', 'BUSQUEDA_JURISPRUDENCIA', 'RESUMEN')
    ),
    CONSTRAINT ck_consulta_ia_estado CHECK (
        estado IN ('OK', 'ERROR', 'SIN_SERVICIO')
    ),
    CONSTRAINT ck_consulta_ia_tokens CHECK (
        (tokens_entrada IS NULL OR tokens_entrada >= 0)
    AND (tokens_salida  IS NULL OR tokens_salida  >= 0)
    )
);

CREATE INDEX ix_consulta_ia_estudio ON consulta_ia (estudio_id, creado_en DESC);
CREATE INDEX ix_consulta_ia_causa   ON consulta_ia (causa_id);

COMMENT ON TABLE consulta_ia IS
    'Historial de uso de la Claude API. Funcionalidad opcional: el sistema '
    'opera completo sin ella.';
COMMENT ON COLUMN consulta_ia.estado IS
    'SIN_SERVICIO registra la degradación elegante: no había clave o créditos, '
    'y la consulta se rechazó sin romper la operación.';

-- ####  011_auditoria.sql  ###########################################

-- =============================================================================
-- 011 — Módulo Auditoría
--
-- Decisión de modelado: UNA tabla genérica en lugar de una tabla de historial
-- por entidad. El requisito es "registro de auditoría de acciones sensibles";
-- una tabla por entidad multiplicaría el esquema por dos y obligaría a tocar
-- la auditoría cada vez que se agrega una tabla de negocio. Con entidad +
-- entidad_id + JSONB, auditar algo nuevo no requiere ninguna migración.
--
-- Excepción deliberada a la convención de claves: aquí la PK es BIGINT de
-- identidad, no UUID. Es una tabla append-only de alto volumen cuyo id nunca
-- aparece en una URL, así que no hay riesgo de enumeración y sí un beneficio
-- claro en tamaño de índice y localidad de escritura.
-- =============================================================================

CREATE TABLE auditoria (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudio_id     UUID REFERENCES estudio(id) ON DELETE SET NULL,
    usuario_id     UUID REFERENCES usuario(id) ON DELETE SET NULL,
    entidad        VARCHAR(60) NOT NULL,
    entidad_id     UUID,
    accion         VARCHAR(20) NOT NULL,
    datos_antes    JSONB,
    datos_despues  JSONB,
    ip             INET,
    user_agent     VARCHAR(300),
    ocurrido_en    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_auditoria_accion CHECK (
        accion IN ('CREAR', 'ACTUALIZAR', 'ELIMINAR', 'CONSULTAR', 'EXPORTAR',
                   'LOGIN', 'LOGOUT', 'LOGIN_FALLIDO', 'CAMBIO_PERMISOS')
    )
);

-- Vista principal: la actividad reciente de un estudio.
CREATE INDEX ix_auditoria_estudio ON auditoria (estudio_id, ocurrido_en DESC);

-- Trazabilidad de un registro concreto: "todo lo que le pasó a esta causa".
CREATE INDEX ix_auditoria_entidad ON auditoria (entidad, entidad_id, ocurrido_en DESC);

-- Auditoría por usuario, para responder "quién hizo qué".
CREATE INDEX ix_auditoria_usuario ON auditoria (usuario_id, ocurrido_en DESC);

COMMENT ON TABLE auditoria IS
    'Registro append-only de acciones sensibles. Nunca se actualiza ni se '
    'borra desde la aplicación.';
COMMENT ON COLUMN auditoria.usuario_id IS
    'ON DELETE SET NULL: dar de baja a un usuario no puede borrar el rastro de '
    'lo que hizo. El nombre queda preservado dentro de datos_antes.';
COMMENT ON COLUMN auditoria.datos_antes IS
    'Estado del registro antes del cambio, en JSONB. NULL en altas.';
COMMENT ON COLUMN auditoria.datos_despues IS
    'Estado del registro después del cambio, en JSONB. NULL en bajas.';

-- ####  012_vistas.sql  ##############################################

-- =============================================================================
-- 012 — Vistas de consulta
--
-- Concentran los JOIN y las agregaciones que el backend repetiría en varios
-- endpoints. No agregan reglas de negocio: solo evitan duplicar SQL entre el
-- listado, el detalle y el reporte exportable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- vw_plazo_vigente — base del panel "qué vence" y del calendario del estudio.
-- -----------------------------------------------------------------------------
CREATE VIEW vw_plazo_vigente AS
SELECT
    p.id                                  AS plazo_id,
    p.estudio_id,
    p.causa_id,
    c.numero_expediente,
    c.caratula,
    p.descripcion,
    tp.nombre                             AS tipo_plazo,
    tp.articulo_referencia,
    p.fecha_notificacion,
    p.fecha_vencimiento,
    p.estado,
    (p.fecha_vencimiento - CURRENT_DATE)  AS dias_corridos_restantes,
    p.responsable_id,
    u.nombre   AS responsable_nombre,
    u.apellido AS responsable_apellido
FROM plazo p
JOIN causa c        ON c.id  = p.causa_id
LEFT JOIN tipo_plazo tp ON tp.id = p.tipo_plazo_id
LEFT JOIN usuario u     ON u.id  = p.responsable_id
WHERE p.estado IN ('PENDIENTE', 'SUSPENDIDO')
  AND c.eliminado_en IS NULL;

COMMENT ON VIEW vw_plazo_vigente IS
    'Plazos abiertos con su causa y responsable. dias_corridos_restantes es '
    'calendario, no hábiles: sirve para ordenar y semaforizar, no para computar.';

-- -----------------------------------------------------------------------------
-- vw_costa_saldo — costas con lo efectivamente cobrado y el saldo pendiente.
-- Es la fuente del control de cobros y del reporte de gastos exportable.
-- -----------------------------------------------------------------------------
CREATE VIEW vw_costa_saldo AS
SELECT
    co.id            AS costa_id,
    co.estudio_id,
    co.causa_id,
    c.numero_expediente,
    c.caratula,
    cc.nombre        AS concepto,
    co.descripcion,
    co.monto,
    co.moneda,
    co.fecha_devengamiento,
    co.fecha_vencimiento_pago,
    co.a_cargo_de,
    co.estado_cobro,
    COALESCE(SUM(cb.monto), 0)             AS total_cobrado,
    co.monto - COALESCE(SUM(cb.monto), 0)  AS saldo_pendiente
FROM costa co
JOIN causa c           ON c.id  = co.causa_id
JOIN concepto_costa cc ON cc.id = co.concepto_costa_id
LEFT JOIN cobro cb     ON cb.costa_id = co.id
WHERE c.eliminado_en IS NULL
GROUP BY co.id, c.numero_expediente, c.caratula, cc.nombre;

COMMENT ON VIEW vw_costa_saldo IS
    'Saldo real por costa. Permite contrastar el estado_cobro persistido en '
    'costa contra la suma efectiva de cobros.';

-- -----------------------------------------------------------------------------
-- vw_causa_resumen — tarjeta de la causa en listados, sin N+1 consultas.
-- -----------------------------------------------------------------------------
CREATE VIEW vw_causa_resumen AS
SELECT
    c.id             AS causa_id,
    c.estudio_id,
    c.numero_expediente,
    c.caratula,
    f.nombre         AS fuero,
    t.nombre         AS tribunal,
    ec.nombre        AS estado,
    ec.es_final,
    c.fecha_inicio,
    (SELECT count(*) FROM parte_causa pc  WHERE pc.causa_id = c.id)  AS cantidad_partes,
    (SELECT count(*) FROM documento d
       WHERE d.causa_id = c.id AND d.eliminado_en IS NULL)           AS cantidad_documentos,
    (SELECT count(*) FROM plazo p
       WHERE p.causa_id = c.id AND p.estado = 'PENDIENTE')           AS plazos_pendientes,
    (SELECT min(p.fecha_vencimiento) FROM plazo p
       WHERE p.causa_id = c.id AND p.estado = 'PENDIENTE')           AS proximo_vencimiento
FROM causa c
JOIN fuero f            ON f.id  = c.fuero_id
JOIN estado_causa ec    ON ec.id = c.estado_causa_id
LEFT JOIN tribunal t    ON t.id  = c.tribunal_id
WHERE c.eliminado_en IS NULL;

COMMENT ON VIEW vw_causa_resumen IS
    'Causa con sus contadores y el próximo vencimiento, para el listado principal.';
