import type { SesionUsuario } from '../auth/tipos';
import * as repositorio from './repositorio';

/**
 * Armado del panel de inicio.
 *
 * El contenido depende de los permisos del usuario: el panel no es el mismo
 * para un jefe de estudio que para un empleado administrativo. Y eso se decide
 * acá, en el servidor. Si se decidiera en el frontend, bastaría abrir las
 * herramientas del navegador para ver lo que no corresponde.
 */

/** Ventana de "lo que viene": una semana de trabajo. */
const DIAS_HORIZONTE = 7;
const TOPE_LISTA = 6;

export interface Panel {
  indicadores: repositorio.Indicadores;
  plazosProximos: repositorio.PlazoProximo[];
  tareas: repositorio.TareaPanel[];
  eventos: repositorio.EventoPanel[];
  actividad: repositorio.ActividadPanel[];
  causasRecientes: repositorio.CausaReciente[];
  /** Ausente cuando el usuario no tiene permiso para ver información financiera. */
  finanzas?: repositorio.ResumenFinanciero;
  diasHorizonte: number;
}

export async function armarPanel(sesion: SesionUsuario): Promise<Panel> {
  const puedeVerPlazos = sesion.permisos.includes('plazo.ver');
  const puedeVerTareas = sesion.permisos.includes('tarea.ver');
  const puedeVerCausas = sesion.permisos.includes('causa.ver');
  const puedeVerAgenda = sesion.permisos.includes('calendario.ver');
  const puedeVerFinanzas = sesion.permisos.includes('costa.ver');

  // Las consultas son independientes entre sí: en serie, el panel tardaría la
  // suma de todas en lugar de la más lenta.
  const [indicadores, plazosProximos, tareas, eventos, actividad, causasRecientes, finanzas] =
    await Promise.all([
      repositorio.indicadores(sesion.id, DIAS_HORIZONTE),
      puedeVerPlazos ? repositorio.plazosProximos(DIAS_HORIZONTE, TOPE_LISTA) : [],
      puedeVerTareas ? repositorio.tareasAbiertas(sesion.id, TOPE_LISTA) : [],
      puedeVerAgenda ? repositorio.eventosProximos(DIAS_HORIZONTE, TOPE_LISTA) : [],
      puedeVerCausas ? repositorio.actividadReciente(TOPE_LISTA) : [],
      puedeVerCausas ? repositorio.causasRecientes(TOPE_LISTA) : [],
      puedeVerFinanzas ? repositorio.resumenFinanciero() : undefined,
    ]);

  return {
    indicadores,
    plazosProximos,
    tareas,
    eventos,
    actividad,
    causasRecientes,
    finanzas,
    diasHorizonte: DIAS_HORIZONTE,
  };
}
