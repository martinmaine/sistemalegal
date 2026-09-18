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
