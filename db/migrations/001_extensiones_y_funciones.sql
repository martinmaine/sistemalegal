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
-- No se puede usar unaccent() directamente en un índice: está declarada STABLE
-- porque depende del diccionario que se le pase. Fijando el diccionario de forma
-- explícita, el resultado sí es determinista y la envoltura puede declararse
-- IMMUTABLE, que es lo que exige un índice de expresión.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sin_acentos(texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
    -- Dos detalles que hacen falta para que esto funcione dentro de un índice:
    --
    --  1. El cast a regdictionary es obligatorio: sin él el literal llega como
    --     'unknown' y PostgreSQL no resuelve la variante de dos argumentos.
    --  2. Tanto la función como el diccionario van calificados con su esquema.
    --     Al construir un índice de expresión PostgreSQL restringe el
    --     search_path, así que un 'unaccent' a secas no se encuentra y la
    --     creación del índice falla.
    SELECT public.unaccent('public.unaccent'::regdictionary, texto);
$$;

COMMENT ON FUNCTION fn_sin_acentos(TEXT) IS
    'Quita tildes y diacríticos. IMMUTABLE para poder usarse en índices. '
    'La aplicación debe aplicarla también al término buscado.';
