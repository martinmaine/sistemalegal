import { Link, useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  CalendarDays,
  CircleAlert,
  FolderOpen,
  FolderPlus,
  History,
  ListChecks,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePanel } from '../../servicios/consultas';
import { useSesion } from '../auth/ContextoSesion';
import { CabeceraPagina } from '../../componentes/ui/CabeceraPagina';
import { Tarjeta } from '../../componentes/ui/Tarjeta';
import { Boton } from '../../componentes/ui/Boton';
import { EstadoTarea, Etiqueta, Prioridad, Vencimiento } from '../../componentes/ui/Etiqueta';
import { Cargando, ErrorCarga, Vacio } from '../../componentes/ui/Estados';
import { enDias, fecha, fechaLarga, haceCuanto, hora, importe, legible } from '../../lib/formato';

/**
 * Panel de inicio.
 *
 * Responde, en este orden, las preguntas con las que un abogado abre el
 * sistema: qué vence, qué tengo que hacer, qué pasó y dónde sigo trabajando.
 * No hay gráficos: en un estudio chico una curva mensual no cambia ninguna
 * decisión, y un vencimiento a dos días sí.
 *
 * Todas las cifras vienen de /api/panel, calculadas sobre la base y recortadas
 * según los permisos de quien consulta.
 */

