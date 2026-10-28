import { enTransaccion, obtenerPool } from '../../db';
import { desplazamiento } from '../../comun/paginacion';
import type { DiaInhabil, Suspension } from './computo';
import type { FiltrosPlazo, OrdenPlazo, DatosCrearPlazo } from './esquemas';
import type { PlazoDetalle, PlazoListado, SuspensionPlazo } from './tipos';

/**
 * Acceso a datos de plazos.
 *
 * Las fechas salen como texto `YYYY-MM-DD` con `to_char`. El motor de cómputo
 * trabaja con ese formato y nunca construye un `Date` a partir de una fecha
 * local, que correría el día según la zona horaria del servidor.
 */

const NOMBRE_USUARIO = `(u.nombre || ' ' || u.apellido)`;

/** Una suspensión sin fecha de fin deja el plazo detenido: hay que poder avisarlo. */
const SUSPENDIDO_SIN_FIN = `
  EXISTS (
    SELECT 1 FROM plazo_suspension ps
     WHERE ps.plazo_id = p.id AND ps.fecha_hasta IS NULL
  )`;

const COLUMNAS = `
  p.id,
  p.causa_id,
  c.caratula,
  c.numero_expediente,
  p.descripcion,
  tp.nombre              AS tipo_plazo,
  tp.articulo_referencia,
  to_char(p.fecha_notificacion,         'YYYY-MM-DD') AS fecha_notificacion,
  to_char(p.fecha_inicio_computo,       'YYYY-MM-DD') AS fecha_inicio_computo,
  to_char(p.fecha_vencimiento,          'YYYY-MM-DD') AS fecha_vencimiento,
  to_char(p.fecha_vencimiento_original, 'YYYY-MM-DD') AS fecha_vencimiento_original,
  p.cantidad_dias,
  p.computo,
  p.estado,
  ${NOMBRE_USUARIO}      AS responsable,
  p.responsable_id,
  to_char(p.fecha_cumplimiento, 'YYYY-MM-DD') AS fecha_cumplimiento,
  CASE WHEN p.estado IN ('PENDIENTE', 'SUSPENDIDO')
       THEN (p.fecha_vencimiento - CURRENT_DATE)
  END                    AS dias_restantes,
  ${SUSPENDIDO_SIN_FIN}  AS suspendido_sin_fin`;

const ORIGEN = `
  FROM plazo p
  JOIN causa c            ON c.id  = p.causa_id AND c.eliminado_en IS NULL
  LEFT JOIN tipo_plazo tp ON tp.id = p.tipo_plazo_id
  LEFT JOIN usuario u     ON u.id  = p.responsable_id`;

const COLUMNAS_ORDEN: Record<OrdenPlazo, string> = {
  fecha_vencimiento: 'p.fecha_vencimiento',
  creado_en: 'p.creado_en',
  caratula: 'c.caratula',
};

function condiciones(filtros: FiltrosPlazo): { sql: string; valores: unknown[] } {
  const partes: string[] = ['TRUE'];
  const valores: unknown[] = [];

  if (filtros.desde) {
    valores.push(filtros.desde);
    partes.push(`p.fecha_vencimiento >= $${valores.length}::date`);
  }

  if (filtros.hasta) {
    valores.push(filtros.hasta);
    partes.push(`p.fecha_vencimiento <= $${valores.length}::date`);
  }

  if (filtros.estado) {
    valores.push(filtros.estado);
    partes.push(`p.estado = $${valores.length}`);
  }

  if (filtros.responsable) {
    valores.push(filtros.responsable);
    partes.push(`p.responsable_id = $${valores.length}`);
  }

  if (filtros.causa) {
    valores.push(filtros.causa);
    partes.push(`p.causa_id = $${valores.length}`);
  }

  // Lo que hay que vigilar es lo que todavía puede vencer.
  if (filtros.vigencia === 'abiertos') partes.push(`p.estado IN ('PENDIENTE', 'SUSPENDIDO')`);
  if (filtros.vigencia === 'cerrados') partes.push(`p.estado NOT IN ('PENDIENTE', 'SUSPENDIDO')`);

  return { sql: partes.join('\n     AND '), valores };
}

