import { enTransaccion, obtenerPool } from '../../db';
import { desplazamiento } from '../../comun/paginacion';
import type {
  DatosAgregarParte,
  DatosAgregarProfesional,
  DatosCrearCausa,
  DatosEditarCausa,
  FiltrosCausa,
  OrdenCausa,
} from './esquemas';
import type {
  CausaDetalle,
  CausaListada,
  DocumentoCausa,
  MovimientoCausa,
  ParteCausa,
  PlazoCausa,
  ProfesionalCausa,
  TareaCausa,
} from './tipos';

/**
 * Capa de repositorio: la única que escribe SQL. Las capas de arriba no saben
 * que detrás hay PostgreSQL (ver docs/arquitectura.md, sección 2).
 *
 * Todo valor que viene del cliente viaja como parámetro ($1, $2, ...). Lo único
 * que se interpola en el texto del SQL es el nombre de columna del ORDER BY, y
 * solo después de resolverlo contra una tabla fija: nunca el valor recibido.
 */

/** Nombre completo de un usuario, armado en SQL para no repetirlo en cada consulta. */
const NOMBRE_USUARIO = `(u.nombre || ' ' || u.apellido)`;

/**
 * Profesional que figura como responsable de la causa.
 *
 * Si hay varios asignados se muestra el de mayor responsabilidad procesal, que
 * es lo que un abogado espera ver en el listado: primero el titular, después el
 * apoderado, y así.
 */
const RESPONSABLE = `
  LEFT JOIN LATERAL (
    SELECT (u.nombre || ' ' || u.apellido) AS nombre_completo
      FROM profesional_causa pc
      JOIN usuario u ON u.id = pc.usuario_id
     WHERE pc.causa_id = c.id AND pc.fecha_baja IS NULL
     ORDER BY CASE pc.rol_en_causa
                WHEN 'TITULAR'      THEN 0
                WHEN 'APODERADO'    THEN 1
                WHEN 'PATROCINANTE' THEN 2
                ELSE 3
              END
     LIMIT 1
  ) resp ON TRUE`;

const PLAZOS_PENDIENTES = `
  LEFT JOIN LATERAL (
    SELECT count(*) AS pendientes, min(p.fecha_vencimiento) AS proximo
      FROM plazo p
     WHERE p.causa_id = c.id AND p.estado = 'PENDIENTE'
  ) pl ON TRUE`;

/** Columnas por las que se puede ordenar. El enum de Zod garantiza que la clave existe. */
const COLUMNAS_ORDEN: Record<OrdenCausa, string> = {
  fecha_inicio: 'c.fecha_inicio',
  caratula: 'c.caratula',
  numero_expediente: 'c.numero_expediente',
  // Por el orden del ciclo de vida procesal, no alfabético: "En trámite" antes
  // que "Archivada" es más útil que ordenar por la letra inicial.
  estado: 'ec.orden',
  proximo_vencimiento: 'pl.proximo',
};

interface Condiciones {
  sql: string;
  valores: unknown[];
}

/**
 * Arma el WHERE compartido por el listado y el conteo.
 *
 * Los dos tienen que filtrar exactamente igual: si divergen, el total de la
 * paginación deja de coincidir con las filas mostradas.
 */
function condiciones(filtros: FiltrosCausa): Condiciones {
  const partes = ['c.eliminado_en IS NULL'];
  const valores: unknown[] = [];

  if (filtros.busqueda) {
    // fn_sin_acentos a ambos lados: quien escribe "cordoba" tiene que encontrar
    // "Córdoba" (ver el comentario de la función en la migración 001).
    valores.push(`%${filtros.busqueda}%`);
    partes.push(`(
      fn_sin_acentos(lower(c.caratula)) LIKE fn_sin_acentos(lower($${valores.length}))
      OR c.numero_expediente ILIKE $${valores.length}
    )`);
  }

  if (filtros.estado) {
    valores.push(filtros.estado);
    partes.push(`c.estado_causa_id = $${valores.length}`);
  }

  if (filtros.fuero) {
    valores.push(filtros.fuero);
    partes.push(`c.fuero_id = $${valores.length}`);
  }

  if (filtros.tribunal) {
    valores.push(filtros.tribunal);
    partes.push(`c.tribunal_id = $${valores.length}`);
  }

  if (filtros.responsable) {
    valores.push(filtros.responsable);
    partes.push(`EXISTS (
      SELECT 1 FROM profesional_causa pc
       WHERE pc.causa_id = c.id AND pc.usuario_id = $${valores.length} AND pc.fecha_baja IS NULL
    )`);
  }

  if (filtros.vigencia === 'activas') partes.push('ec.es_final = FALSE');
  if (filtros.vigencia === 'cerradas') partes.push('ec.es_final = TRUE');

  return { sql: partes.join('\n     AND '), valores };
}

