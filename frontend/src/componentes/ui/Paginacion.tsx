import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Boton } from './Boton';

/**
 * Paginación del servidor.
 *
 * Muestra el rango real ("1–20 de 143") y no solo el número de página: así el
 * usuario sabe cuánto hay en total sin tener que ir hasta el final.
 */

interface Props {
  pagina: number;
  totalPaginas: number;
  total: number;
  tamano: number;
  cantidadEnPagina: number;
  alCambiarPagina: (pagina: number) => void;
  /** Nombre en plural de lo que se lista: "expedientes", "personas". */
  sustantivo: string;
}

export function Paginacion({
  pagina,
  totalPaginas,
  total,
  tamano,
  cantidadEnPagina,
  alCambiarPagina,
  sustantivo,
}: Props) {
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = total === 0 ? 0 : desde + cantidadEnPagina - 1;

  return (
    <div className="paginacion">
      <p className="paginacion__resumen">
        {total === 0 ? (
          `Sin ${sustantivo}`
        ) : (
          <>
            <span className="numero">
              {desde}–{hasta}
            </span>{' '}
            de <span className="numero">{total}</span> {sustantivo}
          </>
        )}
      </p>

      {totalPaginas > 1 && (
        <div className="paginacion__controles">
          <Boton
            pequeno
            onClick={() => alCambiarPagina(pagina - 1)}
            disabled={pagina <= 1}
            aria-label="Página anterior"
            icono={<ChevronLeft size={16} aria-hidden />}
          />
          <span className="paginacion__pagina" aria-live="polite">
            Página {pagina} de {totalPaginas}
          </span>
          <Boton
            pequeno
            onClick={() => alCambiarPagina(pagina + 1)}
            disabled={pagina >= totalPaginas}
            aria-label="Página siguiente"
            icono={<ChevronRight size={16} aria-hidden />}
          />
        </div>
      )}
    </div>
  );
}
