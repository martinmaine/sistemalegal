import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlarmClock, FilterX } from 'lucide-react';
import { useCatalogos, usePlazos } from '../../servicios/consultas';
import type { FiltrosPlazo } from '../../servicios/consultas';
import type { PlazoListado } from '../../tipos/api';
import { useSesion } from '../auth/ContextoSesion';
import { enDias, fecha as formatearFecha, fechaLarga } from '../../lib/formato';
import { CabeceraPagina } from '../../componentes/ui/CabeceraPagina';
import { Tarjeta } from '../../componentes/ui/Tarjeta';
import { Boton } from '../../componentes/ui/Boton';
import { FiltroSelect } from '../../componentes/ui/Campo';
import { Paginacion } from '../../componentes/ui/Paginacion';
import { EstadoPlazo, Etiqueta, Vencimiento } from '../../componentes/ui/Etiqueta';
import { ErrorCarga, EsqueletoLista, Vacio } from '../../componentes/ui/Estados';

/**
 * Agenda de plazos del estudio.
 *
 * Responde la pregunta con la que empieza el día: **qué vence y cuándo**.
 * Por eso los plazos no se muestran como una tabla plana ordenada por fecha,
 * sino agrupados por urgencia: lo vencido primero, después lo de hoy, después
 * la semana. Una lista ordenada obliga a leer fechas y restar; los grupos
 * contestan de un vistazo.
 *
 * Los filtros viven en la URL, así que "mis plazos de esta semana" se puede
 * guardar como marcador o mandar por mensaje.
 */

const TAMANO_PAGINA = 50;

const RANGOS: { valor: string; texto: string; dias?: number }[] = [
  { valor: '7', texto: 'Próximos 7 días', dias: 7 },
  { valor: '30', texto: 'Próximos 30 días', dias: 30 },
  { valor: '90', texto: 'Próximos 90 días', dias: 90 },
  { valor: 'todos', texto: 'Sin límite de fecha' },
];

/** Fecha a N días de hoy, en texto `YYYY-MM-DD`, sin corrimiento por zona horaria. */
function dentroDeDias(dias: number): string {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias))
    .toISOString()
    .slice(0, 10);
}

type Grupo = { clave: string; titulo: string; descripcion: string; plazos: PlazoListado[] };

/**
 * Agrupa por urgencia.
 *
 * El corte es por días restantes y no por semana del calendario: a un abogado
 * le importa cuánto falta, no si el vencimiento cae antes o después del domingo.
 */
function agrupar(plazos: PlazoListado[]): Grupo[] {
  const grupos: Grupo[] = [
    { clave: 'vencidos', titulo: 'Vencidos', descripcion: 'La fecha ya pasó y el plazo sigue abierto.', plazos: [] },
    { clave: 'hoy', titulo: 'Vencen hoy', descripcion: 'Última jornada para cumplirlos.', plazos: [] },
    { clave: 'semana', titulo: 'Esta semana', descripcion: 'Dentro de los próximos siete días.', plazos: [] },
    { clave: 'despues', titulo: 'Más adelante', descripcion: 'Con más de una semana por delante.', plazos: [] },
    { clave: 'detenidos', titulo: 'Detenidos', descripcion: 'Suspendidos sin fecha de reanudación.', plazos: [] },
  ];

  const porClave = new Map(grupos.map((grupo) => [grupo.clave, grupo]));

  for (const plazo of plazos) {
    // Un plazo suspendido sin reanudar no tiene vencimiento real: mezclarlo con
    // los demás por su fecha guardada diría algo que no es.
    if (plazo.suspendido_sin_fin) {
      porClave.get('detenidos')!.plazos.push(plazo);
      continue;
    }

    const dias = plazo.dias_restantes;
    if (dias === null) porClave.get('despues')!.plazos.push(plazo);
    else if (dias < 0) porClave.get('vencidos')!.plazos.push(plazo);
    else if (dias === 0) porClave.get('hoy')!.plazos.push(plazo);
    else if (dias <= 7) porClave.get('semana')!.plazos.push(plazo);
    else porClave.get('despues')!.plazos.push(plazo);
  }

  return grupos.filter((grupo) => grupo.plazos.length > 0);
}