export async function listar(filtros: FiltrosCausa): Promise<CausaListada[]> {
  const { sql: donde, valores } = condiciones(filtros);
  const columna = COLUMNAS_ORDEN[filtros.orden];
  const direccion = filtros.direccion === 'asc' ? 'ASC' : 'DESC';

  valores.push(filtros.tamano, desplazamiento(filtros));

  const sql = `
    SELECT c.id,
           c.numero_expediente,
           c.caratula,
           to_char(c.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
           ec.nombre  AS estado,
           ec.codigo  AS estado_codigo,
           ec.es_final,
           f.nombre   AS fuero,
           t.nombre   AS tribunal,
           resp.nombre_completo AS responsable,
           COALESCE(pl.pendientes, 0)::int      AS plazos_pendientes,
           to_char(pl.proximo, 'YYYY-MM-DD')    AS proximo_vencimiento
      FROM causa c
      JOIN estado_causa ec ON ec.id = c.estado_causa_id
      JOIN fuero        f  ON f.id  = c.fuero_id
      LEFT JOIN tribunal t ON t.id  = c.tribunal_id
      ${RESPONSABLE}
      ${PLAZOS_PENDIENTES}
     WHERE ${donde}
     -- NULLS LAST siempre: una causa sin plazos pendientes no es urgente, así
     -- que no debe encabezar el listado ordenado por vencimiento.
     ORDER BY ${columna} ${direccion} NULLS LAST, c.caratula ASC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}
  `;

  const { rows } = await obtenerPool().query<CausaListada>(sql, valores);
  return rows;
}

export async function contar(filtros: FiltrosCausa): Promise<number> {
  const { sql: donde, valores } = condiciones(filtros);
  const { rows } = await obtenerPool().query<{ total: string }>(
    `SELECT count(*) AS total
       FROM causa c
       JOIN estado_causa ec ON ec.id = c.estado_causa_id
      WHERE ${donde}`,
    valores,
  );
  return Number.parseInt(rows[0]?.total ?? '0', 10);
}

const SQL_DETALLE = `
  SELECT c.id,
         c.numero_expediente,
         c.caratula,
         -- Los ids además de los nombres: el formulario de edición precarga
         -- los desplegables con ellos, y por nombre tendría que adivinar.
         c.fuero_id,
         c.estado_causa_id,
         c.tribunal_id,
         c.tipo_causa_id,
         to_char(c.fecha_inicio, 'YYYY-MM-DD')  AS fecha_inicio,
         to_char(c.fecha_cierre, 'YYYY-MM-DD')  AS fecha_cierre,
         ec.nombre  AS estado,
         ec.codigo  AS estado_codigo,
         ec.es_final,
         f.nombre   AS fuero,
         t.nombre   AS tribunal,
         t.domicilio AS tribunal_domicilio,
         tc.nombre  AS tipo_causa,
         j.nombre   AS jurisdiccion,
         c.monto_reclamado,
         c.moneda,
         c.observaciones,
         c.creado_en,
         c.actualizado_en,
         resp.nombre_completo AS responsable,
         COALESCE(pl.pendientes, 0)::int   AS plazos_pendientes,
         to_char(pl.proximo, 'YYYY-MM-DD') AS proximo_vencimiento,
         (SELECT count(*) FROM documento d
           WHERE d.causa_id = c.id AND d.eliminado_en IS NULL)::int AS cantidad_documentos,
         (SELECT count(*) FROM movimiento_causa m
           WHERE m.causa_id = c.id)::int                            AS cantidad_movimientos,
         (SELECT count(*) FROM tarea ta
           WHERE ta.causa_id = c.id
             AND ta.estado IN ('PENDIENTE', 'EN_CURSO'))::int        AS cantidad_tareas_abiertas
    FROM causa c
    JOIN estado_causa ec ON ec.id = c.estado_causa_id
    JOIN fuero        f  ON f.id  = c.fuero_id
    JOIN jurisdiccion j  ON j.id  = f.jurisdiccion_id
    LEFT JOIN tribunal   t  ON t.id  = c.tribunal_id
    LEFT JOIN tipo_causa tc ON tc.id = c.tipo_causa_id
    ${RESPONSABLE}
    ${PLAZOS_PENDIENTES}
   WHERE c.id = $1 AND c.eliminado_en IS NULL
`;