export async function listar(filtros: FiltrosPlazo): Promise<PlazoListado[]> {
  const { sql: donde, valores } = condiciones(filtros);
  const direccion = filtros.direccion === 'asc' ? 'ASC' : 'DESC';
  valores.push(filtros.tamano, desplazamiento(filtros));

  const { rows } = await obtenerPool().query<PlazoListado>(
    `SELECT ${COLUMNAS}
     ${ORIGEN}
      WHERE ${donde}
      ORDER BY ${COLUMNAS_ORDEN[filtros.orden]} ${direccion} NULLS LAST, c.caratula ASC
      LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
  );
  return rows;
}

export async function contar(filtros: FiltrosPlazo): Promise<number> {
  const { sql: donde, valores } = condiciones(filtros);
  const { rows } = await obtenerPool().query<{ total: string }>(
    `SELECT count(*) AS total
       FROM plazo p
       JOIN causa c ON c.id = p.causa_id AND c.eliminado_en IS NULL
      WHERE ${donde}`,
    valores,
  );
  return Number.parseInt(rows[0]?.total ?? '0', 10);
}

export async function buscarPorId(id: string): Promise<PlazoDetalle | undefined> {
  const { rows } = await obtenerPool().query<PlazoDetalle>(
    `SELECT ${COLUMNAS},
            p.tipo_plazo_id,
            p.observaciones,
            p.creado_en,
            p.actualizado_en
     ${ORIGEN}
      WHERE p.id = $1`,
    [id],
  );
  return rows[0];
}

export async function suspensionesDe(plazoId: string): Promise<SuspensionPlazo[]> {
  const { rows } = await obtenerPool().query<SuspensionPlazo>(
    `SELECT ps.id,
            to_char(ps.fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
            to_char(ps.fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
            ps.motivo,
            ${NOMBRE_USUARIO} AS registrado_por
       FROM plazo_suspension ps
       LEFT JOIN usuario u ON u.id = ps.registrado_por
      WHERE ps.plazo_id = $1
      ORDER BY ps.fecha_desde`,
    [plazoId],
  );
  return rows;
}

/** Las suspensiones en el formato que entiende el motor. */
export async function suspensionesParaComputo(plazoId: string): Promise<Suspension[]> {
  const filas = await suspensionesDe(plazoId);
  return filas.map((fila) => ({
    desde: fila.fecha_desde,
    hasta: fila.fecha_hasta ?? undefined,
    motivo: fila.motivo,
  }));
}

/** Jurisdicción a la que pertenece la causa, que es la que define el calendario. */
export async function jurisdiccionDeCausa(causaId: string): Promise<string | undefined> {
  const { rows } = await obtenerPool().query<{ jurisdiccion_id: string }>(
    `SELECT f.jurisdiccion_id
       FROM causa c
       JOIN fuero f ON f.id = c.fuero_id
      WHERE c.id = $1 AND c.eliminado_en IS NULL`,
    [causaId],
  );
  return rows[0]?.jurisdiccion_id;
}

/**
 * Días inhábiles de la jurisdicción desde una fecha.
 *
 * Se acota a una ventana en lugar de traer la tabla entera: el motor nunca
 * mira más allá de su tope de cinco años, y un calendario cargado para una
 * década no tiene por qué viajar completo en cada cálculo.
 */
export async function inhabilesDesde(
  jurisdiccionId: string,
  desde: string,
  anios = 5,
): Promise<DiaInhabil[]> {
  const { rows } = await obtenerPool().query<DiaInhabil>(
    `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, tipo, motivo
       FROM dia_inhabil
      WHERE jurisdiccion_id = $1
        AND fecha >= $2::date
        AND fecha < ($2::date + ($3 || ' years')::interval)
      ORDER BY fecha`,
    [jurisdiccionId, desde, String(anios)],
  );
  return rows;
}

export interface FilaCalculada extends DatosCrearPlazo {
  fecha_inicio_computo: string;
  fecha_vencimiento: string;
}

export async function crear(
  causaId: string,
  datos: FilaCalculada,
  creadoPor: string,
): Promise<string> {
  const { rows } = await obtenerPool().query<{ id: string }>(
    `INSERT INTO plazo (causa_id, tipo_plazo_id, descripcion, fecha_notificacion,
                        fecha_inicio_computo, cantidad_dias, computo,
                        fecha_vencimiento, fecha_vencimiento_original,
                        responsable_id, observaciones, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11)
     RETURNING id`,
    [
      causaId,
      datos.tipo_plazo_id ?? null,
      datos.descripcion,
      datos.fecha_notificacion,
      datos.fecha_inicio_computo,
      datos.cantidad_dias,
      datos.computo,
      datos.fecha_vencimiento,
      datos.responsable_id ?? null,
      datos.observaciones ?? null,
      creadoPor,
    ],
  );

  const id = rows[0]?.id;
  if (!id) throw new Error('El alta del plazo no devolvió un identificador');
  return id;
}

/**
 * Edición.
 *
 * `fecha_vencimiento_original` **no** se toca: es el vencimiento del primer
 * cálculo y sirve para mostrar el efecto de las suspensiones. Solo se reemplaza
 * cuando cambian los insumos, porque entonces el cálculo original dejó de
 * describir este plazo.
 */
export async function actualizar(id: string, datos: FilaCalculada): Promise<boolean> {
  const { rowCount } = await obtenerPool().query(
    `UPDATE plazo
        SET tipo_plazo_id              = $2,
            descripcion                = $3,
            fecha_notificacion         = $4,
            fecha_inicio_computo       = $5,
            cantidad_dias              = $6,
            computo                    = $7,
            fecha_vencimiento          = $8,
            fecha_vencimiento_original = $8,
            responsable_id             = $9,
            observaciones              = $10
      WHERE id = $1`,
    [
      id,
      datos.tipo_plazo_id ?? null,
      datos.descripcion,
      datos.fecha_notificacion,
      datos.fecha_inicio_computo,
      datos.cantidad_dias,
      datos.computo,
      datos.fecha_vencimiento,
      datos.responsable_id ?? null,
      datos.observaciones ?? null,
    ],
  );
  return (rowCount ?? 0) > 0;
}

/** Nuevo vencimiento tras una suspensión, sin tocar el original ni los insumos. */
export async function actualizarVencimiento(id: string, fecha: string): Promise<void> {
  await obtenerPool().query('UPDATE plazo SET fecha_vencimiento = $2 WHERE id = $1', [id, fecha]);
}

export async function marcarCumplido(
  id: string,
  fecha: string,
  observaciones?: string,
): Promise<boolean> {
  const { rowCount } = await obtenerPool().query(
    `UPDATE plazo
        SET estado = 'CUMPLIDO',
            fecha_cumplimiento = $2,
            observaciones = COALESCE($3, observaciones)
      WHERE id = $1`,
    [id, fecha, observaciones ?? null],
  );
  return (rowCount ?? 0) > 0;
}

export async function cambiarEstado(id: string, estado: string): Promise<void> {
  await obtenerPool().query('UPDATE plazo SET estado = $2 WHERE id = $1', [id, estado]);
}

/**
 * Suspende el plazo y lo deja en estado SUSPENDIDO en la misma transacción:
 * un plazo con tramo de suspensión abierto pero estado PENDIENTE mentiría en
 * el listado de lo que hay que vigilar.
 */
export async function suspender(
  plazoId: string,
  datos: { fecha_desde: string; fecha_hasta?: string; motivo: string },
  registradoPor: string,
): Promise<string> {
  return enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO plazo_suspension (plazo_id, fecha_desde, fecha_hasta, motivo, registrado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [plazoId, datos.fecha_desde, datos.fecha_hasta ?? null, datos.motivo, registradoPor],
    );

    await cliente.query(`UPDATE plazo SET estado = 'SUSPENDIDO' WHERE id = $1`, [plazoId]);

    const id = rows[0]?.id;
    if (!id) throw new Error('La suspensión no devolvió un identificador');
    return id;
  });
}

/** Cierra la suspensión abierta y vuelve a poner el plazo en marcha. */
export async function reanudar(plazoId: string, fechaHasta: string): Promise<boolean> {
  return enTransaccion(async (cliente) => {
    const { rowCount } = await cliente.query(
      `UPDATE plazo_suspension
          SET fecha_hasta = $2
        WHERE plazo_id = $1 AND fecha_hasta IS NULL`,
      [plazoId, fechaHasta],
    );

    if ((rowCount ?? 0) === 0) return false;

    await cliente.query(`UPDATE plazo SET estado = 'PENDIENTE' WHERE id = $1`, [plazoId]);
    return true;
  });
}

export async function suspensionAbierta(plazoId: string): Promise<SuspensionPlazo | undefined> {
  const suspensiones = await suspensionesDe(plazoId);
  return suspensiones.find((suspension) => suspension.fecha_hasta === null);
}

export async function eliminar(id: string): Promise<boolean> {
  // Sin baja lógica: la tabla no tiene `eliminado_en` y un plazo cargado por
  // error no es historia que haya que conservar. La auditoría guarda qué había.
  const { rowCount } = await obtenerPool().query('DELETE FROM plazo WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
