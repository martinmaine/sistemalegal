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
