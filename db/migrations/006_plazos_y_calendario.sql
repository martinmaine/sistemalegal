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
