import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw, ShieldOff } from 'lucide-react';
import { ErrorApi } from '../../servicios/api';
import { Boton } from './Boton';

/**
 * Los cuatro estados que toda pantalla con datos tiene que resolver: cargando,
 * vacío, error y con contenido. Tenerlos como componentes evita que cada
 * pantalla los improvise distinto.
 */

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="estado" role="status" aria-live="polite">
      <Loader2 size={22} className="gira" aria-hidden />
      <p className="estado__texto">{texto}</p>
    </div>
  );
}

/** Filas fantasma con la forma de la tabla que viene, para que nada salte. */
export function EsqueletoTabla({ filas = 6, columnas = 5 }: { filas?: number; columnas?: number }) {
  return (
    <div className="tabla-envoltorio" aria-hidden>
      <table className="tabla">
        <tbody>
          {Array.from({ length: filas }, (_, fila) => (
            <tr key={fila}>
              {Array.from({ length: columnas }, (_, columna) => (
                <td key={columna}>
                  <div
                    className="esqueleto"
                    style={{ height: 14, width: columna === 0 ? '70%' : '45%' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EsqueletoLista({ filas = 4 }: { filas?: number }) {
  return (
    <div className="lista" aria-hidden>
      {Array.from({ length: filas }, (_, fila) => (
        <div className="lista__item" key={fila}>
          <div className="lista__cuerpo pila--ajustada" style={{ display: 'grid', gap: 8 }}>
            <div className="esqueleto" style={{ height: 13, width: '62%' }} />
            <div className="esqueleto" style={{ height: 11, width: '38%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface PropsVacio {
  titulo: string;
  texto?: string;
  icono?: ReactNode;
  accion?: ReactNode;
}

export function Vacio({ titulo, texto, icono, accion }: PropsVacio) {
  return (
    <div className="estado">
      <div className="estado__icono">{icono ?? <Inbox size={20} aria-hidden />}</div>
      <p className="estado__titulo">{titulo}</p>
      {texto && <p className="estado__texto">{texto}</p>}
      {accion}
    </div>
  );
}

/**
 * Error de carga.
 *
 * Distingue la falta de permisos del fallo técnico: decirle "no se pudo
 * cargar" a alguien que simplemente no tiene acceso lo manda a buscar un
 * problema que no existe.
 */
export function ErrorCarga({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  const esApi = error instanceof ErrorApi;
  const sinPermiso = esApi && error.esDePermiso;

  const mensaje = esApi
    ? error.message
    : 'Ocurrió un problema inesperado al cargar la información.';

  return (
    <div className="estado" role="alert">
      <div className="estado__icono estado__icono--error">
        {sinPermiso ? <ShieldOff size={20} aria-hidden /> : <AlertTriangle size={20} aria-hidden />}
      </div>
      <p className="estado__titulo">
        {sinPermiso ? 'No tenés acceso a esta información' : 'No se pudo cargar'}
      </p>
      <p className="estado__texto">{mensaje}</p>
      {reintentar && !sinPermiso && (
        <Boton onClick={reintentar} icono={<RefreshCw size={15} aria-hidden />}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}