export function PaginaAgenda() {
  const [parametros, setParametros] = useSearchParams();
  const { data: catalogos } = useCatalogos();
  const { usuario } = useSesion();

  const rango = parametros.get('rango') ?? '30';
  const responsable = parametros.get('responsable') ?? '';
  const vigencia = (parametros.get('vigencia') ?? 'abiertos') as FiltrosPlazo['vigencia'];

  const filtros = useMemo<FiltrosPlazo>(() => {
    const dias = RANGOS.find((opcion) => opcion.valor === rango)?.dias;
    return {
      pagina: Math.max(1, Number(parametros.get('pagina') ?? 1) || 1),
      tamano: TAMANO_PAGINA,
      // Sin `desde`: lo vencido tiene que aparecer, y es lo primero que se mira.
      hasta: dias === undefined ? undefined : dentroDeDias(dias),
      responsable: responsable || undefined,
      vigencia,
      orden: 'fecha_vencimiento',
      direccion: 'asc',
    };
  }, [parametros, rango, responsable, vigencia]);

  const { data, isPending, isError, error, refetch } = usePlazos(filtros);

  const escribir = useCallback(
    (cambios: Record<string, string | undefined>, reiniciarPagina = true) => {
      const siguientes = new URLSearchParams(parametros);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (!valor) siguientes.delete(clave);
        else siguientes.set(clave, valor);
      }
      if (reiniciarPagina) siguientes.delete('pagina');
      setParametros(siguientes, { replace: true });
    },
    [parametros, setParametros],
  );

  const hayFiltros = rango !== '30' || Boolean(responsable) || vigencia !== 'abiertos';
  const grupos = agrupar(data?.datos ?? []);

  return (
    <>
      <CabeceraPagina
        titulo="Agenda y plazos"
        descripcion="Qué vence y cuándo, en todos los expedientes del estudio."
        acciones={
          usuario && (
            <Boton
              variante={responsable === usuario.id ? 'primario' : 'secundario'}
              onClick={() =>
                escribir({ responsable: responsable === usuario.id ? undefined : usuario.id })
              }
              aria-pressed={responsable === usuario.id}
            >
              Solo mis plazos
            </Boton>
          )
        }
      />

      <Tarjeta>
        <div className="barra-filtros">
          <div className="barra-filtros__grupo">
            <FiltroSelect
              etiqueta="Rango de fechas"
              value={rango}
              onChange={(evento) => escribir({ rango: evento.target.value })}
              opciones={RANGOS.map((opcion) => ({ valor: opcion.valor, texto: opcion.texto }))}
              vacio="Próximos 30 días"
            />

            <FiltroSelect
              etiqueta="Responsable"
              value={responsable}
              onChange={(evento) => escribir({ responsable: evento.target.value })}
              opciones={(catalogos?.profesionales ?? []).map((p) => ({
                valor: p.id,
                texto: p.nombre,
              }))}
              vacio="Cualquier responsable"
            />

            <FiltroSelect
              etiqueta="Estado"
              value={vigencia}
              onChange={(evento) => escribir({ vigencia: evento.target.value })}
              opciones={[
                { valor: 'abiertos', texto: 'Abiertos' },
                { valor: 'cerrados', texto: 'Cerrados' },
                { valor: 'todos', texto: 'Todos' },
              ]}
              vacio="Abiertos"
            />

            {hayFiltros && (
              <button
                type="button"
                className="boton boton--sutil boton--pequeno"
                onClick={() => setParametros(new URLSearchParams(), { replace: true })}
              >
                <FilterX size={15} aria-hidden />
                Quitar filtros
              </button>
            )}
          </div>

          <p className="texto-pequeno texto-tenue" aria-live="polite" style={{ margin: 0 }}>
            {isPending
              ? 'Buscando…'
              : `${data?.total ?? 0} ${data?.total === 1 ? 'plazo' : 'plazos'}`}
          </p>
        </div>
      </Tarjeta>

      {isPending && (
        <Tarjeta>
          <EsqueletoLista />
        </Tarjeta>
      )}

      {isError && (
        <Tarjeta>
          <ErrorCarga error={error} reintentar={() => void refetch()} />
        </Tarjeta>
      )}

      {data && data.datos.length === 0 && (
        <Tarjeta>
          <Vacio
            titulo={hayFiltros ? 'Nada con esos filtros' : 'No hay plazos a la vista'}
            texto={
              hayFiltros
                ? 'Probá ampliar el rango de fechas o quitar el filtro de responsable.'
                : 'Los plazos se cargan desde el expediente, y el sistema calcula su vencimiento.'
            }
            icono={<AlarmClock size={20} aria-hidden />}
          />
        </Tarjeta>
      )}

      {grupos.map((grupo) => (
        <Tarjeta key={grupo.clave} titulo={grupo.titulo} descripcion={grupo.descripcion} sinRelleno>
          <div className="lista">
            {grupo.plazos.map((plazo) => (
              <Link
                key={plazo.id}
                to={`/expedientes/${plazo.causa_id}?pestana=plazos`}
                className="lista__item"
              >
                <span className="lista__cuerpo">
                  <span className="lista__titulo">{plazo.descripcion}</span>
                  <span className="lista__meta">
                    {plazo.caratula}
                    {plazo.numero_expediente && ` · Expte. ${plazo.numero_expediente}`}
                  </span>
                  <span className="lista__meta">
                    Vence el {fechaLarga(plazo.fecha_vencimiento)}
                    {plazo.responsable && ` · ${plazo.responsable}`}
                    {!plazo.responsable && ' · sin responsable asignado'}
                  </span>
                </span>

                <span className="lista__lateral">
                  {plazo.suspendido_sin_fin ? (
                    <Etiqueta tono="alerta">Sin reanudar</Etiqueta>
                  ) : (
                    plazo.dias_restantes !== null && (
                      <Vencimiento dias={plazo.dias_restantes} texto={enDias(plazo.dias_restantes)} />
                    )
                  )}
                  <EstadoPlazo estado={plazo.estado} />
                </span>
              </Link>
            ))}
          </div>
        </Tarjeta>
      ))}

      {data && data.totalPaginas > 1 && (
        <Tarjeta>
          <Paginacion
            pagina={data.pagina}
            totalPaginas={data.totalPaginas}
            total={data.total}
            tamano={data.tamano}
            cantidadEnPagina={data.datos.length}
            alCambiarPagina={(pagina) =>
              escribir({ pagina: pagina <= 1 ? undefined : String(pagina) }, false)
            }
            sustantivo="plazos"
          />
        </Tarjeta>
      )}

      {data && data.datos.length > 0 && (
        <p className="texto-pequeno texto-tenue" style={{ textAlign: 'center' }}>
          Los vencimientos los calcula el sistema sobre el calendario de días inhábiles cargado.
          Son una ayuda para no perder un plazo, no reemplazan el control del profesional.
          Última consulta: {formatearFecha(new Date().toISOString().slice(0, 10))}.
        </p>
      )}
    </>
  );
}
