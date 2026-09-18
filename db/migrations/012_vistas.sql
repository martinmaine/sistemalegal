-- =============================================================================
-- 012 — Vistas de consulta
--
-- Concentran los JOIN y las agregaciones que el backend repetiría en varios
-- endpoints. No agregan reglas de negocio: solo evitan duplicar SQL entre el
-- listado, el detalle y el reporte exportable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- vw_plazo_vigente — base del panel "qué vence" y del calendario del estudio.
-- -----------------------------------------------------------------------------
CREATE VIEW vw_plazo_vigente AS
SELECT
    p.id                                  AS plazo_id,
    p.estudio_id,
    p.causa_id,
    c.numero_expediente,
    c.caratula,
    p.descripcion,
    tp.nombre                             AS tipo_plazo,
    tp.articulo_referencia,
    p.fecha_notificacion,
    p.fecha_vencimiento,
    p.estado,
    (p.fecha_vencimiento - CURRENT_DATE)  AS dias_corridos_restantes,
    p.responsable_id,
    u.nombre   AS responsable_nombre,
    u.apellido AS responsable_apellido
FROM plazo p
JOIN causa c        ON c.id  = p.causa_id
LEFT JOIN tipo_plazo tp ON tp.id = p.tipo_plazo_id
LEFT JOIN usuario u     ON u.id  = p.responsable_id
WHERE p.estado IN ('PENDIENTE', 'SUSPENDIDO')
  AND c.eliminado_en IS NULL;

COMMENT ON VIEW vw_plazo_vigente IS
    'Plazos abiertos con su causa y responsable. dias_corridos_restantes es '
    'calendario, no hábiles: sirve para ordenar y semaforizar, no para computar.';

-- -----------------------------------------------------------------------------
-- vw_costa_saldo — costas con lo efectivamente cobrado y el saldo pendiente.
-- Es la fuente del control de cobros y del reporte de gastos exportable.
-- -----------------------------------------------------------------------------
CREATE VIEW vw_costa_saldo AS
SELECT
    co.id            AS costa_id,
    co.estudio_id,
    co.causa_id,
    c.numero_expediente,
    c.caratula,
    cc.nombre        AS concepto,
    co.descripcion,
    co.monto,
    co.moneda,
    co.fecha_devengamiento,
    co.fecha_vencimiento_pago,
    co.a_cargo_de,
    co.estado_cobro,
    COALESCE(SUM(cb.monto), 0)             AS total_cobrado,
    co.monto - COALESCE(SUM(cb.monto), 0)  AS saldo_pendiente
FROM costa co
JOIN causa c           ON c.id  = co.causa_id
JOIN concepto_costa cc ON cc.id = co.concepto_costa_id
LEFT JOIN cobro cb     ON cb.costa_id = co.id
WHERE c.eliminado_en IS NULL
GROUP BY co.id, c.numero_expediente, c.caratula, cc.nombre;

COMMENT ON VIEW vw_costa_saldo IS
    'Saldo real por costa. Permite contrastar el estado_cobro persistido en '
    'costa contra la suma efectiva de cobros.';

-- -----------------------------------------------------------------------------
-- vw_causa_resumen — tarjeta de la causa en listados, sin N+1 consultas.
-- -----------------------------------------------------------------------------
CREATE VIEW vw_causa_resumen AS
SELECT
    c.id             AS causa_id,
    c.estudio_id,
    c.numero_expediente,
    c.caratula,
    f.nombre         AS fuero,
    t.nombre         AS tribunal,
    ec.nombre        AS estado,
    ec.es_final,
    c.fecha_inicio,
    (SELECT count(*) FROM parte_causa pc  WHERE pc.causa_id = c.id)  AS cantidad_partes,
    (SELECT count(*) FROM documento d
       WHERE d.causa_id = c.id AND d.eliminado_en IS NULL)           AS cantidad_documentos,
    (SELECT count(*) FROM plazo p
       WHERE p.causa_id = c.id AND p.estado = 'PENDIENTE')           AS plazos_pendientes,
    (SELECT min(p.fecha_vencimiento) FROM plazo p
       WHERE p.causa_id = c.id AND p.estado = 'PENDIENTE')           AS proximo_vencimiento
FROM causa c
JOIN fuero f            ON f.id  = c.fuero_id
JOIN estado_causa ec    ON ec.id = c.estado_causa_id
LEFT JOIN tribunal t    ON t.id  = c.tribunal_id
WHERE c.eliminado_en IS NULL;

COMMENT ON VIEW vw_causa_resumen IS
    'Causa con sus contadores y el próximo vencimiento, para el listado principal.';
