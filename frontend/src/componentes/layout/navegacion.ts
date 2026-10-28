import {
  Banknote,
  BarChart3,
  CalendarClock,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Mapa de navegación del producto.
 *
 * Está en un archivo propio porque lo consumen la barra lateral, el título de
 * la barra superior y las migas: si cada uno tuviera su copia, los nombres de
 * las secciones se irían desincronizando.
 *
 * `permiso` decide si el ítem aparece. La decisión visual no es la que protege
 * nada —el backend verifica igual—, pero no tiene sentido ofrecerle a alguien
 * una sección a la que la API le va a responder 403.
 */

export interface ItemNavegacion {
  ruta: string;
  texto: string;
  icono: LucideIcon;
  permiso?: string;
  /** Coincide también con las subrutas, para marcar activa la sección en un detalle. */
  prefijo?: boolean;
}

export const NAVEGACION: ItemNavegacion[] = [
  { ruta: '/', texto: 'Inicio', icono: LayoutDashboard },
  { ruta: '/expedientes', texto: 'Expedientes', icono: FolderOpen, permiso: 'causa.ver', prefijo: true },
  { ruta: '/clientes', texto: 'Clientes y partes', icono: Users, permiso: 'persona.ver', prefijo: true },
  { ruta: '/agenda', texto: 'Agenda y plazos', icono: CalendarClock, permiso: 'plazo.ver', prefijo: true },
];

/**
 * Módulos previstos que todavía no están implementados.
 *
 * Se muestran apagados y sin enlace, en su propio grupo. La alternativa era
 * esconderlos, pero entonces un estudio no vería hacia dónde va el producto; y
 * la otra alternativa —enlazarlos a una pantalla vacía— sería prometer algo que
 * no existe. Un ítem inerte y rotulado como en desarrollo no engaña a nadie.
 */
export const NAVEGACION_PENDIENTE: { texto: string; icono: LucideIcon }[] = [
  { texto: 'Documentos', icono: FileText },
  { texto: 'Tareas', icono: ListChecks },
  { texto: 'Honorarios y costas', icono: Banknote },
  { texto: 'Informes', icono: BarChart3 },
  { texto: 'Configuración', icono: Settings },
];

/** Título de la sección actual, para la barra superior y el <title> del documento. */
export function tituloDeRuta(ruta: string): string {
  if (ruta === '/') return 'Inicio';

  const item = NAVEGACION.find((entrada) => entrada.ruta !== '/' && ruta.startsWith(entrada.ruta));
  if (item) return item.texto;
  if (ruta.startsWith('/diagnostico')) return 'Diagnóstico del sistema';
  return 'SistemaLegal';
}
