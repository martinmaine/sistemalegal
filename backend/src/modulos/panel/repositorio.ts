import { obtenerPool } from '../../db';

/**
 * Consultas del panel de inicio.
 *
 * Todas las cifras salen de la base. Ninguna está escrita a mano ni estimada:
 * el panel es lo primero que ve un abogado al entrar y un número inventado ahí
 * haría que no confiara en el resto del sistema.
 */

export interface Indicadores {
  causas_activas: number;
  plazos_por_vencer: number;
  plazos_vencidos: number;
  tareas_abiertas: number;
  mis_tareas_abiertas: number;
  audiencias_proximas: number;
}

/**
 * @param usuarioId para separar "mis tareas" del total del estudio.
 * @param diasHorizonte ventana de "por vencer"; 7 días es la semana de trabajo.
 */
export async function indicadores(usuarioId: string, diasHorizonte: number): Promise<Indicadores> {
  const { rows } = await obtenerPool().query<Indicadores>(
    `SELECT
       (SELECT count(*) FROM causa c
          JOIN estado_causa ec ON ec.id = c.estado_causa_id
         WHERE c.eliminado_en IS NULL AND ec.es_final = FALSE)::int AS causas_activas,

       (SELECT count(*) FROM plazo p
          JOIN causa c ON c.id = p.causa_id AND c.eliminado_en IS NULL
         WHERE p.estado = 'PENDIENTE'
           AND p.fecha_vencimiento BETWEEN CURRENT_DATE
                                       AND CURRENT_DATE + make_interval(days => $2))::int AS plazos_por_vencer,

       -- Vencido es el plazo que sigue PENDIENTE con fecha pasada: nadie lo
       -- marcó cumplido y eso es exactamente lo que hay que mirar.
       (SELECT count(*) FROM plazo p
          JOIN causa c ON c.id = p.causa_id AND c.eliminado_en IS NULL
         WHERE p.estado = 'PENDIENTE' AND p.fecha_vencimiento < CURRENT_DATE)::int AS plazos_vencidos,

       (SELECT count(*) FROM tarea t
         WHERE t.estado IN ('PENDIENTE', 'EN_CURSO'))::int AS tareas_abiertas,

       (SELECT count(*) FROM tarea t
         WHERE t.estado IN ('PENDIENTE', 'EN_CURSO') AND t.asignada_a = $1)::int AS mis_tareas_abiertas,

       (SELECT count(*) FROM evento_calendario e
         WHERE e.tipo = 'AUDIENCIA'
           AND e.fecha_inicio >= now()
           AND e.fecha_inicio < now() + make_interval(days => $2))::int AS audiencias_proximas`,
    [usuarioId, diasHorizonte],
  );

  // La consulta es un SELECT de subconsultas escalares: siempre devuelve una fila.
  return (
    rows[0] ?? {
      causas_activas: 0,
      plazos_por_vencer: 0,
      plazos_vencidos: 0,
      tareas_abiertas: 0,
      mis_tareas_abiertas: 0,
      audiencias_proximas: 0,
    }
  );
}

export interface PlazoProximo {
  id: string;
  causa_id: string;
  caratula: string;
  numero_expediente: string | null;
  descripcion: string;
  tipo_plazo: string | null;
  fecha_vencimiento: string;
  dias_restantes: number;
  estado: string;
  responsable: string | null;
}

/**
 * Plazos pendientes ordenados por urgencia, incluidos los ya vencidos.
 *
 * Los vencidos encabezan la lista con días negativos: esconderlos sería el peor
 * comportamiento posible para esta pantalla.
 */
export async function plazosProximos(diasHorizonte: number, limite: number): Promise<PlazoProximo[]> {
  const { rows } = await obtenerPool().query<PlazoProximo>(
    `SELECT p.id,
            p.causa_id,
            c.caratula,
            c.numero_expediente,
            p.descripcion,
            tp.nombre AS tipo_plazo,
            to_char(p.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
            (p.fecha_vencimiento - CURRENT_DATE) AS dias_restantes,
            p.estado,
            (u.nombre || ' ' || u.apellido) AS responsable
       FROM plazo p
       JOIN causa c ON c.id = p.causa_id AND c.eliminado_en IS NULL
       LEFT JOIN tipo_plazo tp ON tp.id = p.tipo_plazo_id
       LEFT JOIN usuario    u  ON u.id  = p.responsable_id
      WHERE p.estado = 'PENDIENTE'
        AND p.fecha_vencimiento < CURRENT_DATE + make_interval(days => $1)
      ORDER BY p.fecha_vencimiento
      LIMIT $2`,
    [diasHorizonte, limite],
  );
  return rows;
}

export interface TareaPanel {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  fecha_vencimiento: string | null;
  causa_id: string | null;
  caratula: string | null;
  numero_expediente: string | null;
  asignada_a: string | null;
  /** TRUE si la tarea es del usuario que consulta. */
  es_mia: boolean;
}

