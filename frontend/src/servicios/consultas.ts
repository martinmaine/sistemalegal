import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, consulta } from './api';
import type {
  Catalogos,
  CausaDetalle,
  CausaListada,
  DetalleCausa,
  DetallePersona,
  DocumentoCausa,
  EstadoSalud,
  MovimientoCausa,
  Pagina,
  Panel,
  ParteCausa,
  PersonaDetalle,
  PersonaListada,
  PlazoCausa,
  ProfesionalCausa,
  TareaCausa,
} from '../tipos/api';

/**
 * Acceso a datos remotos.
 *
 * Todas las consultas pasan por acá: ninguna pantalla llama a fetch por su
 * cuenta. Eso mantiene las claves de caché en un solo lugar —si estuvieran
 * repartidas, invalidar después de un alta sería adivinar— y hace que los
 * estados de carga y error se comporten igual en todo el producto.
 */

/** Claves de caché. Jerárquicas, para poder invalidar por rama. */
export const claves = {
  panel: ['panel'] as const,
  catalogos: ['catalogos'] as const,
  causas: ['causas'] as const,
  listaCausas: (filtros: FiltrosCausa) => ['causas', 'lista', filtros] as const,
  causa: (id: string) => ['causas', 'detalle', id] as const,
  pestanaCausa: (id: string, pestana: string) => ['causas', 'detalle', id, pestana] as const,
  personas: ['personas'] as const,
  listaPersonas: (filtros: FiltrosPersona) => ['personas', 'lista', filtros] as const,
  persona: (id: string) => ['personas', 'detalle', id] as const,
  salud: ['salud'] as const,
};

export interface FiltrosCausa {
  pagina: number;
  tamano: number;
  busqueda?: string;
  estado?: string;
  fuero?: string;
  tribunal?: string;
  responsable?: string;
  vigencia: 'todas' | 'activas' | 'cerradas';
  orden: 'fecha_inicio' | 'caratula' | 'numero_expediente' | 'estado' | 'proximo_vencimiento';
  direccion: 'asc' | 'desc';
}

export interface FiltrosPersona {
  pagina: number;
  tamano: number;
  busqueda?: string;
  tipo?: 'FISICA' | 'JURIDICA';
  soloClientes?: boolean;
}

/* --- Panel ----------------------------------------------------------------- */

export function usePanel() {
  return useQuery({
    queryKey: claves.panel,
    queryFn: () => api.obtener<Panel>('/api/panel'),
  });
}

/* --- Catálogos -------------------------------------------------------------
   Cambian muy poco: se cachean por una hora para no repetir la consulta en
   cada pantalla que arma un desplegable. */

export function useCatalogos() {
  return useQuery({
    queryKey: claves.catalogos,
    queryFn: () => api.obtener<Catalogos>('/api/catalogos'),
    staleTime: 60 * 60 * 1000,
  });
}

/* --- Causas ---------------------------------------------------------------- */

export function useCausas(filtros: FiltrosCausa) {
  return useQuery({
    queryKey: claves.listaCausas(filtros),
    queryFn: () =>
      api.obtener<Pagina<CausaListada>>(
        `/api/causas${consulta({
          pagina: filtros.pagina,
          tamano: filtros.tamano,
          busqueda: filtros.busqueda,
          estado: filtros.estado,
          fuero: filtros.fuero,
          tribunal: filtros.tribunal,
          responsable: filtros.responsable,
          vigencia: filtros.vigencia,
          orden: filtros.orden,
          direccion: filtros.direccion,
        })}`,
      ),
    // Mantiene la tabla anterior mientras llega la nueva página: sin esto, cada
    // cambio de filtro vaciaría la pantalla y el contenido saltaría.
    placeholderData: (previo) => previo,
  });
}

export function useCausa(id: string | undefined) {
  return useQuery({
    queryKey: claves.causa(id ?? ''),
    queryFn: () => api.obtener<DetalleCausa>(`/api/causas/${id}`),
    enabled: Boolean(id),
  });
}