export async function buscarPorId(id: string): Promise<CausaDetalle | undefined> {
  const { rows } = await obtenerPool().query<CausaDetalle>(SQL_DETALLE, [id]);
  return rows[0];
}

export async function partesDe(causaId: string): Promise<ParteCausa[]> {
  const { rows } = await obtenerPool().query<ParteCausa>(
    `SELECT pc.id,
            pc.persona_id,
            COALESCE(p.razon_social, p.apellido || ', ' || p.nombre) AS nombre_completo,
            p.tipo_persona,
            CASE WHEN p.numero_documento IS NULL THEN NULL
                 ELSE COALESCE(p.tipo_documento, 'DOC') || ' ' || p.numero_documento
            END AS documento,
            p.email,
            p.telefono,
            pc.caracter,
            pc.es_cliente
       FROM parte_causa pc
       JOIN persona p ON p.id = pc.persona_id
      WHERE pc.causa_id = $1 AND p.eliminado_en IS NULL
      -- El cliente del estudio primero: es la parte que más se consulta.
      ORDER BY pc.es_cliente DESC, nombre_completo`,
    [causaId],
  );
  return rows;
}

export async function profesionalesDe(causaId: string): Promise<ProfesionalCausa[]> {
  const { rows } = await obtenerPool().query<ProfesionalCausa>(
    `SELECT pc.id,
            pc.usuario_id,
            ${NOMBRE_USUARIO} AS nombre_completo,
            u.matricula,
            pc.rol_en_causa,
            to_char(pc.fecha_asignacion, 'YYYY-MM-DD') AS fecha_asignacion
       FROM profesional_causa pc
       JOIN usuario u ON u.id = pc.usuario_id
      WHERE pc.causa_id = $1 AND pc.fecha_baja IS NULL
      ORDER BY CASE pc.rol_en_causa
                 WHEN 'TITULAR'      THEN 0
                 WHEN 'APODERADO'    THEN 1
                 WHEN 'PATROCINANTE' THEN 2
                 ELSE 3
               END, nombre_completo`,
    [causaId],
  );
  return rows;
}

export async function movimientosDe(causaId: string): Promise<MovimientoCausa[]> {
  const { rows } = await obtenerPool().query<MovimientoCausa>(
    `SELECT m.id,
            to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
            m.tipo,
            m.descripcion,
            m.origen,
            ${NOMBRE_USUARIO} AS registrado_por
       FROM movimiento_causa m
       LEFT JOIN usuario u ON u.id = m.registrado_por
      WHERE m.causa_id = $1
      ORDER BY m.fecha DESC, m.creado_en DESC`,
    [causaId],
  );
  return rows;
}

export async function plazosDe(causaId: string): Promise<PlazoCausa[]> {
  const { rows } = await obtenerPool().query<PlazoCausa>(
    `SELECT p.id,
            p.descripcion,
            tp.nombre AS tipo_plazo,
            tp.articulo_referencia,
            to_char(p.fecha_notificacion, 'YYYY-MM-DD') AS fecha_notificacion,
            to_char(p.fecha_vencimiento,  'YYYY-MM-DD') AS fecha_vencimiento,
            p.estado,
            p.computo,
            p.cantidad_dias,
            ${NOMBRE_USUARIO} AS responsable,
            CASE WHEN p.estado IN ('PENDIENTE', 'SUSPENDIDO')
                 THEN (p.fecha_vencimiento - CURRENT_DATE)
            END AS dias_restantes
       FROM plazo p
       LEFT JOIN tipo_plazo tp ON tp.id = p.tipo_plazo_id
       LEFT JOIN usuario    u  ON u.id  = p.responsable_id
      WHERE p.causa_id = $1
      ORDER BY p.fecha_vencimiento`,
    [causaId],
  );
  return rows;
}

