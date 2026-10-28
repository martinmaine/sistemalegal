import type { DiaDelComputo } from './computo';

/** Fila del listado de plazos y de la agenda. */
export interface PlazoListado {
  id: string;
  causa_id: string;
  caratula: string;
  numero_expediente: string | null;
  descripcion: string;
  tipo_plazo: string | null;
  articulo_referencia: string | null;
  /** Texto `YYYY-MM-DD`: la base guarda DATE y convertirlo a Date corre el día. */
  fecha_notificacion: string;
  fecha_inicio_computo: string;
  fecha_vencimiento: string;
  fecha_vencimiento_original: string;
  cantidad_dias: number;
  computo: string;
  estado: string;
  responsable: string | null;
  responsable_id: string | null;
  fecha_cumplimiento: string | null;
  /** Negativo si ya venció. Lo calcula la base contra su propia fecha. */
  dias_restantes: number | null;
  /** Si tiene una suspensión sin fecha de reanudación. */
  suspendido_sin_fin: boolean;
}

export interface PlazoDetalle extends PlazoListado {
  tipo_plazo_id: string | null;
  observaciones: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface SuspensionPlazo {
  id: string;
  fecha_desde: string;
  fecha_hasta: string | null;
  motivo: string;
  registrado_por: string | null;
}

/**
 * El plazo con la explicación de cómo se llegó a su vencimiento.
 *
 * El cómputo se rehace al pedir el detalle en lugar de guardarlo: así la
 * explicación refleja siempre el calendario y las suspensiones de ahora, y no
 * una copia que puede haber quedado vieja.
 */
export interface DetallePlazo {
  plazo: PlazoDetalle;
  suspensiones: SuspensionPlazo[];
  computo: {
    explicacion: string[];
    dias: DiaDelComputo[];
    /** Qué da el cálculo hoy. Si no coincide con lo guardado, se avisa. */
    fecha_vencimiento_calculada: string;
    coincide_con_lo_guardado: boolean;
  } | null;
  /** Por qué no se pudo explicar el cómputo, si no se pudo. */
  error_computo?: string;
}
