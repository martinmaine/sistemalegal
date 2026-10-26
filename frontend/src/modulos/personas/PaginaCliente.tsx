import { Link, useParams } from 'react-router-dom';
import { Building2, FolderOpen, User } from 'lucide-react';
import { usePersona } from '../../servicios/consultas';
import { CabeceraPagina } from '../../componentes/ui/CabeceraPagina';
import { Tarjeta } from '../../componentes/ui/Tarjeta';
import { Dato } from '../../componentes/ui/Tabla';
import { EstadoCausa, Etiqueta } from '../../componentes/ui/Etiqueta';
import { Cargando, ErrorCarga, Vacio } from '../../componentes/ui/Estados';
import { fecha, fechaHora, legible } from '../../lib/formato';

/**
 * Ficha de una persona.
 *
 * Muestra sus datos y, sobre todo, en qué expedientes interviene y con qué
 * carácter en cada uno: esa relación es lo que convierte la agenda en algo
 * útil y no en una libreta de contactos.
 */

export function PaginaCliente() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError, error, refetch } = usePersona(id);

  if (isPending) return <Cargando texto="Cargando la ficha…" />;

  if (isError) {
    return (
      <>
        <CabeceraPagina titulo="Persona" migas={[{ texto: 'Clientes y partes', ruta: '/clientes' }]} />
        <Tarjeta>
          <ErrorCarga error={error} reintentar={() => void refetch()} />
        </Tarjeta>
      </>
    );
  }

  const { persona, causas } = data;
  const esJuridica = persona.tipo_persona === 'JURIDICA';

  return (
    <>
      <CabeceraPagina
        migas={[{ texto: 'Clientes y partes', ruta: '/clientes' }, { texto: persona.nombre_completo }]}
        titulo={
          <span className="fila" style={{ gap: 'var(--esp-3)' }}>
            <span className="indicador__icono" style={{ width: 38, height: 38 }} aria-hidden>
              {esJuridica ? <Building2 size={19} /> : <User size={19} />}
            </span>
            {persona.nombre_completo}
          </span>
        }
        descripcion={
          <span className="fila fila--envuelve" style={{ gap: 'var(--esp-2)', marginTop: 'var(--esp-2)' }}>
            <Etiqueta tono="neutral">{esJuridica ? 'Persona jurídica' : 'Persona física'}</Etiqueta>
            {persona.es_cliente && <Etiqueta tono="marca">Cliente del estudio</Etiqueta>}
          </span>
        }
      />

      <div className="rejilla-detalle">
        <div className="pila">
          <Tarjeta titulo="Expedientes en los que interviene" sinRelleno>
            {causas.length === 0 ? (
              <Vacio
                titulo="Sin expedientes vinculados"
                texto="Esta persona todavía no figura como parte en ninguna causa."
                icono={<FolderOpen size={20} aria-hidden />}
              />
            ) : (
              <div className="tabla-envoltorio">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Carátula</th>
                      <th scope="col">Carácter</th>
                      <th scope="col" className="columna--opcional">
                        Fuero
                      </th>
                      <th scope="col">Estado</th>
                      <th scope="col" className="columna--opcional">
                        Inicio
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {causas.map((causa) => (
                      <tr key={causa.causa_id}>
                        <td>
                          <Link to={`/expedientes/${causa.causa_id}`} className="tabla__principal">
                            {causa.caratula}
                          </Link>
                          <div className="tabla__secundario tabla__numero">
                            <Dato>{causa.numero_expediente}</Dato>
                          </div>
                        </td>
                        <td>
                          <span className="fila" style={{ gap: 'var(--esp-2)' }}>
                            <Etiqueta tono="neutral">{legible(causa.caracter)}</Etiqueta>
                            {causa.es_cliente && <Etiqueta tono="marca">Cliente</Etiqueta>}
                          </span>
                        </td>
                        <td className="columna--opcional tabla__secundario">{causa.fuero}</td>
                        <td>
                          <EstadoCausa estado={causa.estado} esFinal={causa.es_final} />
                        </td>
                        <td className="columna--opcional tabla__numero">{fecha(causa.fecha_inicio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>

          {persona.observaciones && (
            <Tarjeta titulo="Observaciones">
              <p style={{ whiteSpace: 'pre-wrap' }}>{persona.observaciones}</p>
            </Tarjeta>
          )}
        </div>

        <Tarjeta titulo="Datos de contacto">
          <div className="pila">
            <div>
              <p className="dato__etiqueta">{esJuridica ? 'Razón social' : 'Nombre completo'}</p>
              <p className="dato__valor">{persona.nombre_completo}</p>
            </div>

            <div>
              <p className="dato__etiqueta">Documento</p>
              <p className="dato__valor numero">
                <Dato>{persona.documento}</Dato>
              </p>
            </div>

            <div>
              <p className="dato__etiqueta">CUIT / CUIL</p>
              <p className="dato__valor numero">
                <Dato>{persona.cuit_cuil}</Dato>
              </p>
            </div>

            <div>
              <p className="dato__etiqueta">Correo electrónico</p>
              <p className="dato__valor">
                {persona.email ? (
                  <a href={`mailto:${persona.email}`}>{persona.email}</a>
                ) : (
                  <span className="dato__valor--vacio">—</span>
                )}
              </p>
            </div>

            <div>
              <p className="dato__etiqueta">Teléfono</p>
              <p className="dato__valor">
                {persona.telefono ? (
                  <a href={`tel:${persona.telefono}`}>{persona.telefono}</a>
                ) : (
                  <span className="dato__valor--vacio">—</span>
                )}
              </p>
            </div>

            <div>
              <p className="dato__etiqueta">Domicilio</p>
              <p className="dato__valor">
                <Dato>
                  {[persona.domicilio, persona.localidad, persona.provincia].filter(Boolean).join(', ') ||
                    null}
                </Dato>
              </p>
            </div>

            <div>
              <p className="dato__etiqueta">En la agenda desde</p>
              <p className="dato__valor numero">{fechaHora(persona.creado_en)}</p>
            </div>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