export async function documentosDe(causaId: string): Promise<DocumentoCausa[]> {
  const { rows } = await obtenerPool().query<DocumentoCausa>(
    `SELECT d.id,
            d.nombre_original,
            td.nombre AS tipo_documento,
            d.mime_type,
            d.tamano_bytes,
            d.estado_extraccion,
            d.descripcion,
            d.fecha_subida,
            ${NOMBRE_USUARIO} AS subido_por
       FROM documento d
       LEFT JOIN tipo_documento td ON td.id = d.tipo_documento_id
       LEFT JOIN usuario        u  ON u.id  = d.subido_por
      WHERE d.causa_id = $1 AND d.eliminado_en IS NULL
      ORDER BY d.fecha_subida DESC`,
    [causaId],
  );
  return rows;
}

export async function tareasDe(causaId: string): Promise<TareaCausa[]> {
  const { rows } = await obtenerPool().query<TareaCausa>(
    `SELECT t.id,
            t.titulo,
            t.descripcion,
            t.estado,
            t.prioridad,
            to_char(t.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
            ${NOMBRE_USUARIO} AS asignada_a,
            t.causa_id,
            NULL::varchar AS caratula,
            NULL::varchar AS numero_expediente
       FROM tarea t
       LEFT JOIN usuario u ON u.id = t.asignada_a
      WHERE t.causa_id = $1
      -- Las abiertas primero, y dentro de ellas lo que vence antes.
      ORDER BY CASE WHEN t.estado IN ('PENDIENTE', 'EN_CURSO') THEN 0 ELSE 1 END,
               t.fecha_vencimiento NULLS LAST,
               t.creado_en DESC`,
    [causaId],
  );
  return rows;
}

export async function existeExpediente(numero: string): Promise<boolean> {
  const { rows } = await obtenerPool().query(
    'SELECT 1 FROM causa WHERE numero_expediente = $1 AND eliminado_en IS NULL LIMIT 1',
    [numero],
  );
  return rows.length > 0;
}

/**
 * Alta de causa.
 *
 * Quien la crea queda asignado como profesional titular en la misma
 * transacción: una causa sin responsable no aparece en "mis causas" ni se le
 * pueden delegar plazos, así que dejarla a medias sería peor que no crearla.
 * El titular se puede cambiar después desde el detalle.
 */
export async function crear(datos: DatosCrearCausa, creadoPor: string): Promise<string> {
  return enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO causa (caratula, numero_expediente, fuero_id, estado_causa_id,
                          tribunal_id, tipo_causa_id, fecha_inicio, monto_reclamado,
                          moneda, observaciones, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        datos.caratula,
        datos.numero_expediente ?? null,
        datos.fuero_id,
        datos.estado_causa_id,
        datos.tribunal_id ?? null,
        datos.tipo_causa_id ?? null,
        datos.fecha_inicio,
        datos.monto_reclamado ?? null,
        datos.moneda,
        datos.observaciones ?? null,
        creadoPor,
      ],
    );

    // RETURNING siempre trae una fila en un INSERT exitoso; si no la trajo, algo
    // falló de un modo que no conviene disimular con un id vacío.
    const id = rows[0]?.id;
    if (!id) throw new Error('El alta de la causa no devolvió un identificador');

    await cliente.query(
      `INSERT INTO profesional_causa (causa_id, usuario_id, rol_en_causa)
       VALUES ($1, $2, 'TITULAR')`,
      [id, creadoPor],
    );

    return id;
  });
}

