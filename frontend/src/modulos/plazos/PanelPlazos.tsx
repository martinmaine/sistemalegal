import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { AlarmClock, Calculator, CheckCircle2, PauseCircle, Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react';
import {
  useCumplirPlazo,
  useEliminarPlazo,
  usePlazo,
  useReabrirPlazo,
  useReanudarPlazo,
  useSuspenderPlazo,
} from '../../servicios/consultas';
import type { PlazoListado } from '../../tipos/api';
import { useSesion } from '../auth/ContextoSesion';
import { enDias, fecha as formatearFecha, fechaLarga } from '../../lib/formato';
import { useErroresFormulario } from '../../lib/formulario';
import { Tarjeta } from '../../componentes/ui/Tarjeta';
import { Boton } from '../../componentes/ui/Boton';
import { Modal } from '../../componentes/ui/Modal';
import { CampoArea, CampoTexto } from '../../componentes/ui/Campo';
import { DialogoConfirmar } from '../../componentes/ui/DialogoConfirmar';
import { EstadoPlazo, Etiqueta, Vencimiento } from '../../componentes/ui/Etiqueta';
import { Cargando, ErrorCarga, EsqueletoLista, Vacio } from '../../componentes/ui/Estados';
import { Dato } from '../../componentes/ui/Tabla';
import { useAvisos } from '../../componentes/ui/Avisos';
import { DialogoPlazo } from './DialogoPlazo';
import { ExplicacionComputo } from './ExplicacionComputo';

/**
 * Plazos del expediente.
 *
 * Cada fila dice cuándo vence y cuánto falta en texto —"vence en 3 días",
 * "venció hace 12 días"— y no solo con color: un vencimiento es la información
 * más crítica de la pantalla y tiene que leerse igual sin distinguir colores.
 *
 * Las acciones son las del ciclo de vida real de un plazo: cumplirlo,
 * suspenderlo mientras no corre, reanudarlo y corregirlo. Cada una explica qué
 * va a pasar antes de ejecutarse.
 */

interface Props {
  causaId: string;
  caratula: string;
  plazos: PlazoListado[];
  cargando: boolean;
  error: unknown;
  reintentar: () => void;
}

const HOY = new Date().toISOString().slice(0, 10);

export function PanelPlazos({ causaId, caratula, plazos, cargando, error, reintentar }: Props) {
  const { puede } = useSesion();
  const { avisar } = useAvisos();

  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [editando, setEditando] = useState<PlazoListado>();
  const [viendoComputo, setViendoComputo] = useState<PlazoListado>();
  const [cumpliendo, setCumpliendo] = useState<PlazoListado>();
  const [suspendiendo, setSuspendiendo] = useState<PlazoListado>();
  const [reanudando, setReanudando] = useState<PlazoListado>();
  const [borrando, setBorrando] = useState<PlazoListado>();

  // El detalle se pide solo cuando hay un plazo abierto en alguno de los
  // diálogos que lo necesitan.
  const idQueNecesitaDetalle = editando?.id ?? viendoComputo?.id;
  const detalle = usePlazo(idQueNecesitaDetalle);

  if (cargando) return <Cargando texto="Cargando los plazos…" />;

  if (error) {
    return (
      <Tarjeta>
        <ErrorCarga error={error} reintentar={reintentar} />
      </Tarjeta>
    );
  }

  const puedeEditar = puede('plazo.editar');

  return (
    <>
      <Tarjeta
        titulo="Plazos procesales"
        descripcion="El vencimiento lo calcula el sistema sobre el calendario de días inhábiles cargado. Podés ver cómo llegó a cada fecha."
        accion={
          puede('plazo.crear') && (
            <Boton
              variante="primario"
              pequeno
              icono={<Plus size={15} aria-hidden />}
              onClick={() => setNuevoAbierto(true)}
            >
              Nuevo plazo
            </Boton>
          )
        }
        sinRelleno
      >
        {plazos.length === 0 ? (
          <Vacio
            titulo="Sin plazos cargados"
            texto="Cargá el primero y el sistema calcula el vencimiento sobre el calendario judicial."
            icono={<AlarmClock size={20} aria-hidden />}
          />
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Plazo</th>
                  <th scope="col" className="columna--opcional">
                    Cómputo
                  </th>
                  <th scope="col">Vencimiento</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="columna--secundaria">
                    Responsable
                  </th>
                  <th scope="col" className="columna--acciones">
                    <span className="solo-lectores">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {plazos.map((plazo) => {
                  const abierto = plazo.estado === 'PENDIENTE' || plazo.estado === 'SUSPENDIDO';

                  return (
                    <tr key={plazo.id}>
                      <td>
                        <div className="tabla__principal">{plazo.descripcion}</div>
                        {(plazo.tipo_plazo || plazo.articulo_referencia) && (
                          <div className="tabla__secundario">
                            {plazo.tipo_plazo}
                            {plazo.articulo_referencia && ` · ${plazo.articulo_referencia}`}
                          </div>
                        )}
                      </td>

                      <td className="columna--opcional tabla__secundario">
                        {plazo.cantidad_dias} días {plazo.computo === 'HABIL' ? 'hábiles' : 'corridos'}
                        <div>desde {formatearFecha(plazo.fecha_inicio_computo)}</div>
                      </td>

                      <td>
                        <div className="tabla__numero">{formatearFecha(plazo.fecha_vencimiento)}</div>
                        {plazo.dias_restantes !== null && (
                          <div style={{ marginTop: 4 }}>
                            <Vencimiento
                              dias={plazo.dias_restantes}
                              texto={enDias(plazo.dias_restantes)}
                            />
                          </div>
                        )}
                        {/* Si una suspensión corrió la fecha, se dice cuál era. */}
                        {plazo.fecha_vencimiento !== plazo.fecha_vencimiento_original && (
                          <div className="tabla__secundario">
                            originalmente {formatearFecha(plazo.fecha_vencimiento_original)}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="fila fila--envuelve" style={{ gap: 'var(--esp-2)' }}>
                          <EstadoPlazo estado={plazo.estado} />
                          {plazo.suspendido_sin_fin && (
                            <Etiqueta tono="alerta" title="No tiene fecha de reanudación">
                              Sin reanudar
                            </Etiqueta>
                          )}
                        </span>
                        {plazo.fecha_cumplimiento && (
                          <div className="tabla__secundario">
                            el {formatearFecha(plazo.fecha_cumplimiento)}
                          </div>
                        )}
                      </td>

                      <td className="columna--secundaria tabla__secundario">
                        <Dato>{plazo.responsable}</Dato>
                      </td>

                      <td className="columna--acciones">
                        <span className="fila" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="boton boton--icono boton--sutil"
                            onClick={() => setViendoComputo(plazo)}
                            aria-label={`Ver cómo se calculó el vencimiento de ${plazo.descripcion}`}
                            title="Ver el cálculo"
                          >
                            <Calculator size={15} aria-hidden />
                          </button>

                          {puedeEditar && abierto && (
                            <>
                              <button
                                type="button"
                                className="boton boton--icono boton--sutil"
                                onClick={() => setCumpliendo(plazo)}
                                aria-label={`Dar por cumplido ${plazo.descripcion}`}
                                title="Dar por cumplido"
                              >
                                <CheckCircle2 size={15} aria-hidden />
                              </button>

                              {plazo.estado === 'SUSPENDIDO' ? (
                                <button
                                  type="button"
                                  className="boton boton--icono boton--sutil"
                                  onClick={() => setReanudando(plazo)}
                                  aria-label={`Reanudar ${plazo.descripcion}`}
                                  title="Reanudar"
                                >
                                  <PlayCircle size={15} aria-hidden />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="boton boton--icono boton--sutil"
                                  onClick={() => setSuspendiendo(plazo)}
                                  aria-label={`Suspender ${plazo.descripcion}`}
                                  title="Suspender"
                                >
                                  <PauseCircle size={15} aria-hidden />
                                </button>
                              )}

                              <button
                                type="button"
                                className="boton boton--icono boton--sutil"
                                onClick={() => setEditando(plazo)}
                                aria-label={`Editar ${plazo.descripcion}`}
                                title="Editar"
                              >
                                <Pencil size={15} aria-hidden />
                              </button>
                            </>
                          )}

                          {puedeEditar && !abierto && (
                            <BotonReabrir plazo={plazo} causaId={causaId} />
                          )}

                          {puede('plazo.eliminar') && (
                            <button
                              type="button"
                              className="boton boton--icono boton--sutil"
                              onClick={() => setBorrando(plazo)}
                              aria-label={`Borrar ${plazo.descripcion}`}
                              title="Borrar"
                            >
                              <Trash2 size={15} aria-hidden />
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {nuevoAbierto && (
        <DialogoPlazo
          abierto
          alCerrar={() => setNuevoAbierto(false)}
          causaId={causaId}
          caratula={caratula}
        />
      )}

      {editando && detalle.data && (
        <DialogoPlazo
          abierto
          alCerrar={() => setEditando(undefined)}
          causaId={causaId}
          caratula={caratula}
          plazo={detalle.data.plazo}
        />
      )}

      {/* Cómo se llegó a la fecha. */}
      <Modal
        abierto={Boolean(viendoComputo)}
        alCerrar={() => setViendoComputo(undefined)}
        titulo="Cómo se calculó este vencimiento"
        descripcion={viendoComputo?.descripcion}
        ancho
        pie={<Boton onClick={() => setViendoComputo(undefined)}>Cerrar</Boton>}
      >
        {detalle.isPending && <EsqueletoLista />}
        {detalle.isError && <ErrorCarga error={detalle.error} reintentar={() => void detalle.refetch()} />}

        {detalle.data?.computo && (
          <ExplicacionComputo
            explicacion={detalle.data.computo.explicacion}
            dias={detalle.data.computo.dias}
            advertencia={
              detalle.data.computo.coincide_con_lo_guardado
                ? undefined
                : `Con el calendario de hoy el cálculo da ${fechaLarga(
                    detalle.data.computo.fecha_vencimiento_calculada,
                  )}, distinto del vencimiento guardado. Revisalo: puede haberse cargado un feriado después.`
            }
          />
        )}

        {detalle.data && !detalle.data.computo && (
          <div className="aviso aviso--alerta" role="alert">
            <span className="aviso__cuerpo">
              {detalle.data.error_computo ?? 'No se pudo rehacer el cálculo de este plazo.'}
            </span>
          </div>
        )}

        {detalle.data && detalle.data.suspensiones.length > 0 && (
          <div style={{ marginTop: 'var(--esp-5)' }}>
            <p className="dato__etiqueta">Suspensiones</p>
            <div className="lista">
              {detalle.data.suspensiones.map((suspension) => (
                <div key={suspension.id} className="lista__item">
                  <span className="lista__cuerpo">
                    <span className="lista__titulo">{suspension.motivo}</span>
                    <span className="lista__meta">
                      desde {formatearFecha(suspension.fecha_desde)}
                      {suspension.fecha_hasta
                        ? ` hasta ${formatearFecha(suspension.fecha_hasta)}`
                        : ' · sin reanudar'}
                      {suspension.registrado_por && ` · ${suspension.registrado_por}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {cumpliendo && (
        <DialogoCumplir
          plazo={cumpliendo}
          causaId={causaId}
          alCerrar={() => setCumpliendo(undefined)}
          alTerminar={() => avisar('Plazo dado por cumplido.')}
        />
      )}

      {suspendiendo && (
        <DialogoSuspender
          plazo={suspendiendo}
          causaId={causaId}
          alCerrar={() => setSuspendiendo(undefined)}
          alTerminar={() => avisar('Plazo suspendido.')}
        />
      )}

      {reanudando && (
        <DialogoReanudar
          plazo={reanudando}
          causaId={causaId}
          alCerrar={() => setReanudando(undefined)}
          alTerminar={() => avisar('Plazo reanudado.')}
        />
      )}

      {borrando && (
        <DialogoBorrar
          plazo={borrando}
          causaId={causaId}
          alCerrar={() => setBorrando(undefined)}
          alTerminar={() => avisar('Plazo borrado.')}
        />
      )}
    </>
  );
}

/* --- Diálogos de las acciones de estado ------------------------------------
   Cada uno es chico y vive acá: son formularios de uno o dos campos que solo
   usa esta pantalla. */

interface PropsAccion {
  plazo: PlazoListado;
  causaId: string;
  alCerrar: () => void;
  alTerminar: () => void;
}

function DialogoCumplir({ plazo, causaId, alCerrar, alTerminar }: PropsAccion) {
  const cumplir = useCumplirPlazo(plazo.id, causaId);
  const { errores, errorGeneral, limpiar, registrar } = useErroresFormulario();
  const [fecha, setFecha] = useState(HOY);
  const [observaciones, setObservaciones] = useState('');

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    try {
      await cumplir.mutateAsync({
        fecha_cumplimiento: fecha,
        observaciones: observaciones || undefined,
      });
      alTerminar();
      alCerrar();
    } catch (fallo) {
      registrar(fallo, 'No se pudo registrar el cumplimiento.');
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Dar el plazo por cumplido"
      descripcion={plazo.descripcion}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={cumplir.isPending}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form="formulario-cumplir" cargando={cumplir.isPending}>
            Dar por cumplido
          </Boton>
        </>
      }
    >
      <form id="formulario-cumplir" onSubmit={enviar} noValidate className="pila">
        {errorGeneral && (
          <div className="aviso aviso--peligro" role="alert">
            <span className="aviso__cuerpo">{errorGeneral}</span>
          </div>
        )}

        <p className="texto-pequeno texto-tenue" style={{ margin: 0 }}>
          Vencía el {fechaLarga(plazo.fecha_vencimiento)}.
        </p>

        <CampoTexto
          etiqueta="Fecha de cumplimiento"
          type="date"
          value={fecha}
          onChange={(evento) => setFecha(evento.target.value)}
          min={plazo.fecha_notificacion}
          ayuda="El día en que efectivamente se presentó el escrito o se cumplió el acto."
          error={errores.fecha_cumplimiento?.[0]}
          obligatorio
        />

        <CampoArea
          etiqueta="Observaciones"
          value={observaciones}
          onChange={(evento) => setObservaciones(evento.target.value)}
          placeholder="Qué se presentó, con qué cargo."
          error={errores.observaciones?.[0]}
        />
      </form>
    </Modal>
  );
}

function DialogoSuspender({ plazo, causaId, alCerrar, alTerminar }: PropsAccion) {
  const suspender = useSuspenderPlazo(plazo.id, causaId);
  const { errores, errorGeneral, limpiar, registrar } = useErroresFormulario();
  const [desde, setDesde] = useState(HOY);
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('');

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    try {
      await suspender.mutateAsync({
        fecha_desde: desde,
        fecha_hasta: hasta || undefined,
        motivo,
      });
      alTerminar();
      alCerrar();
    } catch (fallo) {
      registrar(fallo, 'No se pudo suspender el plazo.');
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Suspender el plazo"
      descripcion={plazo.descripcion}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={suspender.isPending}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            type="submit"
            form="formulario-suspender"
            cargando={suspender.isPending}
          >
            Suspender
          </Boton>
        </>
      }
    >
      <form id="formulario-suspender" onSubmit={enviar} noValidate className="pila">
        {errorGeneral && (
          <div className="aviso aviso--peligro" role="alert">
            <span className="aviso__cuerpo">{errorGeneral}</span>
          </div>
        )}

        <p className="texto-pequeno texto-tenue" style={{ margin: 0 }}>
          Los días suspendidos no cuentan, así que el vencimiento se corre. Hoy vence el{' '}
          {fechaLarga(plazo.fecha_vencimiento)}.
        </p>

        <div className="datos">
          <CampoTexto
            etiqueta="Suspendido desde"
            type="date"
            value={desde}
            onChange={(evento) => setDesde(evento.target.value)}
            min={plazo.fecha_inicio_computo}
            error={errores.fecha_desde?.[0]}
            obligatorio
          />

          <CampoTexto
            etiqueta="Hasta"
            type="date"
            value={hasta}
            onChange={(evento) => setHasta(evento.target.value)}
            min={desde}
            ayuda="Dejalo vacío si todavía no se sabe cuándo se reanuda."
            error={errores.fecha_hasta?.[0]}
          />
        </div>

        <CampoTexto
          etiqueta="Motivo"
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Incidente de nulidad"
          ayuda="Queda asentado en el expediente y se ve en el cálculo."
          error={errores.motivo?.[0]}
          obligatorio
          maxLength={200}
        />

        {!hasta && (
          <div className="aviso aviso--info">
            <span className="aviso__cuerpo">
              Sin fecha de reanudación el plazo queda detenido y no se puede calcular un
              vencimiento. Vas a poder reanudarlo cuando corresponda.
            </span>
          </div>
        )}
      </form>
    </Modal>
  );
}

function DialogoReanudar({ plazo, causaId, alCerrar, alTerminar }: PropsAccion) {
  const reanudar = useReanudarPlazo(plazo.id, causaId);
  const { errores, errorGeneral, limpiar, registrar } = useErroresFormulario();
  const [hasta, setHasta] = useState(HOY);

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    try {
      await reanudar.mutateAsync({ fecha_hasta: hasta });
      alTerminar();
      alCerrar();
    } catch (fallo) {
      registrar(fallo, 'No se pudo reanudar el plazo.');
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Reanudar el plazo"
      descripcion={plazo.descripcion}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={reanudar.isPending}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            type="submit"
            form="formulario-reanudar"
            cargando={reanudar.isPending}
          >
            Reanudar
          </Boton>
        </>
      }
    >
      <form id="formulario-reanudar" onSubmit={enviar} noValidate className="pila">
        {errorGeneral && (
          <div className="aviso aviso--peligro" role="alert">
            <span className="aviso__cuerpo">{errorGeneral}</span>
          </div>
        )}

        <CampoTexto
          etiqueta="La suspensión terminó el"
          type="date"
          value={hasta}
          onChange={(evento) => setHasta(evento.target.value)}
          ayuda="Desde el día siguiente el plazo vuelve a correr, y se recalcula el vencimiento."
          error={errores.fecha_hasta?.[0]}
          obligatorio
        />
      </form>
    </Modal>
  );
}

function DialogoBorrar({ plazo, causaId, alCerrar, alTerminar }: PropsAccion) {
  const eliminar = useEliminarPlazo(causaId);
  const [error, setError] = useState<string>();

  async function confirmar() {
    setError(undefined);
    try {
      await eliminar.mutateAsync(plazo.id);
      alTerminar();
      alCerrar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo borrar el plazo.');
    }
  }

  return (
    <DialogoConfirmar
      abierto
      titulo="Borrar el plazo"
      mensaje={
        <>
          Se borra <strong>{plazo.descripcion}</strong>, que vence el{' '}
          {fechaLarga(plazo.fecha_vencimiento)}. Usalo solo si se cargó por error: si el plazo
          existió y no se cumplió, conviene dejarlo asentado. La baja queda en la auditoría.
        </>
      }
      textoConfirmar="Borrar el plazo"
      cargando={eliminar.isPending}
      error={error}
      alConfirmar={() => void confirmar()}
      alCerrar={alCerrar}
    />
  );
}

/** Reabrir un plazo cerrado: aparece en la fila cuando el estado ya es final. */
function BotonReabrir({ plazo, causaId }: { plazo: PlazoListado; causaId: string }) {
  const reabrir = useReabrirPlazo(plazo.id, causaId);
  const { avisar } = useAvisos();

  return (
    <Boton
      pequeno
      variante="sutil"
      cargando={reabrir.isPending}
      onClick={() => {
        reabrir
          .mutateAsync(undefined)
          .then(() => avisar('Plazo reabierto.'))
          .catch(() => avisar('No se pudo reabrir el plazo.', 'error'));
      }}
    >
      Reabrir
    </Boton>
  );
}
