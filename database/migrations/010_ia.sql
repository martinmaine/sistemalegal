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
