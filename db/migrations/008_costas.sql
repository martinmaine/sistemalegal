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
