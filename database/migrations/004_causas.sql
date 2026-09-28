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
