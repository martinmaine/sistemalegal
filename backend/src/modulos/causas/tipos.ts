/** Fila del listado de causas, tal como viaja al frontend. */
export interface CausaListada {
  id: string;
  numero_expediente: string | null;
  caratula: string;
  /** Texto YYYY-MM-DD: la base guarda DATE y convertirlo a Date corre el día por zona horaria. */
  fecha_inicio: string;
  estado: string;
  estado_codigo: string;
  es_final: boolean;
  fuero: string;
  tribunal: string | null;
  /** Nombre del profesional titular de la causa, si hay alguno asignado. */
  responsable: string | null;
  plazos_pendientes: number;
  /** Vencimiento más próximo entre los plazos pendientes. Lo que permite ordenar por urgencia. */
  proximo_vencimiento: string | null;
}

export interface CausaDetalle extends CausaListada {
  tipo_causa: string | null;
  jurisdiccion: string | null;
  tribunal_domicilio: string | null;
  fecha_cierre: string | null;
  monto_reclamado: string | null;
  moneda: string;
  observaciones: string | null;
  creado_en: string;
  actualizado_en: string;
  cantidad_documentos: number;
  cantidad_movimientos: number;
  cantidad_tareas_abiertas: number;
}

export interface ParteCausa {
  id: string;
  persona_id: string;
  nombre_completo: string;
  tipo_persona: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  caracter: string;
  es_cliente: boolean;
}

export interface ProfesionalCausa {
  id: string;
  usuario_id: string;
  nombre_completo: string;
  matricula: string | null;
  rol_en_causa: string;
  fecha_asignacion: string;
}

export interface MovimientoCausa {
  id: string;
  fecha: string;
  tipo: string | null;
  descripcion: string;
  origen: string;
  registrado_por: string | null;
}

export interface PlazoCausa {
  id: string;
  descripcion: string;
  tipo_plazo: string | null;
  articulo_referencia: string | null;
  fecha_notificacion: string;
  fecha_vencimiento: string;
  estado: string;
  computo: string;
  cantidad_dias: number;
  responsable: string | null;
  dias_restantes: number | null;
}

export interface DocumentoCausa {
  id: string;
  nombre_original: string;
  tipo_documento: string | null;
  mime_type: string;
  tamano_bytes: string;
  estado_extraccion: string;
  descripcion: string | null;
  fecha_subida: string;
  subido_por: string | null;
}

export interface TareaCausa {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  fecha_vencimiento: string | null;
  asignada_a: string | null;
  causa_id: string | null;
  caratula: string | null;
  numero_expediente: string | null;
}