/** Contenido de una pestaña del detalle. Se pide recién cuando la pestaña se abre. */
function usePestanaCausa<T>(id: string | undefined, pestana: string, activa: boolean) {
  return useQuery({
    queryKey: claves.pestanaCausa(id ?? '', pestana),
    queryFn: () => api.obtener<{ datos: T[] }>(`/api/causas/${id}/${pestana}`).then((r) => r.datos),
    enabled: Boolean(id) && activa,
  });
}

export const useMovimientosCausa = (id: string | undefined, activa: boolean) =>
  usePestanaCausa<MovimientoCausa>(id, 'movimientos', activa);

export const usePlazosCausa = (id: string | undefined, activa: boolean) =>
  usePestanaCausa<PlazoCausa>(id, 'plazos', activa);

export const useDocumentosCausa = (id: string | undefined, activa: boolean) =>
  usePestanaCausa<DocumentoCausa>(id, 'documentos', activa);

export const useTareasCausa = (id: string | undefined, activa: boolean) =>
  usePestanaCausa<TareaCausa>(id, 'tareas', activa);

export interface DatosNuevaCausa {
  caratula: string;
  numero_expediente?: string;
  fuero_id: string;
  estado_causa_id: string;
  tribunal_id?: string;
  tipo_causa_id?: string;
  fecha_inicio: string;
  observaciones?: string;
}

/**
 * Lo que acepta la edición: todo lo del alta más lo que solo tiene sentido
 * sobre una causa ya abierta —cerrarla, registrar el monto reclamado—.
 */
export interface DatosEditarCausa extends DatosNuevaCausa {
  fecha_cierre?: string;
  monto_reclamado?: number;
  moneda?: string;
}

export function useCrearCausa() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosNuevaCausa) =>
      api.enviar<{ causa: CausaDetalle }>('/api/causas', datos).then((r) => r.causa),
    onSuccess: () => {
      // El alta cambia el listado y las cifras del panel; ambos se refrescan
      // solos en lugar de quedar mostrando el estado anterior.
      void cliente.invalidateQueries({ queryKey: claves.causas });
      void cliente.invalidateQueries({ queryKey: claves.panel });
    },
  });
}

/* --- Personas -------------------------------------------------------------- */

export function usePersonas(filtros: FiltrosPersona) {
  return useQuery({
    queryKey: claves.listaPersonas(filtros),
    queryFn: () =>
      api.obtener<Pagina<PersonaListada>>(
        `/api/personas${consulta({
          pagina: filtros.pagina,
          tamano: filtros.tamano,
          busqueda: filtros.busqueda,
          tipo: filtros.tipo,
          soloClientes: filtros.soloClientes ? 'true' : undefined,
        })}`,
      ),
    placeholderData: (previo) => previo,
  });
}

export function usePersona(id: string | undefined) {
  return useQuery({
    queryKey: claves.persona(id ?? ''),
    queryFn: () => api.obtener<DetallePersona>(`/api/personas/${id}`),
    enabled: Boolean(id),
  });
}

/* --- Diagnóstico ----------------------------------------------------------- */

export function useSalud() {
  return useQuery({
    queryKey: claves.salud,
    queryFn: () => api.obtener<EstadoSalud>('/health'),
    // El diagnóstico sirve para ver el estado de ahora, no uno cacheado.
    staleTime: 0,
    gcTime: 0,
  });
}

/* --- Escritura de causas ---------------------------------------------------
   Cada mutación invalida exactamente lo que dejó viejo. Invalidar de más
   obliga a recargas innecesarias; invalidar de menos deja la pantalla
   mostrando datos que ya no son. */

