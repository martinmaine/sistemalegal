import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/** Cabecera estándar de una pantalla: migas, título, descripción y acciones. */

export interface Miga {
  texto: string;
  ruta?: string;
}

interface Props {
  titulo: ReactNode;
  descripcion?: ReactNode;
  migas?: Miga[];
  acciones?: ReactNode;
}

export function CabeceraPagina({ titulo, descripcion, migas, acciones }: Props) {
  return (
    <>
      {migas && migas.length > 0 && (
        <nav className="migas" aria-label="Ubicación">
          {migas.map((miga, indice) => (
            <span key={`${miga.texto}-${indice}`} className="fila" style={{ gap: 4 }}>
              {indice > 0 && <ChevronRight size={13} aria-hidden />}
              {miga.ruta ? (
                <Link to={miga.ruta}>{miga.texto}</Link>
              ) : (
                <span aria-current="page">{miga.texto}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <header className="pagina__cabecera">
        <div style={{ minWidth: 0 }}>
          <h1 className="pagina__titulo">{titulo}</h1>
          {descripcion && <p className="pagina__descripcion">{descripcion}</p>}
        </div>
        {acciones && <div className="pagina__acciones">{acciones}</div>}
      </header>
    </>
  );
}
