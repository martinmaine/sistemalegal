import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/**
 * Piezas de tabla.
 *
 * El encabezado ordenable expone aria-sort, que es lo que un lector de
 * pantalla usa para anunciar por qué columna está ordenada la tabla y en qué
 * sentido. Sin eso, el orden sería una señal puramente visual.
 */

interface PropsOrden {
  columna: string;
  ordenActual: string;
  direccion: 'asc' | 'desc';
  alOrdenar: (columna: string) => void;
  children: ReactNode;
  className?: string;
}

export function ColumnaOrdenable({
  columna,
  ordenActual,
  direccion,
  alOrdenar,
  children,
  className,
}: PropsOrden) {
  const activa = ordenActual === columna;
  const sentido = activa ? (direccion === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <th scope="col" aria-sort={sentido} className={className}>
      <button
        type="button"
        className="tabla__orden"
        aria-sort={sentido}
        onClick={() => alOrdenar(columna)}
        title={`Ordenar por ${typeof children === 'string' ? children.toLowerCase() : 'esta columna'}`}
      >
        {children}
        {!activa && <ArrowUpDown size={13} aria-hidden />}
        {activa && direccion === 'asc' && <ArrowUp size={13} aria-hidden />}
        {activa && direccion === 'desc' && <ArrowDown size={13} aria-hidden />}
      </button>
    </th>
  );
}

/** Valor que puede faltar. Un guion gris dice "no hay dato" mejor que un hueco. */
export function Dato({ children }: { children: ReactNode }) {
  if (children === null || children === undefined || children === '') {
    return <span className="dato__valor--vacio">—</span>;
  }
  return <>{children}</>;
}
