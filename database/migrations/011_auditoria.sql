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
