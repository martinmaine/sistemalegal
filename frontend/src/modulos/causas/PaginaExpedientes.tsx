import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FilterX, FolderOpen, FolderPlus } from 'lucide-react';
import { useCatalogos, useCausas } from '../../servicios/consultas';
import { useSesion } from '../auth/ContextoSesion';
import { useFiltrosCausa } from './useFiltrosCausa';
import { DialogoNuevoExpediente } from './DialogoNuevoExpediente';
import { CabeceraPagina } from '../../componentes/ui/CabeceraPagina';
import { Tarjeta } from '../../componentes/ui/Tarjeta';
import { Boton } from '../../componentes/ui/Boton';
import { Buscador } from '../../componentes/ui/Buscador';
import { FiltroSelect } from '../../componentes/ui/Campo';
import { ColumnaOrdenable, Dato } from '../../componentes/ui/Tabla';
import { Paginacion } from '../../componentes/ui/Paginacion';
import { EstadoCausa, Vencimiento } from '../../componentes/ui/Etiqueta';
import { ErrorCarga, EsqueletoTabla, Vacio } from '../../componentes/ui/Estados';
import { enDias, fecha } from '../../lib/formato';

/**
 * Listado de expedientes.
 *
 * Es la pantalla de trabajo diario, así que todo pasa acá mismo: buscar,
 * filtrar, ordenar, paginar y dar de alta, sin pantallas intermedias. La
 * búsqueda, los filtros y el orden se resuelven en el servidor; el navegador
 * nunca recibe la tabla entera para recortarla.
 */

/** Días que faltan para una fecha, contados sobre el calendario local. */
function diasHasta(iso: string | null): number | null {
  if (!iso) return null;
  const partes = iso.split('-').map(Number);
  const objetivo = new Date(partes[0]!, partes[1]! - 1, partes[2]!);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
}

