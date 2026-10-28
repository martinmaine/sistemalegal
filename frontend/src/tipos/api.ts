/**
 * Contratos compartidos con el backend.
 *
 * Se mantienen a mano y reflejan exactamente lo que devuelven los endpoints de
 * backend/src/modulos. Cuando el contrato crezca conviene generarlos desde el
 * backend para que no se desincronicen.
 */

export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

/* --- Sesión ---------------------------------------------------------------- */

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  rolNombre: string;
  jerarquia: number;
  permisos: string[];
}

export interface RespuestaSesion {
  accessToken: string;
  expiraEnMinutos: number;
  usuario: Usuario;
}

/* --- Causas ---------------------------------------------------------------- */

export interface CausaListada {
  id: string;
  numero_expediente: string | null;
  caratula: string;
  fecha_inicio: string;
  estado: string;
  estado_codigo: string;
  es_final: boolean;
  fuero: string;
  tribunal: string | null;
  responsable: string | null;
  plazos_pendientes: number;
  proximo_vencimiento: string | null;
}

export interface CausaDetalle extends CausaListada {
  /** Ids de los catálogos, para precargar el formulario de edición. */
  fuero_id: string;
  estado_causa_id: string;
  tribunal_id: string | null;
  tipo_causa_id: string | null;
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

export interface DetalleCausa {
  causa: CausaDetalle;
  partes: ParteCausa[];
  profesionales: ProfesionalCausa[];
}

export interface MovimientoCausa {
  id: string;
  fecha: string;
  tipo: string | null;
  descripcion: string;
  origen: string;
  registrado_por: string | null;
}

/* --- Plazos ----------------------------------------------------------------
   La pestaña del expediente y la agenda muestran el mismo dato, así que
   comparten el tipo. */

export interface PlazoListado {
  id: string;
  causa_id: string;
  caratula: string;
  numero_expediente: string | null;
  descripcion: string;
  tipo_plazo: string | null;
  articulo_referencia: string | null;
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
  /** Negativo si ya venció. */
  dias_restantes: number | null;
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

/** Un día del cómputo: contó, o no contó y por qué. */
export interface DiaDelComputo {
  fecha: string;
  salteadoPor?: 'FIN_DE_SEMANA' | 'INHABIL' | 'SUSPENDIDO';
  detalle?: string;
  numero?: number;
}

export interface ExplicacionComputo {
  explicacion: string[];
  dias: DiaDelComputo[];
  fecha_vencimiento_calculada: string;
  coincide_con_lo_guardado: boolean;
}

export interface DetallePlazo {
  plazo: PlazoDetalle;
  suspensiones: SuspensionPlazo[];
  computo: ExplicacionComputo | null;
  error_computo?: string;
}

/** Previsualización: lo que devuelve simular antes de guardar. */
export interface SimulacionPlazo {
  fecha_inicio_computo: string;
  fecha_vencimiento: string;
  explicacion: string[];
  dias: DiaDelComputo[];
  corrido_por_inhabil: boolean;
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

/* --- Panel ----------------------------------------------------------------- */

export interface IndicadoresPanel {
  causas_activas: number;
  plazos_por_vencer: number;
  plazos_vencidos: number;
  tareas_abiertas: number;
  mis_tareas_abiertas: number;
  audiencias_proximas: number;
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
  es_mia: boolean;
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

export interface CausaReciente {
  id: string;
  caratula: string;
  numero_expediente: string | null;
  estado: string;
  es_final: boolean;
  fuero: string;
  actualizado_en: string;
}

export interface Panel {
  indicadores: IndicadoresPanel;
  plazosProximos: PlazoProximo[];
  tareas: TareaPanel[];
  eventos: EventoPanel[];
  actividad: ActividadPanel[];
  causasRecientes: CausaReciente[];
  finanzas?: { saldo_pendiente: string; costas_pendientes: number };
  diasHorizonte: number;
}

/* --- Catálogos ------------------------------------------------------------- */

export interface OpcionCatalogo {
  id: string;
  nombre: string;
  codigo?: string;
  fuero_id?: string;
  es_final?: boolean;
}

export interface Catalogos {
  fueros: OpcionCatalogo[];
  estados: OpcionCatalogo[];
  tribunales: OpcionCatalogo[];
  tiposCausa: OpcionCatalogo[];
  tiposDocumento: OpcionCatalogo[];
  profesionales: OpcionCatalogo[];
  tiposPlazo: OpcionTipoPlazo[];
}

/** Regla de plazo del catálogo: el formulario precarga sus valores. */
export interface OpcionTipoPlazo extends OpcionCatalogo {
  cantidad_dias: number;
  computo: string;
  articulo_referencia: string | null;
  prorrogable: boolean;
}

/* --- Personas -------------------------------------------------------------- */

export interface PersonaListada {
  id: string;
  nombre_completo: string;
  tipo_persona: string;
  documento: string | null;
  cuit_cuil: string | null;
  email: string | null;
  telefono: string | null;
  localidad: string | null;
  cantidad_causas: number;
  es_cliente: boolean;
}

export interface PersonaDetalle extends PersonaListada {
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  domicilio: string | null;
  provincia: string | null;
  observaciones: string | null;
  creado_en: string;
}

export interface CausaDePersona {
  causa_id: string;
  caratula: string;
  numero_expediente: string | null;
  estado: string;
  es_final: boolean;
  fuero: string;
  caracter: string;
  es_cliente: boolean;
  fecha_inicio: string;
}

export interface DetallePersona {
  persona: PersonaDetalle;
  causas: CausaDePersona[];
}

/* --- Diagnóstico ----------------------------------------------------------- */

export interface EstadoSalud {
  estado: string;
  entorno: string;
  base: 'conectada' | 'sin-conexion';
  detalleBase?: string;
  momento: string;
}
