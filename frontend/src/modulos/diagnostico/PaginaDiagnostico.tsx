import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useSalud } from '../../servicios/consultas';
import { useSesion } from '../auth/ContextoSesion';
import { api } from '../../servicios/api';
import { CabeceraPagina } from '../../componentes/ui/CabeceraPagina';
import { Tarjeta } from '../../componentes/ui/Tarjeta';
import { Boton } from '../../componentes/ui/Boton';
import { Etiqueta } from '../../componentes/ui/Etiqueta';
import { Cargando } from '../../componentes/ui/Estados';
import { fechaHora } from '../../lib/formato';

/**
 * Diagnóstico del sistema.
 *
 * Es la pantalla de verificación del Sprint S0, que comprobaba que la cadena
 * SPA → API → base respondía de punta a punta. No se eliminó al construir el
 * producto: sigue siendo la forma más rápida de saber si un despliegue quedó
 * bien. Lo que cambió es dónde vive: fuera del panel operativo, en su propia
 * ruta, donde no se confunde con el trabajo diario del estudio.
 */

export function PaginaDiagnostico() {
  const { data, isPending, isError, refetch, isFetching } = useSalud();
  const { usuario } = useSesion();

  const baseConectada = data?.base === 'conectada';

  return (
    <>
      <CabeceraPagina
        titulo="Diagnóstico del sistema"
        descripcion="Estado de los servicios de los que depende SistemaLegal."
        acciones={
          <Boton
            onClick={() => void refetch()}
            cargando={isFetching}
            icono={<RefreshCw size={15} aria-hidden />}
          >
            Volver a comprobar
          </Boton>
        }
      />

      <div className="pila">
        <Tarjeta titulo="Servicios">
          {isPending ? (
            <Cargando texto="Consultando el estado…" />
          ) : (
            <div className="datos">
              <div>
                <p className="dato__etiqueta">API</p>
                <p className="dato__valor">
                  {isError ? (
                    <Etiqueta tono="peligro">
                      <XCircle size={12} aria-hidden /> Sin respuesta
                    </Etiqueta>
                  ) : (
                    <Etiqueta tono="exito">
                      <CheckCircle2 size={12} aria-hidden /> Responde
                    </Etiqueta>
                  )}
                </p>
              </div>

              <div>
                <p className="dato__etiqueta">Base de datos</p>
                <p className="dato__valor">
                  {baseConectada ? (
                    <Etiqueta tono="exito">
                      <CheckCircle2 size={12} aria-hidden /> Conectada
                    </Etiqueta>
                  ) : (
                    <Etiqueta tono="peligro">
                      <XCircle size={12} aria-hidden /> Sin conexión
                    </Etiqueta>
                  )}
                </p>
                {data?.detalleBase && (
                  <p className="texto-pequeno texto-tenue" style={{ marginTop: 4 }}>
                    {data.detalleBase}
                  </p>
                )}
              </div>

              <div>
                <p className="dato__etiqueta">Entorno</p>
                <p className="dato__valor">{data?.entorno ?? '—'}</p>
              </div>

              <div>
                <p className="dato__etiqueta">Última comprobación</p>
                <p className="dato__valor numero">{fechaHora(data?.momento)}</p>
              </div>

              <div>
                <p className="dato__etiqueta">Origen de la API</p>
                <p className="dato__valor">
                  <code className="texto-pequeno">{api.urlBase}</code>
                </p>
              </div>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Tu sesión" descripcion="Lo que el servidor reconoce de tu usuario.">
          <div className="datos">
            <div>
              <p className="dato__etiqueta">Usuario</p>
              <p className="dato__valor">
                {usuario?.nombre} {usuario?.apellido}
              </p>
              <p className="texto-pequeno texto-tenue">{usuario?.email}</p>
            </div>

            <div>
              <p className="dato__etiqueta">Rol</p>
              <p className="dato__valor">{usuario?.rolNombre}</p>
            </div>

            <div>
              <p className="dato__etiqueta">Permisos otorgados</p>
              <p className="dato__valor numero">{usuario?.permisos.length ?? 0}</p>
              <p className="texto-pequeno texto-tenue">
                Los permisos se verifican en el servidor en cada petición.
              </p>
            </div>
          </div>
        </Tarjeta>

        <div className="aviso aviso--info">
          <span className="aviso__cuerpo">
            <span className="aviso__titulo">Datos de demostración</span>
            La base contiene información ficticia de <code>database/seed/002_datos_demo.sql</code>. Ningún
            dato real de personas.
          </span>
        </div>
      </div>
    </>
  );
}
