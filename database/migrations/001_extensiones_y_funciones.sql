-- =============================================================================
-- 001 — Extensiones y funciones compartidas
-- Sistema de Gestión Integral para Estudios Jurídicos
-- =============================================================================

-- gen_random_uuid() es nativo desde PostgreSQL 13; pgcrypto lo provee en versiones
-- anteriores y aporta funciones de hash usadas para tokens.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Búsqueda de texto insensible a tildes sobre el texto extraído de los PDF.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- -----------------------------------------------------------------------------
-- Mantiene actualizado_en en cada UPDATE. Se asocia por trigger a toda tabla
-- que declare esa columna, para no repetir la lógica en la capa de aplicación.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_actualizar_timestamp() IS
    'Trigger BEFORE UPDATE: refresca la columna actualizado_en.';

-- -----------------------------------------------------------------------------
-- Normaliza texto quitando tildes y diacríticos, para la búsqueda documental.
--
-- Por qué existe esta envoltura: el diccionario español de PostgreSQL reduce
-- 'NOTIFICACIÓN' al lexema 'notif', pero 'NOTIFICACION' sin tilde no la
-- reconoce y la deja entera como 'notificacion'. Son lexemas distintos, así que
-- quien busque sin tildes —lo normal en un buscador— no encontraría el
-- documento. Normalizar ambos lados resuelve el problema.
--
-- No se puede usar unaccent() directamente en un índice: está declarada STABLE.
-- La envoltura fija el diccionario, con lo cual el resultado es determinista y
-- puede declararse IMMUTABLE, que es lo que exige un índice de expresión.
--
-- La cláusula SET search_path resuelve dos cosas:
--   1. Al construir un índice de expresión PostgreSQL restringe el search_path
--      de la sesión; sin esto, no encuentra 'unaccent' y el índice no se crea.
--   2. Portabilidad: Neon instala las extensiones en public y Supabase en
--      extensions. Nombrando ambos esquemas, el mismo DDL corre en los dos.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sin_acentos(texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public, extensions, pg_catalog
AS $$
    -- El cast a regdictionary es obligatorio: sin él el literal llega como
    -- 'unknown' y PostgreSQL no resuelve la variante de dos argumentos.
    SELECT unaccent('unaccent'::regdictionary, texto);
$$;

COMMENT ON FUNCTION fn_sin_acentos(TEXT) IS
    'Quita tildes y diacríticos. IMMUTABLE para poder usarse en índices. '
    'La aplicación debe aplicarla también al término buscado.';