export async function tareasAbiertas(usuarioId: string, limite: number): Promise<TareaPanel[]> {
  const { rows } = await obtenerPool().query<TareaPanel>(
    `SELECT t.id,
            t.titulo,
            t.estado,
            t.prioridad,
            to_char(t.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
            t.causa_id,
            c.caratula,
            c.numero_expediente,
            (u.nombre || ' ' || u.apellido) AS asignada_a,
            (t.asignada_a = $1) AS es_mia
       FROM tarea t
       LEFT JOIN causa   c ON c.id = t.causa_id AND c.eliminado_en IS NULL
       LEFT JOIN usuario u ON u.id = t.asignada_a
      WHERE t.estado IN ('PENDIENTE', 'EN_CURSO')
      -- Primero lo propio, después lo que vence antes, después lo prioritario.
      ORDER BY (t.asignada_a = $1) DESC NULLS LAST,
               t.fecha_vencimiento ASC NULLS LAST,
               CASE t.prioridad WHEN 'ALTA' THEN 0 WHEN 'MEDIA' THEN 1 ELSE 2 END
      LIMIT $2`,
    [usuarioId, limite],
  );
  return rows;
}

export interface EventoPanel {
  id: string;
  titulo: string;
  tipo: string;
  fecha_inicio: string;
  todo_el_dia: boolean;
  lugar: string | null;
  causa_id: string | null;
  caratula: string | null;
}

export async function eventosProximos(diasHorizonte: number, limite: number): Promise<EventoPanel[]> {
  const { rows } = await obtenerPool().query<EventoPanel>(
    `SELECT e.id,
            e.titulo,
            e.tipo,
            e.fecha_inicio,
            e.todo_el_dia,
            e.lugar,
            e.causa_id,
            c.caratula
       FROM evento_calendario e
       LEFT JOIN causa c ON c.id = e.causa_id AND c.eliminado_en IS NULL
      WHERE e.fecha_inicio >= date_trunc('day', now())
        AND e.fecha_inicio < now() + make_interval(days => $1)
      ORDER BY e.fecha_inicio
      LIMIT $2`,
    [diasHorizonte, limite],
  );
  return rows;
}

export interface ActividadPanel {
  id: string;
  causa_id: string;
  caratula: string;
  numero_expediente: string | null;
  fecha: string;
  tipo: string | null;
  descripcion: string;
  registrado_por: string | null;
}

/** Últimos movimientos procesales del estudio: qué pasó, en qué causa y quién lo cargó. */
export async function actividadReciente(limite: number): Promise<ActividadPanel[]> {
  const { rows } = await obtenerPool().query<ActividadPanel>(
    `SELECT m.id,
            m.causa_id,
            c.caratula,
            c.numero_expediente,
            to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
            m.tipo,
            m.descripcion,
            (u.nombre || ' ' || u.apellido) AS registrado_por
       FROM movimiento_causa m
       JOIN causa c ON c.id = m.causa_id AND c.eliminado_en IS NULL
       LEFT JOIN usuario u ON u.id = m.registrado_por
      ORDER BY m.fecha DESC, m.creado_en DESC
      LIMIT $1`,
    [limite],
  );
  return rows;
}

export interface CausaReciente {
  id: string;
  caratula: string;
  numero_expediente: string | null;
  estado: string;
  es_final: boolean;
  fuero: string;
  actualizado_en: string;
}

export async function causasRecientes(limite: number): Promise<CausaReciente[]> {
  const { rows } = await obtenerPool().query<CausaReciente>(
    `SELECT c.id,
            c.caratula,
            c.numero_expediente,
            ec.nombre AS estado,
            ec.es_final,
            f.nombre  AS fuero,
            c.actualizado_en
       FROM causa c
       JOIN estado_causa ec ON ec.id = c.estado_causa_id
       JOIN fuero        f  ON f.id  = c.fuero_id
      WHERE c.eliminado_en IS NULL
      ORDER BY c.actualizado_en DESC
      LIMIT $1`,
    [limite],
  );
  return rows;
}

export interface ResumenFinanciero {
  saldo_pendiente: string;
  costas_pendientes: number;
}

/**
 * Saldo por cobrar del estudio, apoyado en la vista vw_costa_saldo.
 *
 * Solo lo pide el servicio cuando el usuario tiene permiso costa.ver: hay
 * personal que no debe ver información financiera.
 */
export async function resumenFinanciero(): Promise<ResumenFinanciero> {
  const { rows } = await obtenerPool().query<ResumenFinanciero>(
    `SELECT COALESCE(sum(saldo_pendiente), 0)::text AS saldo_pendiente,
            count(*)::int                           AS costas_pendientes
       FROM vw_costa_saldo
      WHERE estado_cobro IN ('PENDIENTE', 'PARCIAL')`,
  );
  return rows[0] ?? { saldo_pendiente: '0', costas_pendientes: 0 };
}
