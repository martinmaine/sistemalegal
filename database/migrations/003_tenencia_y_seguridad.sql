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