function saludo(): string {
  const horaActual = new Date().getHours();
  if (horaActual < 13) return 'Buen día';
  if (horaActual < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

interface PropsIndicador {
  valor: number | string;
  etiqueta: string;
  icono: LucideIcon;
  tono?: 'marca' | 'alerta' | 'peligro' | 'exito';
  pie?: string;
  ruta?: string;
}

function Indicador({ valor, etiqueta, icono: Icono, tono = 'marca', pie, ruta }: PropsIndicador) {
  // Un importe formateado ocupa mucho más que un conteo: se achica para que la
  // tarjeta no se ensanche y descuadre toda la fila.
  const valorLargo = String(valor).length > 6;

  const contenido = (
    <>
      <div className="indicador__fila">
        <span className={`indicador__valor numero${valorLargo ? ' indicador__valor--largo' : ''}`}>
          {valor}
        </span>
        <span
          className={`indicador__icono${tono === 'marca' ? '' : ` indicador__icono--${tono}`}`}
          aria-hidden
        >
          <Icono size={17} />
        </span>
      </div>
      <div>
        <p className="indicador__etiqueta">{etiqueta}</p>
        {pie && <p className="indicador__pie">{pie}</p>}
      </div>
    </>
  );

  // Cuando el indicador lleva a algún lado se vuelve un enlace completo: el
  // blanco de clic es la tarjeta entera, no un enlace chiquito adentro.
  return ruta ? (
    <Link to={ruta} className="indicador">
      {contenido}
    </Link>
  ) : (
    <div className="indicador">{contenido}</div>
  );
}

export function PaginaPanel() {
  const { usuario, puede } = useSesion();
  const { data, isPending, isError, error, refetch } = usePanel();
  const navegar = useNavigate();

  const hoy = new Date().toISOString().slice(0, 10);

  const acciones = (
    <>
      {puede('causa.crear') && (
        <Boton
          variante="primario"
          // El alta vive en el listado de expedientes, que es donde se ve el
          // resultado; el panel solo lleva hasta ahí, con el formulario abierto.
          onClick={() => navegar('/expedientes?nueva=1')}
          icono={<FolderPlus size={16} aria-hidden />}
        >
          Nuevo expediente
        </Boton>
      )}
    </>
  );

  if (isPending) {
    return (
      <>
        <CabeceraPagina titulo={`${saludo()}, ${usuario?.nombre ?? ''}`} descripcion={fechaLarga(hoy)} />
        <Cargando texto="Preparando tu panel…" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <CabeceraPagina titulo={`${saludo()}, ${usuario?.nombre ?? ''}`} descripcion={fechaLarga(hoy)} />
        <Tarjeta>
          <ErrorCarga error={error} reintentar={() => void refetch()} />
        </Tarjeta>
      </>
    );
  }

  const { indicadores, plazosProximos, tareas, eventos, actividad, causasRecientes, finanzas, diasHorizonte } =
    data;

  return (
    <>
      <CabeceraPagina
        titulo={`${saludo()}, ${usuario?.nombre ?? ''}`}
        descripcion={fechaLarga(hoy)}
        acciones={acciones}
      />

      <div className="pila">
        <section className="rejilla-indicadores" aria-label="Resumen del estudio">
          <Indicador
            valor={indicadores.causas_activas}
            etiqueta="Expedientes activos"
            icono={FolderOpen}
            ruta="/expedientes?vigencia=activas"
          />
          <Indicador
            valor={indicadores.plazos_por_vencer}
            etiqueta="Plazos por vencer"
            pie={`En los próximos ${diasHorizonte} días`}
            icono={AlarmClock}
            tono={indicadores.plazos_por_vencer > 0 ? 'alerta' : 'exito'}
          />
          <Indicador
            valor={indicadores.plazos_vencidos}
            etiqueta="Plazos vencidos sin cumplir"
            icono={CircleAlert}
            tono={indicadores.plazos_vencidos > 0 ? 'peligro' : 'exito'}
          />
          <Indicador
            valor={indicadores.mis_tareas_abiertas}
            etiqueta="Mis tareas abiertas"
            pie={`${indicadores.tareas_abiertas} en todo el estudio`}
            icono={ListChecks}
          />
          {/* El bloque financiero solo llega si el backend decidió que este
              usuario puede verlo. */}
          {finanzas && (
            <Indicador
              valor={importe(finanzas.saldo_pendiente)}
              etiqueta="Saldo por cobrar"
              pie={`${finanzas.costas_pendientes} costas pendientes`}
              icono={Wallet}
            />
          )}
        </section>

        <div className="rejilla-panel">
          <div className="pila">
            <Tarjeta
              titulo="Próximos vencimientos"
              descripcion={`Plazos pendientes hasta dentro de ${diasHorizonte} días, y los que ya vencieron.`}
              sinRelleno
            >
              {plazosProximos.length === 0 ? (
                <Vacio
                  titulo="No hay vencimientos a la vista"
                  texto={`Ningún plazo pendiente vence en los próximos ${diasHorizonte} días.`}
                  icono={<AlarmClock size={20} aria-hidden />}
                />
              ) : (
                <div className="lista">
                  {plazosProximos.map((plazo) => (
                    <Link key={plazo.id} to={`/expedientes/${plazo.causa_id}`} className="lista__item">
                      <span className="lista__cuerpo">
                        <span className="lista__titulo" title={plazo.descripcion}>
                          {plazo.descripcion}
                        </span>
                        <span className="lista__meta" title={plazo.caratula}>
                          {plazo.numero_expediente ?? 'Sin radicar'} · {plazo.caratula}
                        </span>
                      </span>
                      <span className="lista__lateral">
                        <span className="texto-pequeno texto-tenue numero">
                          {fecha(plazo.fecha_vencimiento)}
                        </span>
                        <Vencimiento dias={plazo.dias_restantes} texto={enDias(plazo.dias_restantes)} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Actividad reciente"
              descripcion="Últimos movimientos procesales registrados en el estudio."
            >
              {actividad.length === 0 ? (
                <Vacio
                  titulo="Todavía no hay movimientos"
                  texto="Cuando se registren movimientos en los expedientes, aparecen acá."
                  icono={<History size={20} aria-hidden />}
                />
              ) : (
                <ol className="linea-tiempo">
                  {actividad.map((item) => (
                    <li key={item.id} className="linea-tiempo__item">
                      <span className="linea-tiempo__marca" aria-hidden>
                        <History size={13} />
                      </span>
                      <div className="linea-tiempo__contenido">
                        <div className="linea-tiempo__encabezado">
                          <span className="linea-tiempo__titulo">{item.tipo ?? 'Movimiento'}</span>
                          <span className="linea-tiempo__fecha">{fecha(item.fecha)}</span>
                        </div>
                        <p className="linea-tiempo__descripcion">{item.descripcion}</p>
                        <p className="linea-tiempo__meta">
                          <Link to={`/expedientes/${item.causa_id}`}>{item.caratula}</Link>
                          {item.registrado_por && ` · registrado por ${item.registrado_por}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Tarjeta>
          </div>

          <div className="pila">
            <Tarjeta titulo="Tareas abiertas" descripcion="Las tuyas primero." sinRelleno>
              {tareas.length === 0 ? (
                <Vacio titulo="Sin tareas pendientes" icono={<ListChecks size={20} aria-hidden />} />
              ) : (
                <div className="lista">
                  {tareas.map((tarea) => (
                    <div key={tarea.id} className="lista__item">
                      <span className="lista__cuerpo">
                        <span className="lista__titulo" title={tarea.titulo}>
                          {tarea.titulo}
                        </span>
                        <span className="lista__meta">
                          {tarea.es_mia ? 'Asignada a vos' : (tarea.asignada_a ?? 'Sin asignar')}
                          {tarea.fecha_vencimiento && ` · vence ${fecha(tarea.fecha_vencimiento)}`}
                        </span>
                      </span>
                      <span className="lista__lateral">
                        <Prioridad prioridad={tarea.prioridad} />
                        <EstadoTarea estado={tarea.estado} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Agenda"
              descripcion={`Audiencias y eventos de los próximos ${diasHorizonte} días.`}
              sinRelleno
            >
              {eventos.length === 0 ? (
                <Vacio titulo="Sin eventos próximos" icono={<CalendarDays size={20} aria-hidden />} />
              ) : (
                <div className="lista">
                  {eventos.map((evento) => (
                    <div key={evento.id} className="lista__item">
                      <span className="lista__cuerpo">
                        <span className="lista__titulo" title={evento.titulo}>
                          {evento.titulo}
                        </span>
                        <span className="lista__meta">
                          {fecha(evento.fecha_inicio)}
                          {!evento.todo_el_dia && ` · ${hora(evento.fecha_inicio)}`}
                          {evento.lugar && ` · ${evento.lugar}`}
                        </span>
                      </span>
                      <span className="lista__lateral">
                        <Etiqueta tono={evento.tipo === 'AUDIENCIA' ? 'info' : 'neutral'}>
                          {legible(evento.tipo)}
                        </Etiqueta>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Últimos expedientes"
              accion={
                <Link to="/expedientes" className="texto-pequeno">
                  Ver todos
                </Link>
              }
              sinRelleno
            >
              {causasRecientes.length === 0 ? (
                <Vacio titulo="Todavía no hay expedientes" icono={<FolderOpen size={20} aria-hidden />} />
              ) : (
                <div className="lista">
                  {causasRecientes.map((causa) => (
                    <Link key={causa.id} to={`/expedientes/${causa.id}`} className="lista__item">
                      <span className="lista__cuerpo">
                        <span className="lista__titulo" title={causa.caratula}>
                          {causa.caratula}
                        </span>
                        <span className="lista__meta">
                          {causa.fuero} · modificado {haceCuanto(causa.actualizado_en)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Tarjeta>
          </div>
        </div>
      </div>
    </>
  );
}