export function useEditarCausa(id: string) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosEditarCausa) =>
      api.reemplazar<{ causa: CausaDetalle }>(`/api/causas/${id}`, datos).then((r) => r.causa),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: claves.causa(id) });
      // El listado muestra carátula, estado y responsable: cualquiera de los
      // tres pudo cambiar. El panel cuenta causas activas, que depende del estado.
      void cliente.invalidateQueries({ queryKey: claves.causas });
      void cliente.invalidateQueries({ queryKey: claves.panel });
    },
  });
}

export function useEliminarCausa() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.eliminar<{ causa: CausaDetalle }>(`/api/causas/${id}`),
    onSuccess: (_resultado, id) => {
      cliente.removeQueries({ queryKey: claves.causa(id) });
      void cliente.invalidateQueries({ queryKey: claves.causas });
      void cliente.invalidateQueries({ queryKey: claves.panel });
    },
  });
}

export interface DatosParte {
  persona_id: string;
  caracter: string;
  es_cliente: boolean;
  observaciones?: string;
}

export function useAgregarParte(causaId: string) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosParte) =>
      api.enviar<{ parte: ParteCausa }>(`/api/causas/${causaId}/partes`, datos).then((r) => r.parte),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: claves.causa(causaId) });
      // La ficha de la persona lista las causas en que interviene, y el listado
      // de la agenda muestra en cuántas: las dos quedaron viejas.
      void cliente.invalidateQueries({ queryKey: claves.personas });
    },
  });
}

export function useQuitarParte(causaId: string) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (parteId: string) =>
      api.eliminar<{ parte: ParteCausa }>(`/api/causas/${causaId}/partes/${parteId}`),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: claves.causa(causaId) });
      void cliente.invalidateQueries({ queryKey: claves.personas });
    },
  });
}

export interface DatosProfesional {
  usuario_id: string;
  rol_en_causa: string;
}

export function useAsignarProfesional(causaId: string) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosProfesional) =>
      api
        .enviar<{ profesional: ProfesionalCausa }>(`/api/causas/${causaId}/profesionales`, datos)
        .then((r) => r.profesional),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: claves.causa(causaId) });
      // El responsable que muestra el listado sale de estas asignaciones.
      void cliente.invalidateQueries({ queryKey: claves.causas });
    },
  });
}

export function useDesasignarProfesional(causaId: string) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (vinculoId: string) =>
      api.eliminar<{ profesional: ProfesionalCausa }>(
        `/api/causas/${causaId}/profesionales/${vinculoId}`,
      ),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: claves.causa(causaId) });
      void cliente.invalidateQueries({ queryKey: claves.causas });
    },
  });
}

/* --- Escritura de personas ------------------------------------------------- */

export interface DatosPersona {
  tipo_persona: 'FISICA' | 'JURIDICA';
  nombre?: string;
  apellido?: string;
  razon_social?: string;
  tipo_documento?: string;
  numero_documento?: string;
  cuit_cuil?: string;
  email?: string;
  telefono?: string;
  domicilio?: string;
  localidad?: string;
  provincia?: string;
  observaciones?: string;
}

export function useCrearPersona() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosPersona) =>
      api.enviar<{ persona: PersonaDetalle }>('/api/personas', datos).then((r) => r.persona),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: claves.personas });
    },
  });
}

export function useEditarPersona(id: string) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosPersona) =>
      api.reemplazar<{ persona: PersonaDetalle }>(`/api/personas/${id}`, datos).then((r) => r.persona),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: claves.personas });
      // Los expedientes muestran el nombre de sus partes: si cambió, hay que
      // volver a pedirlos para no mostrar el anterior.
      void cliente.invalidateQueries({ queryKey: claves.causas });
    },
  });
}

export function useEliminarPersona() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.eliminar<{ persona: PersonaDetalle }>(`/api/personas/${id}`),
    onSuccess: (_resultado, id) => {
      cliente.removeQueries({ queryKey: claves.persona(id) });
      void cliente.invalidateQueries({ queryKey: claves.personas });
    },
  });
}
