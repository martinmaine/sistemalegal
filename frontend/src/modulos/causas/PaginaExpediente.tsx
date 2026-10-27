import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlarmClock,
  CalendarDays,
  FileText,
  Gavel,
  History,
  ListChecks,
  Paperclip,
  Pencil,
  Plus,
  Scale,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  useCausa,
  useDesasignarProfesional,
  useDocumentosCausa,
  useEliminarCausa,
  useMovimientosCausa,
  usePlazosCausa,
  useQuitarParte,
  useTareasCausa,
} from '../../servicios/consultas';
import type { ParteCausa, ProfesionalCausa } from '../../tipos/api';
import { caracterLegible, rolLegible, tipoPersonaLegible } from '../../lib/vocabulario';
import { useSesion } from '../auth/ContextoSesion';
import { CabeceraPagina } from '../../componentes/ui/CabeceraPagina';
import { Tarjeta } from '../../componentes/ui/Tarjeta';
import { Boton } from '../../componentes/ui/Boton';
import { Dato } from '../../componentes/ui/Tabla';
import { useAvisos } from '../../componentes/ui/Avisos';
import { DialogoConfirmar } from '../../componentes/ui/DialogoConfirmar';
import { DialogoExpediente } from './DialogoExpediente';
import { DialogoAgregarParte } from './DialogoAgregarParte';
import { DialogoAsignarProfesional } from './DialogoAsignarProfesional';
import {
  EstadoCausa,
  EstadoPlazo,
  EstadoTarea,
  Etiqueta,
  Prioridad,
  Vencimiento,
} from '../../componentes/ui/Etiqueta';
import { Cargando, ErrorCarga, EsqueletoLista, Vacio } from '../../componentes/ui/Estados';
import { enDias, fecha, fechaHora, importe, legible, tamanoArchivo } from '../../lib/formato';

/**
 * Detalle del expediente.
 *
 * La cabecera responde siempre lo mismo —qué causa es, en qué estado, ante qué
 * tribunal y de quién es— y las pestañas organizan el resto. Cada pestaña pide
 * sus datos recién cuando se abre: traer movimientos, plazos, documentos y
 * tareas de entrada haría lenta una pantalla de la que, casi siempre, se mira
 * una sola solapa.
 *
 * La pestaña activa viaja en la URL, así que se puede enlazar directamente a
 * los plazos de un expediente y el botón Atrás vuelve a la solapa anterior.
 */

type Pestana = 'resumen' | 'actividad' | 'partes' | 'plazos' | 'documentos' | 'tareas';

const PESTANAS: { clave: Pestana; texto: string; icono: typeof Scale }[] = [
  { clave: 'resumen', texto: 'Resumen', icono: FileText },
  { clave: 'actividad', texto: 'Actividad', icono: History },
  { clave: 'partes', texto: 'Partes', icono: Users },
  { clave: 'plazos', texto: 'Plazos', icono: AlarmClock },
  { clave: 'documentos', texto: 'Documentos', icono: Paperclip },
  { clave: 'tareas', texto: 'Tareas', icono: ListChecks },
];

function esPestana(valor: string | null): valor is Pestana {
  return PESTANAS.some((pestana) => pestana.clave === valor);
}