/**
 * Edición de la causa.
 *
 * Devuelve false si no actualizó ninguna fila, que es lo que pasa cuando el id
 * no existe o la causa ya estaba dada de baja. El servicio lo traduce a 404.
 */
export async function actualizar(id: string, datos: DatosEditarCausa): Promise<boolean> {
  const { rowCount } = await obtenerPool().query(
    `UPDATE causa
        SET caratula          = $2,
            numero_expediente = $3,
            fuero_id          = $4,
            estado_causa_id   = $5,
            tribunal_id       = $6,
            tipo_causa_id     = $7,
            fecha_inicio      = $8,
            fecha_cierre      = $9,
            monto_reclamado   = $10,
            moneda            = $11,
            observaciones     = $12
      WHERE id = $1 AND eliminado_en IS NULL`,
    [
      id,
      datos.caratula,
      datos.numero_expediente ?? null,
      datos.fuero_id,
      datos.estado_causa_id,
      datos.tribunal_id ?? null,
      datos.tipo_causa_id ?? null,
      datos.fecha_inicio,
      datos.fecha_cierre ?? null,
      datos.monto_reclamado ?? null,
      datos.moneda,
      datos.observaciones ?? null,
    ],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Baja de la causa: marca `eliminado_en` y no borra nada.
 *
 * Un expediente arrastra plazos, documentos, movimientos y costas; borrarlo de
 * verdad destruiría el historial del estudio y rompería la auditoría, que
 * referencia la entidad por id. Todas las consultas ya filtran
 * `eliminado_en IS NULL`, así que deja de aparecer en la aplicación.
 */
export async function eliminar(id: string): Promise<boolean> {
  const { rowCount } = await obtenerPool().query(
    'UPDATE causa SET eliminado_en = now() WHERE id = $1 AND eliminado_en IS NULL',
    [id],
  );
  return (rowCount ?? 0) > 0;
}

/** Igual que existeExpediente, pero ignorando la causa que se está editando. */
export async function existeExpedienteEnOtra(numero: string, exceptoId: string): Promise<boolean> {
  const { rows } = await obtenerPool().query(
    `SELECT 1 FROM causa
      WHERE numero_expediente = $1 AND eliminado_en IS NULL AND id <> $2
      LIMIT 1`,
    [numero, exceptoId],
  );
  return rows.length > 0;
}

export async function agregarParte(causaId: string, datos: DatosAgregarParte): Promise<string> {
  const { rows } = await obtenerPool().query<{ id: string }>(
    `INSERT INTO parte_causa (causa_id, persona_id, caracter, es_cliente, observaciones)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [causaId, datos.persona_id, datos.caracter, datos.es_cliente, datos.observaciones ?? null],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('El alta de la parte no devolvió un identificador');
  return id;
}

export async function existeParte(causaId: string, personaId: string, caracter: string): Promise<boolean> {
  const { rows } = await obtenerPool().query(
    `SELECT 1 FROM parte_causa
      WHERE causa_id = $1 AND persona_id = $2 AND caracter = $3
      LIMIT 1`,
    [causaId, personaId, caracter],
  );
  return rows.length > 0;
}

/** Datos de la parte antes de quitarla, para que la auditoría conserve qué había. */
export async function buscarParte(causaId: string, parteId: string): Promise<ParteCausa | undefined> {
  const { rows } = await obtenerPool().query<ParteCausa>(
    `SELECT pc.id,
            pc.persona_id,
            COALESCE(p.razon_social, p.apellido || ', ' || p.nombre) AS nombre_completo,
            p.tipo_persona,
            CASE WHEN p.numero_documento IS NULL THEN NULL
                 ELSE COALESCE(p.tipo_documento, 'DOC') || ' ' || p.numero_documento
            END AS documento,
            p.email,
            p.telefono,
            pc.caracter,
            pc.es_cliente
       FROM parte_causa pc
       JOIN persona p ON p.id = pc.persona_id
      WHERE pc.causa_id = $1 AND pc.id = $2`,
    [causaId, parteId],
  );
  return rows[0];
}

/**
 * Quita a una parte de la causa.
 *
 * Acá sí se borra la fila: `parte_causa` es el vínculo, no el dato. La persona
 * sigue en la agenda y el historial de la causa (movimientos, documentos) no
 * depende de este registro.
 */
export async function quitarParte(causaId: string, parteId: string): Promise<boolean> {
  const { rowCount } = await obtenerPool().query(
    'DELETE FROM parte_causa WHERE causa_id = $1 AND id = $2',
    [causaId, parteId],
  );
  return (rowCount ?? 0) > 0;
}

export async function agregarProfesional(
  causaId: string,
  datos: DatosAgregarProfesional,
): Promise<string> {
  const { rows } = await obtenerPool().query<{ id: string }>(
    `INSERT INTO profesional_causa (causa_id, usuario_id, rol_en_causa)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [causaId, datos.usuario_id, datos.rol_en_causa],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('La asignación del profesional no devolvió un identificador');
  return id;
}

/** Un profesional ya asignado y sin fecha de baja: lo que impide el índice único. */
export async function estaAsignado(causaId: string, usuarioId: string): Promise<boolean> {
  const { rows } = await obtenerPool().query(
    `SELECT 1 FROM profesional_causa
      WHERE causa_id = $1 AND usuario_id = $2 AND fecha_baja IS NULL
      LIMIT 1`,
    [causaId, usuarioId],
  );
  return rows.length > 0;
}

export async function buscarProfesional(
  causaId: string,
  vinculoId: string,
): Promise<ProfesionalCausa | undefined> {
  const { rows } = await obtenerPool().query<ProfesionalCausa>(
    `SELECT pc.id,
            pc.usuario_id,
            ${NOMBRE_USUARIO} AS nombre_completo,
            u.matricula,
            pc.rol_en_causa,
            to_char(pc.fecha_asignacion, 'YYYY-MM-DD') AS fecha_asignacion
       FROM profesional_causa pc
       JOIN usuario u ON u.id = pc.usuario_id
      WHERE pc.causa_id = $1 AND pc.id = $2 AND pc.fecha_baja IS NULL`,
    [causaId, vinculoId],
  );
  return rows[0];
}

/**
 * Desasigna a un profesional poniéndole fecha de baja, sin borrar la fila.
 *
 * A diferencia de las partes, acá el registro **es** información: deja asentado
 * quién trabajó el expediente y hasta cuándo, que es lo que permite explicar
 * una actuación pasada. El índice único solo mira las filas sin fecha de baja,
 * así que la persona puede volver a asignarse más adelante.
 */
export async function quitarProfesional(causaId: string, vinculoId: string): Promise<boolean> {
  const { rowCount } = await obtenerPool().query(
    `UPDATE profesional_causa
        SET fecha_baja = CURRENT_DATE
      WHERE causa_id = $1 AND id = $2 AND fecha_baja IS NULL`,
    [causaId, vinculoId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Un integrante del estudio que puede recibir una asignación.
 *
 * La clave foránea garantiza que el usuario exista, pero no que esté activo, y
 * tampoco da un mensaje usable: sin esta comprobación, un id inexistente
 * llegaría al INSERT y volvería como violación de restricción (un 500) en
 * lugar de un error en el campo.
 */
export async function esProfesionalAsignable(usuarioId: string): Promise<boolean> {
  const { rows } = await obtenerPool().query(
    'SELECT 1 FROM usuario WHERE id = $1 AND activo LIMIT 1',
    [usuarioId],
  );
  return rows.length > 0;
}

/**
 * Cuántos integrantes activos quedan a cargo del expediente.
 *
 * Cuenta solo usuarios `activo`: una asignación a alguien que ya no trabaja en
 * el estudio no deja al expediente atendido, así que no debería alcanzar para
 * permitir que se desasigne a quien sí lo está.
 */
export async function contarProfesionales(causaId: string): Promise<number> {
  const { rows } = await obtenerPool().query<{ total: string }>(
    `SELECT count(*) AS total
       FROM profesional_causa pc
       JOIN usuario u ON u.id = pc.usuario_id AND u.activo
      WHERE pc.causa_id = $1 AND pc.fecha_baja IS NULL`,
    [causaId],
  );
  return Number.parseInt(rows[0]?.total ?? '0', 10);
}
