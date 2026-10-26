import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, FilterX, User, Users } from 'lucide-react';
import { usePersonas } from '../../servicios/consultas';
import type { FiltrosPersona } from '../../servicios/consultas';
import { CabeceraPagina } from '../../componentes/ui/CabeceraPagina';
import { Tarjeta } from '../../componentes/ui/Tarjeta';
import { Boton } from '../../componentes/ui/Boton';
import { Buscador } from '../../componentes/ui/Buscador';
import { FiltroSelect } from '../../componentes/ui/Campo';
import { Dato } from '../../componentes/ui/Tabla';
import { Paginacion } from '../../componentes/ui/Paginacion';
import { Etiqueta } from '../../componentes/ui/Etiqueta';
import { ErrorCarga, EsqueletoTabla, Vacio } from '../../componentes/ui/Estados';

/**
 * Agenda de clientes y partes.
 *
 * Una sola lista para todas las personas del estudio, con un filtro para ver
 * solo clientes. Mantener dos agendas separadas obligaría a cargar dos veces a
 * quien es cliente en un expediente y contraparte en otro, que es justamente
 * lo que el modelo de datos evita.
 */

const TAMANO_PAGINA = 20;

export function PaginaClientes() {
  const [parametros, setParametros] = useSearchParams();
  const navegar = useNavigate();

  const filtros = useMemo<FiltrosPersona>(
    () => ({
      pagina: Math.max(1, Number(parametros.get('pagina') ?? 1) || 1),
      tamano: TAMANO_PAGINA,
      busqueda: parametros.get('busqueda') ?? undefined,
      tipo:
        parametros.get('tipo') === 'FISICA'
          ? 'FISICA'
          : parametros.get('tipo') === 'JURIDICA'
            ? 'JURIDICA'
            : undefined,
      soloClientes: parametros.get('soloClientes') === 'true',
    }),
    [parametros],
  );

  const { data, isPending, isFetching, isError, error, refetch } = usePersonas(filtros);

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

  const hayFiltros = Boolean(filtros.busqueda || filtros.tipo || filtros.soloClientes);

  return (
    <>
      <CabeceraPagina
        titulo="Clientes y partes"
        descripcion="Agenda única de personas vinculadas a los expedientes del estudio."
      />

      <Tarjeta sinRelleno>
        <div className="barra-filtros">
          <div className="barra-filtros__buscador">
            <Buscador
              valor={filtros.busqueda ?? ''}
              alCambiar={(valor) => escribir({ busqueda: valor })}
              etiqueta="Buscar personas"
              marcador="Buscar por nombre, documento, CUIT o correo…"
            />
          </div>

          <div className="barra-filtros__grupo">
            <FiltroSelect
              etiqueta="Filtrar por tipo de persona"
              vacio="Personas y empresas"
              value={filtros.tipo ?? ''}
              onChange={(evento) => escribir({ tipo: evento.target.value })}
              opciones={[
                { valor: 'FISICA', texto: 'Solo personas físicas' },
                { valor: 'JURIDICA', texto: 'Solo personas jurídicas' },
              ]}
            />

            <FiltroSelect
              etiqueta="Filtrar por vínculo"
              vacio="Todos los vínculos"
              value={filtros.soloClientes ? 'true' : ''}
              onChange={(evento) => escribir({ soloClientes: evento.target.value })}
              opciones={[{ valor: 'true', texto: 'Solo clientes' }]}
            />

            {hayFiltros && (
              <Boton
                variante="sutil"
                pequeno
                onClick={() => setParametros(new URLSearchParams(), { replace: true })}
                icono={<FilterX size={15} aria-hidden />}
              >
                Quitar filtros
              </Boton>
            )}
          </div>

          <p className="barra-filtros__resumen" aria-live="polite">
            {isFetching && !isPending
              ? 'Actualizando…'
              : data
                ? `${data.total} ${data.total === 1 ? 'persona' : 'personas'}`
                : ''}
          </p>
        </div>

        {isPending && <EsqueletoTabla filas={8} columnas={5} />}
        {isError && <ErrorCarga error={error} reintentar={() => void refetch()} />}

        {data && !isError && data.datos.length === 0 && (
          <Vacio
            titulo={hayFiltros ? 'Ninguna persona coincide' : 'Todavía no hay personas cargadas'}
            texto={
              hayFiltros
                ? 'Probá con otros filtros o quitá los que aplicaste.'
                : 'Las personas se cargan al vincularlas a un expediente.'
            }
            icono={<Users size={20} aria-hidden />}
          />
        )}

        {data && !isError && data.datos.length > 0 && (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--clicable">
              <caption className="solo-lectores">
                Personas del estudio. Cada fila abre la ficha de la persona.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col" className="columna--opcional">
                    Documento
                  </th>
                  <th scope="col" className="columna--secundaria">
                    Contacto
                  </th>
                  <th scope="col" className="columna--opcional">
                    Localidad
                  </th>
                  <th scope="col">Expedientes</th>
                </tr>
              </thead>
              <tbody>
                {data.datos.map((persona) => (
                  <tr key={persona.id} onClick={() => navegar(`/clientes/${persona.id}`)}>
                    <td>
                      <span className="fila" style={{ gap: 'var(--esp-3)' }}>
                        <span className="indicador__icono" style={{ width: 30, height: 30 }} aria-hidden>
                          {persona.tipo_persona === 'JURIDICA' ? <Building2 size={15} /> : <User size={15} />}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <Link
                            to={`/clientes/${persona.id}`}
                            className="tabla__principal"
                            onClick={(evento) => evento.stopPropagation()}
                            style={{ color: 'inherit' }}
                          >
                            {persona.nombre_completo}
                          </Link>
                          {persona.es_cliente && (
                            <span style={{ marginLeft: 'var(--esp-2)' }}>
                              <Etiqueta tono="marca">Cliente</Etiqueta>
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="columna--opcional tabla__numero">
                      <Dato>{persona.documento ?? persona.cuit_cuil}</Dato>
                    </td>
                    <td className="columna--secundaria tabla__secundario">
                      <div>
                        <Dato>{persona.email}</Dato>
                      </div>
                      <div>
                        <Dato>{persona.telefono}</Dato>
                      </div>
                    </td>
                    <td className="columna--opcional tabla__secundario">
                      <Dato>{persona.localidad}</Dato>
                    </td>
                    <td className="numero">{persona.cantidad_causas}</td>
                  </tr>
                ))}
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
              alCambiarPagina={(pagina) =>
                escribir({ pagina: pagina <= 1 ? undefined : String(pagina) }, false)
              }
              sustantivo="personas"
            />
          </div>
        )}
      </Tarjeta>
    </>
  );
}
