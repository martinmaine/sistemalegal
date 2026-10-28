import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FiltrosCausa } from '../../servicios/consultas';

/**
 * Filtros del listado de expedientes, guardados en la URL.
 *
 * Están en la query string y no en un useState por tres razones prácticas:
 * la pantalla filtrada se puede compartir por chat o guardar en favoritos, el
 * botón Atrás del navegador deshace un filtro en lugar de salir del listado, y
 * recargar no pierde la búsqueda. Es también lo que permite que el panel
 * enlace directamente a /expedientes?vigencia=activas.
 */

const ORDENES = ['fecha_inicio', 'caratula', 'numero_expediente', 'estado', 'proximo_vencimiento'] as const;
type Orden = (typeof ORDENES)[number];

const VIGENCIAS = ['todas', 'activas', 'cerradas'] as const;
type Vigencia = (typeof VIGENCIAS)[number];

const TAMANO_PAGINA = 20;

function entre<T extends string>(valor: string | null, permitidos: readonly T[], porDefecto: T): T {
  return permitidos.includes(valor as T) ? (valor as T) : porDefecto;
}

export interface ControlFiltros {
  filtros: FiltrosCausa;
  /** Cambia uno o varios filtros y vuelve a la primera página. */
  actualizar: (cambios: Partial<Record<keyof FiltrosCausa, string | undefined>>) => void;
  irAPagina: (pagina: number) => void;
  /** Alterna el orden: misma columna invierte la dirección, otra empieza por la natural. */
  ordenarPor: (columna: Orden) => void;
  limpiar: () => void;
  hayFiltros: boolean;
}

export function useFiltrosCausa(): ControlFiltros {
  const [parametros, setParametros] = useSearchParams();

  const filtros = useMemo<FiltrosCausa>(
    () => ({
      pagina: Math.max(1, Number(parametros.get('pagina') ?? 1) || 1),
      tamano: TAMANO_PAGINA,
      busqueda: parametros.get('busqueda') ?? undefined,
      estado: parametros.get('estado') ?? undefined,
      fuero: parametros.get('fuero') ?? undefined,
      tribunal: parametros.get('tribunal') ?? undefined,
      responsable: parametros.get('responsable') ?? undefined,
      vigencia: entre<Vigencia>(parametros.get('vigencia'), VIGENCIAS, 'todas'),
      orden: entre<Orden>(parametros.get('orden'), ORDENES, 'fecha_inicio'),
      direccion: parametros.get('direccion') === 'asc' ? 'asc' : 'desc',
    }),
    [parametros],
  );

  const escribir = useCallback(
    (cambios: Record<string, string | undefined>, reiniciarPagina: boolean) => {
      const siguientes = new URLSearchParams(parametros);

      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === undefined || valor === '') siguientes.delete(clave);
        else siguientes.set(clave, valor);
      }

      // Cambiar un filtro desde la página 5 dejaría la tabla vacía si el
      // resultado filtrado tiene menos páginas. Siempre se vuelve al principio.
      if (reiniciarPagina) siguientes.delete('pagina');

      // replace: filtrar no debería llenar el historial de entradas que el
      // usuario tendría que deshacer una por una.
      setParametros(siguientes, { replace: true });
    },
    [parametros, setParametros],
  );

  const actualizar = useCallback<ControlFiltros['actualizar']>(
    (cambios) => escribir(cambios as Record<string, string | undefined>, true),
    [escribir],
  );

  const irAPagina = useCallback(
    (pagina: number) => escribir({ pagina: pagina <= 1 ? undefined : String(pagina) }, false),
    [escribir],
  );

  const ordenarPor = useCallback(
    (columna: Orden) => {
      const mismaColumna = filtros.orden === columna;
      // Las fechas empiezan por lo más reciente y los textos por la A: es lo
      // que espera quien hace clic en cada tipo de columna.
      const natural = columna === 'caratula' || columna === 'numero_expediente' ? 'asc' : 'desc';
      const direccion = mismaColumna ? (filtros.direccion === 'asc' ? 'desc' : 'asc') : natural;

      escribir({ orden: columna, direccion }, true);
    },
    [filtros.orden, filtros.direccion, escribir],
  );

  const limpiar = useCallback(() => setParametros(new URLSearchParams(), { replace: true }), [setParametros]);

  const hayFiltros = Boolean(
    filtros.busqueda ||
      filtros.estado ||
      filtros.fuero ||
      filtros.tribunal ||
      filtros.responsable ||
      filtros.vigencia !== 'todas',
  );

  return { filtros, actualizar, irAPagina, ordenarPor, limpiar, hayFiltros };
}
