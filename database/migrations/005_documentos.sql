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