export function PaginaExpedientes() {
  const { filtros, actualizar, irAPagina, ordenarPor, limpiar, hayFiltros } = useFiltrosCausa();
  const { data, isPending, isFetching, isError, error, refetch } = useCausas(filtros);
  const { data: catalogos } = useCatalogos();
  const { puede } = useSesion();
  const navegar = useNavigate();

  const [parametros, setParametros] = useSearchParams();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  // El panel enlaza a /expedientes?nueva=1 para abrir el alta directamente.
  // El parámetro se consume y se quita, para que recargar no reabra el diálogo.
  useEffect(() => {
    if (parametros.get('nueva') !== '1') return;

    setDialogoAbierto(true);
    const siguientes = new URLSearchParams(parametros);
    siguientes.delete('nueva');
    setParametros(siguientes, { replace: true });
  }, [parametros, setParametros]);

  const puedeCrear = puede('causa.crear');

  const acciones = puedeCrear && (
    <Boton variante="primario" onClick={() => setDialogoAbierto(true)} icono={<FolderPlus size={16} aria-hidden />}>
      Nuevo expediente
    </Boton>
  );

  const tribunalesDelFuero = (catalogos?.tribunales ?? []).filter(
    (tribunal) => !filtros.fuero || tribunal.fuero_id === filtros.fuero,
  );

  return (
    <>
      <CabeceraPagina
        titulo="Expedientes"
        descripcion="Todas las causas del estudio."
        acciones={acciones || undefined}
      />

      <Tarjeta sinRelleno>
        <div className="barra-filtros">
          <div className="barra-filtros__buscador">
            <Buscador
              valor={filtros.busqueda ?? ''}
              alCambiar={(valor) => actualizar({ busqueda: valor })}
              etiqueta="Buscar expedientes"
              marcador="Buscar por carátula o número…"
            />
          </div>

          <div className="barra-filtros__grupo">
            <FiltroSelect
              etiqueta="Filtrar por vigencia"
              vacio="Todas las causas"
              value={filtros.vigencia === 'todas' ? '' : filtros.vigencia}
              onChange={(evento) => actualizar({ vigencia: evento.target.value || 'todas' })}
              opciones={[
                { valor: 'activas', texto: 'Solo activas' },
                { valor: 'cerradas', texto: 'Solo cerradas' },
              ]}
            />

            <FiltroSelect
              etiqueta="Filtrar por estado"
              vacio="Cualquier estado"
              value={filtros.estado ?? ''}
              onChange={(evento) => actualizar({ estado: evento.target.value })}
              opciones={(catalogos?.estados ?? []).map((estado) => ({
                valor: estado.id,
                texto: estado.nombre,
              }))}
            />

            <FiltroSelect
              etiqueta="Filtrar por fuero"
              vacio="Cualquier fuero"
              value={filtros.fuero ?? ''}
              onChange={(evento) =>
                // Cambiar de fuero invalida el tribunal elegido: se limpia.
                actualizar({ fuero: evento.target.value, tribunal: undefined })
              }
              opciones={(catalogos?.fueros ?? []).map((fuero) => ({ valor: fuero.id, texto: fuero.nombre }))}
            />

            <FiltroSelect
              etiqueta="Filtrar por tribunal"
              vacio="Cualquier tribunal"
              value={filtros.tribunal ?? ''}
              onChange={(evento) => actualizar({ tribunal: evento.target.value })}
              opciones={tribunalesDelFuero.map((tribunal) => ({ valor: tribunal.id, texto: tribunal.nombre }))}
            />

            <FiltroSelect
              etiqueta="Filtrar por profesional"
              vacio="Cualquier profesional"
              value={filtros.responsable ?? ''}
              onChange={(evento) => actualizar({ responsable: evento.target.value })}
              opciones={(catalogos?.profesionales ?? []).map((profesional) => ({
                valor: profesional.id,
                texto: profesional.nombre,
              }))}
            />

            {hayFiltros && (
              <Boton variante="sutil" pequeno onClick={limpiar} icono={<FilterX size={15} aria-hidden />}>
                Quitar filtros
              </Boton>
            )}
          </div>

          {/* aria-live: al filtrar, un lector de pantalla anuncia cuántos
              resultados quedaron sin tener que recorrer la tabla. */}
          <p className="barra-filtros__resumen" aria-live="polite">
            {isFetching && !isPending
              ? 'Actualizando…'
              : data
                ? `${data.total} ${data.total === 1 ? 'expediente' : 'expedientes'}`
                : ''}
          </p>
        </div>

        {isPending && <EsqueletoTabla filas={8} columnas={6} />}

        {isError && <ErrorCarga error={error} reintentar={() => void refetch()} />}

        {data && !isError && data.datos.length === 0 && (
          <Vacio
            titulo={hayFiltros ? 'Ningún expediente coincide' : 'Todavía no hay expedientes'}
            texto={
              hayFiltros
                ? 'Probá con otros filtros o quitá los que aplicaste.'
                : 'Cuando cargues el primer expediente, lo vas a ver acá.'
            }
            icono={<FolderOpen size={20} aria-hidden />}
            accion={
              hayFiltros ? (
                <Boton onClick={limpiar} icono={<FilterX size={15} aria-hidden />}>
                  Quitar filtros
                </Boton>
              ) : puedeCrear ? (
                <Boton
                  variante="primario"
                  onClick={() => setDialogoAbierto(true)}
                  icono={<FolderPlus size={16} aria-hidden />}
                >
                  Crear el primer expediente
                </Boton>
              ) : undefined
            }
          />
        )}

        {data && !isError && data.datos.length > 0 && (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--clicable">
              <caption className="solo-lectores">
                Expedientes del estudio. Cada fila abre el detalle del expediente.
              </caption>
              <thead>
                <tr>
                  <ColumnaOrdenable
                    columna="numero_expediente"
                    ordenActual={filtros.orden}
                    direccion={filtros.direccion}
                    alOrdenar={(columna) => ordenarPor(columna as never)}
                    className="columna--opcional"
                  >
                    Expediente
                  </ColumnaOrdenable>

                  <ColumnaOrdenable
                    columna="caratula"
                    ordenActual={filtros.orden}
                    direccion={filtros.direccion}
                    alOrdenar={(columna) => ordenarPor(columna as never)}
                  >
                    Carátula
                  </ColumnaOrdenable>

                  <th scope="col" className="columna--secundaria">
                    Fuero y tribunal
                  </th>

                  <ColumnaOrdenable
                    columna="estado"
                    ordenActual={filtros.orden}
                    direccion={filtros.direccion}
                    alOrdenar={(columna) => ordenarPor(columna as never)}
                  >
                    Estado
                  </ColumnaOrdenable>

                  <th scope="col" className="columna--opcional">
                    Responsable
                  </th>

                  <ColumnaOrdenable
                    columna="proximo_vencimiento"
                    ordenActual={filtros.orden}
                    direccion={filtros.direccion}
                    alOrdenar={(columna) => ordenarPor(columna as never)}
                  >
                    Próximo plazo
                  </ColumnaOrdenable>

                  <ColumnaOrdenable
                    columna="fecha_inicio"
                    ordenActual={filtros.orden}
                    direccion={filtros.direccion}
                    alOrdenar={(columna) => ordenarPor(columna as never)}
                    className="columna--opcional"
                  >
                    Inicio
                  </ColumnaOrdenable>
                </tr>
              </thead>

              <tbody>
                {data.datos.map((causa) => {
                  const dias = diasHasta(causa.proximo_vencimiento);

                  return (
                    <tr
                      key={causa.id}
                      // La fila entera responde al clic por comodidad, pero el
                      // enlace real está en la carátula: así la navegación por
                      // teclado funciona y se puede abrir en otra pestaña.
                      onClick={() => navegar(`/expedientes/${causa.id}`)}
                    >
                      <td className="columna--opcional">
                        <span className="tabla__numero">
                          <Dato>{causa.numero_expediente}</Dato>
                        </span>
                      </td>

                      <td>
                        <Link
                          to={`/expedientes/${causa.id}`}
                          className="tabla__principal"
                          onClick={(evento) => evento.stopPropagation()}
                          style={{ color: 'inherit' }}
                        >
                          {causa.caratula}
                        </Link>
                      </td>

                      <td className="columna--secundaria">
                        <div>{causa.fuero}</div>
                        <div className="tabla__secundario">
                          <Dato>{causa.tribunal}</Dato>
                        </div>
                      </td>

                      <td>
                        <EstadoCausa estado={causa.estado} esFinal={causa.es_final} />
                      </td>

                      <td className="columna--opcional tabla__secundario">
                        <Dato>{causa.responsable}</Dato>
                      </td>

                      <td>
                        {causa.proximo_vencimiento ? (
                          <>
                            <Vencimiento dias={dias} texto={enDias(dias)} />
                            <div className="tabla__secundario numero">
                              {fecha(causa.proximo_vencimiento)}
                            </div>
                          </>
                        ) : (
                          <span className="dato__valor--vacio">Sin plazos</span>
                        )}
                      </td>

                      <td className="columna--opcional tabla__numero">{fecha(causa.fecha_inicio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.datos.length > 0 && (
          <div className="tarjeta__pie">
            <Paginacion
              pagina={data.pagina}
              totalPaginas={data.totalPaginas}
              total={data.total}
              tamano={data.tamano}
              cantidadEnPagina={data.datos.length}
              alCambiarPagina={irAPagina}
              sustantivo="expedientes"
            />
          </div>
        )}
      </Tarjeta>

      {puedeCrear && (
        <DialogoNuevoExpediente abierto={dialogoAbierto} alCerrar={() => setDialogoAbierto(false)} />
      )}
    </>
  );
}
