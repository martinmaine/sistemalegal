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