export function PaginaExpediente() {
  const { id } = useParams<{ id: string }>();
  const [parametros, setParametros] = useSearchParams();
  const navegar = useNavigate();
  const { puede } = useSesion();
  const { avisar } = useAvisos();

  const parametroPestana = parametros.get('pestana');
  const activa: Pestana = esPestana(parametroPestana) ? parametroPestana : 'resumen';

  const { data, isPending, isError, error, refetch } = useCausa(id);

  // Qué diálogo está abierto. Los de confirmación guardan el registro sobre el
  // que preguntan, para poder nombrarlo en el mensaje.
  const [editando, setEditando] = useState(false);
  const [agregandoParte, setAgregandoParte] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [dandoDeBaja, setDandoDeBaja] = useState(false);
  const [parteAQuitar, setParteAQuitar] = useState<ParteCausa>();
  const [profesionalAQuitar, setProfesionalAQuitar] = useState<ProfesionalCausa>();

  const eliminarCausa = useEliminarCausa();
  const quitarParte = useQuitarParte(id ?? '');
  const desasignar = useDesasignarProfesional(id ?? '');

  // El error de una baja bloqueada por una regla de negocio se muestra dentro
  // del propio diálogo, donde el usuario está mirando.
  const [errorBaja, setErrorBaja] = useState<string>();

  async function confirmarBajaCausa() {
    if (!id) return;
    setErrorBaja(undefined);

    try {
      await eliminarCausa.mutateAsync(id);
      avisar('Expediente dado de baja.');
      setDandoDeBaja(false);
      navegar('/expedientes');
    } catch (fallo) {
      setErrorBaja(
        fallo instanceof Error ? fallo.message : 'No se pudo dar de baja el expediente.',
      );
    }
  }

  async function confirmarQuitarParte() {
    if (!parteAQuitar) return;
    setErrorBaja(undefined);

    try {
      await quitarParte.mutateAsync(parteAQuitar.id);
      avisar(`${parteAQuitar.nombre_completo} ya no figura en el expediente.`);
      setParteAQuitar(undefined);
    } catch (fallo) {
      setErrorBaja(fallo instanceof Error ? fallo.message : 'No se pudo quitar la parte.');
    }
  }

  async function confirmarDesasignar() {
    if (!profesionalAQuitar) return;
    setErrorBaja(undefined);

    try {
      await desasignar.mutateAsync(profesionalAQuitar.id);
      avisar(`${profesionalAQuitar.nombre_completo} ya no está asignado al expediente.`);
      setProfesionalAQuitar(undefined);
    } catch (fallo) {
      setErrorBaja(fallo instanceof Error ? fallo.message : 'No se pudo desasignar.');
    }
  }

  // Cada pestaña solo consulta cuando está abierta.
  const movimientos = useMovimientosCausa(id, activa === 'actividad');
  const plazos = usePlazosCausa(id, activa === 'plazos');
  const documentos = useDocumentosCausa(id, activa === 'documentos');
  const tareas = useTareasCausa(id, activa === 'tareas');

  function irA(pestana: Pestana) {
    const siguientes = new URLSearchParams(parametros);
    if (pestana === 'resumen') siguientes.delete('pestana');
    else siguientes.set('pestana', pestana);
    setParametros(siguientes, { replace: true });
  }

  if (isPending) return <Cargando texto="Cargando el expediente…" />;

  if (isError) {
    return (
      <>
        <CabeceraPagina titulo="Expediente" migas={[{ texto: 'Expedientes', ruta: '/expedientes' }]} />
        <Tarjeta>
          <ErrorCarga error={error} reintentar={() => void refetch()} />
        </Tarjeta>
      </>
    );
  }

  const { causa, partes, profesionales } = data;
  const cliente = partes.find((parte) => parte.es_cliente);

  const contadores: Partial<Record<Pestana, number>> = {
    actividad: causa.cantidad_movimientos,
    partes: partes.length,
    plazos: causa.plazos_pendientes,
    documentos: causa.cantidad_documentos,
    tareas: causa.cantidad_tareas_abiertas,
  };

  return (
    <>
      <CabeceraPagina
        migas={[
          { texto: 'Expedientes', ruta: '/expedientes' },
          { texto: causa.numero_expediente ?? 'Sin radicar' },
        ]}
        titulo={causa.caratula}
        descripcion={
          <span className="fila fila--envuelve" style={{ gap: 'var(--esp-2)', marginTop: 'var(--esp-2)' }}>
            <EstadoCausa estado={causa.estado} esFinal={causa.es_final} />
            <Etiqueta tono="neutral">{causa.fuero}</Etiqueta>
            {causa.tipo_causa && <Etiqueta tono="neutral">{causa.tipo_causa}</Etiqueta>}
            {causa.numero_expediente && (
              <span className="texto-pequeno texto-tenue numero">Expte. {causa.numero_expediente}</span>
            )}
          </span>
        }
        acciones={
          <>
            {puede('causa.editar') && (
              <Boton icono={<Pencil size={15} aria-hidden />} onClick={() => setEditando(true)}>
                Editar
              </Boton>
            )}
            {puede('causa.eliminar') && (
              <Boton
                variante="sutil"
                icono={<Trash2 size={15} aria-hidden />}
                onClick={() => {
                  setErrorBaja(undefined);
                  setDandoDeBaja(true);
                }}
              >
                Dar de baja
              </Boton>
            )}
          </>
        }
      />

      <div className="pila">
        <Tarjeta>
          <div className="datos">
            <div>
              <p className="dato__etiqueta">Tribunal</p>
              <p className="dato__valor">
                <Dato>{causa.tribunal}</Dato>
              </p>
              {causa.tribunal_domicilio && (
                <p className="texto-pequeno texto-tenue">{causa.tribunal_domicilio}</p>
              )}
            </div>

            <div>
              <p className="dato__etiqueta">Profesional responsable</p>
              <p className="dato__valor">
                <Dato>{causa.responsable}</Dato>
              </p>
            </div>

            <div>
              <p className="dato__etiqueta">Cliente del estudio</p>
              <p className="dato__valor">
                {cliente ? (
                  <Link to={`/clientes/${cliente.persona_id}`}>{cliente.nombre_completo}</Link>
                ) : (
                  <span className="dato__valor--vacio">Sin cliente asignado</span>
                )}
              </p>
            </div>

            <div>
              <p className="dato__etiqueta">Inicio</p>
              <p className="dato__valor numero">{fecha(causa.fecha_inicio)}</p>
            </div>

            {causa.fecha_cierre && (
              <div>
                <p className="dato__etiqueta">Cierre</p>
                <p className="dato__valor numero">{fecha(causa.fecha_cierre)}</p>
              </div>
            )}

            {causa.monto_reclamado && (
              <div>
                <p className="dato__etiqueta">Monto reclamado</p>
                <p className="dato__valor numero">{importe(causa.monto_reclamado, causa.moneda)}</p>
              </div>
            )}

            <div>
              <p className="dato__etiqueta">Plazos pendientes</p>
              <p className="dato__valor">
                {causa.plazos_pendientes === 0 ? (
                  <span className="dato__valor--vacio">Ninguno</span>
                ) : (
                  <span className="fila" style={{ gap: 'var(--esp-2)' }}>
                    <span className="numero">{causa.plazos_pendientes}</span>
                    {causa.proximo_vencimiento && (
                      <span className="texto-pequeno texto-tenue">
                        próximo el {fecha(causa.proximo_vencimiento)}
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
        </Tarjeta>

        <nav className="pestanas" aria-label="Secciones del expediente">
          {PESTANAS.map((pestana) => (
            <button
              key={pestana.clave}
              type="button"
              className={`pestana${activa === pestana.clave ? ' pestana--activa' : ''}`}
              onClick={() => irA(pestana.clave)}
              aria-current={activa === pestana.clave ? 'page' : undefined}
            >
              <pestana.icono size={15} aria-hidden />
              {pestana.texto}
              {contadores[pestana.clave] !== undefined && contadores[pestana.clave]! > 0 && (
                <span className="pestana__contador">{contadores[pestana.clave]}</span>
              )}
            </button>
          ))}
        </nav>

        {activa === 'resumen' && (
          <div className="rejilla-detalle">
            <div className="pila">
              <Tarjeta titulo="Datos del expediente">
                <div className="datos">
                  <div>
                    <p className="dato__etiqueta">Jurisdicción</p>
                    <p className="dato__valor">
                      <Dato>{causa.jurisdiccion}</Dato>
                    </p>
                  </div>
                  <div>
                    <p className="dato__etiqueta">Fuero</p>
                    <p className="dato__valor">{causa.fuero}</p>
                  </div>
                  <div>
                    <p className="dato__etiqueta">Tipo de causa</p>
                    <p className="dato__valor">
                      <Dato>{causa.tipo_causa}</Dato>
                    </p>
                  </div>
                  <div>
                    <p className="dato__etiqueta">Creado</p>
                    <p className="dato__valor numero">{fechaHora(causa.creado_en)}</p>
                  </div>
                  <div>
                    <p className="dato__etiqueta">Última modificación</p>
                    <p className="dato__valor numero">{fechaHora(causa.actualizado_en)}</p>
                  </div>
                </div>

                {causa.observaciones && (
                  <div style={{ marginTop: 'var(--esp-6)' }}>
                    <p className="dato__etiqueta">Observaciones</p>
                    <p className="dato__valor" style={{ whiteSpace: 'pre-wrap' }}>
                      {causa.observaciones}
                    </p>
                  </div>
                )}
              </Tarjeta>

              <Tarjeta
                titulo="Partes intervinientes"
                accion={
                  <button type="button" className="boton boton--sutil boton--pequeno" onClick={() => irA('partes')}>
                    Ver todas
                  </button>
                }
                sinRelleno
              >
                {partes.length === 0 ? (
                  <Vacio titulo="Sin partes cargadas" icono={<Users size={20} aria-hidden />} />
                ) : (
                  <div className="lista">
                    {partes.slice(0, 4).map((parte) => (
                      <Link key={parte.id} to={`/clientes/${parte.persona_id}`} className="lista__item">
                        <span className="lista__cuerpo">
                          <span className="lista__titulo">{parte.nombre_completo}</span>
                          <span className="lista__meta">
                            <Dato>{parte.documento}</Dato>
                          </span>
                        </span>
                        <span className="lista__lateral">
                          {parte.es_cliente && <Etiqueta tono="marca">Cliente</Etiqueta>}
                          <Etiqueta tono="neutral">{caracterLegible(parte.caracter)}</Etiqueta>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Tarjeta>
            </div>

            <Tarjeta
              titulo="Equipo asignado"
              accion={
                puede('causa.editar') && (
                  <button
                    type="button"
                    className="boton boton--sutil boton--pequeno"
                    onClick={() => setAsignando(true)}
                  >
                    <Plus size={15} aria-hidden />
                    Asignar
                  </button>
                )
              }
              sinRelleno
            >
              {profesionales.length === 0 ? (
                <Vacio titulo="Sin profesionales asignados" icono={<Gavel size={20} aria-hidden />} />
              ) : (
                <div className="lista">
                  {profesionales.map((profesional) => (
                    <div key={profesional.id} className="lista__item">
                      <span className="lista__cuerpo">
                        <span className="lista__titulo">{profesional.nombre_completo}</span>
                        <span className="lista__meta">
                          {rolLegible(profesional.rol_en_causa)}
                          {profesional.matricula && ` · ${profesional.matricula}`}
                        </span>
                      </span>
                      {puede('causa.editar') && (
                        <span className="lista__lateral">
                          <button
                            type="button"
                            className="boton boton--icono boton--sutil"
                            onClick={() => {
                              setErrorBaja(undefined);
                              setProfesionalAQuitar(profesional);
                            }}
                            aria-label={`Desasignar a ${profesional.nombre_completo}`}
                            title="Desasignar del expediente"
                          >
                            <UserMinus size={15} aria-hidden />
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>
          </div>
        )}

        {activa === 'actividad' && (
          <Tarjeta titulo="Movimientos procesales" descripcion="Historial del expediente, del más reciente al más antiguo.">
            {movimientos.isPending && <EsqueletoLista />}
            {movimientos.isError && (
              <ErrorCarga error={movimientos.error} reintentar={() => void movimientos.refetch()} />
            )}
            {movimientos.data?.length === 0 && (
              <Vacio
                titulo="Todavía no hay movimientos"
                texto="Los movimientos procesales registrados en este expediente aparecen acá."
                icono={<History size={20} aria-hidden />}
              />
            )}
            {movimientos.data && movimientos.data.length > 0 && (
              <ol className="linea-tiempo">
                {movimientos.data.map((movimiento) => (
                  <li key={movimiento.id} className="linea-tiempo__item">
                    <span className="linea-tiempo__marca" aria-hidden>
                      <Gavel size={13} />
                    </span>
                    <div className="linea-tiempo__contenido">
                      <div className="linea-tiempo__encabezado">
                        <span className="linea-tiempo__titulo">{movimiento.tipo ?? 'Movimiento'}</span>
                        <span className="linea-tiempo__fecha">{fecha(movimiento.fecha)}</span>
                        {movimiento.origen !== 'MANUAL' && (
                          <Etiqueta tono="info">{legible(movimiento.origen)}</Etiqueta>
                        )}
                      </div>
                      <p className="linea-tiempo__descripcion">{movimiento.descripcion}</p>
                      {movimiento.registrado_por && (
                        <p className="linea-tiempo__meta">Registrado por {movimiento.registrado_por}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>
        )}

        {activa === 'partes' && (
          <Tarjeta
            titulo="Partes intervinientes"
            descripcion="Cada persona interviene con un carácter procesal, que es propio de este expediente."
            accion={
              puede('causa.editar') && (
                <Boton
                  variante="primario"
                  pequeno
                  icono={<Plus size={15} aria-hidden />}
                  onClick={() => setAgregandoParte(true)}
                >
                  Agregar parte
                </Boton>
              )
            }
            sinRelleno
          >
            {partes.length === 0 ? (
              <Vacio
                titulo="Sin partes cargadas"
                texto="Las personas vinculadas a este expediente aparecen acá con su carácter procesal."
                icono={<Users size={20} aria-hidden />}
              />
            ) : (
              <div className="tabla-envoltorio">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Carácter</th>
                      <th scope="col" className="columna--opcional">
                        Documento
                      </th>
                      <th scope="col" className="columna--secundaria">
                        Contacto
                      </th>
                      {puede('causa.editar') && (
                        <th scope="col" className="columna--acciones">
                          <span className="solo-lectores">Acciones</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {partes.map((parte) => (
                      <tr key={parte.id}>
                        <td>
                          <Link to={`/clientes/${parte.persona_id}`} className="tabla__principal">
                            {parte.nombre_completo}
                          </Link>
                          <div className="tabla__secundario">
                            {tipoPersonaLegible(parte.tipo_persona)}
                          </div>
                        </td>
                        <td>
                          <span className="fila" style={{ gap: 'var(--esp-2)' }}>
                            <Etiqueta tono="neutral">{caracterLegible(parte.caracter)}</Etiqueta>
                            {parte.es_cliente && <Etiqueta tono="marca">Cliente</Etiqueta>}
                          </span>
                        </td>
                        <td className="columna--opcional tabla__numero">
                          <Dato>{parte.documento}</Dato>
                        </td>
                        <td className="columna--secundaria tabla__secundario">
                          <div>
                            <Dato>{parte.email}</Dato>
                          </div>
                          <div>
                            <Dato>{parte.telefono}</Dato>
                          </div>
                        </td>
                        {puede('causa.editar') && (
                          <td className="columna--acciones">
                            <button
                              type="button"
                              className="boton boton--icono boton--sutil"
                              onClick={() => {
                                setErrorBaja(undefined);
                                setParteAQuitar(parte);
                              }}
                              aria-label={`Quitar a ${parte.nombre_completo} del expediente`}
                              title="Quitar del expediente"
                            >
                              <UserMinus size={15} aria-hidden />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        )}

        {activa === 'plazos' && (
          <Tarjeta
            titulo="Plazos procesales"
            descripcion="El cálculo de vencimientos se incorpora en la próxima fase; estos plazos se muestran tal como están cargados."
            sinRelleno
          >
            {plazos.isPending && <EsqueletoLista />}
            {plazos.isError && <ErrorCarga error={plazos.error} reintentar={() => void plazos.refetch()} />}
            {plazos.data?.length === 0 && (
              <Vacio
                titulo="Sin plazos registrados"
                texto="Los plazos de este expediente aparecen acá con su vencimiento y responsable."
                icono={<AlarmClock size={20} aria-hidden />}
              />
            )}
            {plazos.data && plazos.data.length > 0 && (
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
                    </tr>
                  </thead>
                  <tbody>
                    {plazos.data.map((plazo) => (
                      <tr key={plazo.id}>
                        <td>
                          <div className="tabla__principal">{plazo.descripcion}</div>
                          {plazo.tipo_plazo && (
                            <div className="tabla__secundario">
                              {plazo.tipo_plazo}
                              {plazo.articulo_referencia && ` · ${plazo.articulo_referencia}`}
                            </div>
                          )}
                        </td>
                        <td className="columna--opcional tabla__secundario">
                          {plazo.cantidad_dias} días {plazo.computo === 'HABIL' ? 'hábiles' : 'corridos'}
                          <div>desde {fecha(plazo.fecha_notificacion)}</div>
                        </td>
                        <td>
                          <div className="tabla__numero">{fecha(plazo.fecha_vencimiento)}</div>
                          {plazo.dias_restantes !== null && (
                            <div style={{ marginTop: 4 }}>
                              <Vencimiento dias={plazo.dias_restantes} texto={enDias(plazo.dias_restantes)} />
                            </div>
                          )}
                        </td>
                        <td>
                          <EstadoPlazo estado={plazo.estado} />
                        </td>
                        <td className="columna--secundaria tabla__secundario">
                          <Dato>{plazo.responsable}</Dato>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        )}

        {activa === 'documentos' && (
          <Tarjeta titulo="Documentos" sinRelleno>
            {documentos.isPending && <EsqueletoLista />}
            {documentos.isError && (
              <ErrorCarga error={documentos.error} reintentar={() => void documentos.refetch()} />
            )}
            {documentos.data?.length === 0 && (
              <Vacio
                titulo="Sin documentos"
                texto="La carga de archivos se habilita en la fase de gestión documental."
                icono={<Paperclip size={20} aria-hidden />}
              />
            )}
            {documentos.data && documentos.data.length > 0 && (
              <div className="lista">
                {documentos.data.map((documento) => (
                  <div key={documento.id} className="lista__item">
                    <span className="indicador__icono" style={{ width: 30, height: 30 }} aria-hidden>
                      <FileText size={15} />
                    </span>
                    <span className="lista__cuerpo">
                      <span className="lista__titulo">{documento.nombre_original}</span>
                      <span className="lista__meta">
                        {documento.tipo_documento ?? 'Sin clasificar'} ·{' '}
                        {tamanoArchivo(documento.tamano_bytes)} · {fecha(documento.fecha_subida)}
                        {documento.subido_por && ` · ${documento.subido_por}`}
                      </span>
                    </span>
                    <span className="lista__lateral">
                      <Etiqueta
                        tono={
                          documento.estado_extraccion === 'COMPLETADA'
                            ? 'exito'
                            : documento.estado_extraccion === 'ERROR'
                              ? 'peligro'
                              : 'neutral'
                        }
                        title="Estado de la extracción de texto del PDF"
                      >
                        {legible(documento.estado_extraccion)}
                      </Etiqueta>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>
        )}

        {activa === 'tareas' && (
          <Tarjeta titulo="Tareas del expediente" sinRelleno>
            {tareas.isPending && <EsqueletoLista />}
            {tareas.isError && <ErrorCarga error={tareas.error} reintentar={() => void tareas.refetch()} />}
            {tareas.data?.length === 0 && (
              <Vacio
                titulo="Sin tareas"
                texto="Las tareas vinculadas a este expediente aparecen acá."
                icono={<ListChecks size={20} aria-hidden />}
              />
            )}
            {tareas.data && tareas.data.length > 0 && (
              <div className="lista">
                {tareas.data.map((tarea) => (
                  <div key={tarea.id} className="lista__item">
                    <span className="lista__cuerpo">
                      <span className="lista__titulo">{tarea.titulo}</span>
                      <span className="lista__meta">
                        {tarea.asignada_a ?? 'Sin asignar'}
                        {tarea.fecha_vencimiento && (
                          <>
                            {' · '}
                            <CalendarDays
                              size={12}
                              aria-hidden
                              style={{ display: 'inline', verticalAlign: -2 }}
                            />{' '}
                            {fecha(tarea.fecha_vencimiento)}
                          </>
                        )}
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
        )}
      </div>

      {/* Los diálogos se montan recién cuando se abren: así sus consultas no
          corren mientras están cerrados. */}
      {editando && (
        <DialogoExpediente abierto alCerrar={() => setEditando(false)} causa={causa} />
      )}

      {agregandoParte && id && (
        <DialogoAgregarParte
          abierto
          alCerrar={() => setAgregandoParte(false)}
          causaId={id}
          caratula={causa.caratula}
          yaEnLaCausa={partes}
        />
      )}

      {asignando && id && (
        <DialogoAsignarProfesional
          abierto
          alCerrar={() => setAsignando(false)}
          causaId={id}
          caratula={causa.caratula}
          yaAsignados={profesionales}
        />
      )}

      <DialogoConfirmar
        abierto={dandoDeBaja}
        titulo="Dar de baja el expediente"
        mensaje={
          <>
            El expediente <strong>{causa.caratula}</strong> deja de aparecer en el sistema. No se
            borra: sus plazos, documentos y movimientos se conservan, y la baja queda registrada en
            la auditoría.
          </>
        }
        textoConfirmar="Dar de baja"
        cargando={eliminarCausa.isPending}
        error={errorBaja}
        alConfirmar={() => void confirmarBajaCausa()}
        alCerrar={() => setDandoDeBaja(false)}
      />

      <DialogoConfirmar
        abierto={Boolean(parteAQuitar)}
        titulo="Quitar la parte del expediente"
        mensaje={
          <>
            <strong>{parteAQuitar?.nombre_completo}</strong> deja de figurar como{' '}
            {caracterLegible(parteAQuitar?.caracter).toLowerCase()} en este expediente. Sigue en la
            agenda del estudio y en los demás expedientes donde interviene.
          </>
        }
        textoConfirmar="Quitar del expediente"
        cargando={quitarParte.isPending}
        error={errorBaja}
        alConfirmar={() => void confirmarQuitarParte()}
        alCerrar={() => setParteAQuitar(undefined)}
      />

      <DialogoConfirmar
        abierto={Boolean(profesionalAQuitar)}
        titulo="Desasignar del expediente"
        mensaje={
          <>
            <strong>{profesionalAQuitar?.nombre_completo}</strong> deja de estar a cargo de este
            expediente. Queda asentado hasta qué fecha lo trabajó.
          </>
        }
        textoConfirmar="Desasignar"
        cargando={desasignar.isPending}
        error={errorBaja}
        alConfirmar={() => void confirmarDesasignar()}
        alCerrar={() => setProfesionalAQuitar(undefined)}
      />
    </>
  );
}
