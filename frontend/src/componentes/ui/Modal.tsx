import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Boton } from './Boton';

/**
 * Diálogo modal.
 *
 * Resuelve lo que un div con position: fixed no resuelve solo:
 *  - Escape cierra.
 *  - El foco entra al diálogo al abrirse y vuelve al disparador al cerrarse.
 *  - El foco queda atrapado adentro mientras está abierto.
 *  - El fondo no se desplaza detrás del modal.
 *
 * Se usa solo cuando la tarea lo justifica (un alta, una confirmación
 * destructiva), nunca para mostrar un mensaje que cabe en la página.
 */

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: string;
  ancho?: boolean;
  pie?: React.ReactNode;
  children: React.ReactNode;
}

const ENFOCABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ abierto, alCerrar, titulo, descripcion, ancho, pie, children }: Props) {
  const dialogo = useRef<HTMLDivElement>(null);
  const disparador = useRef<Element | null>(null);

  useEffect(() => {
    if (!abierto) return;

    disparador.current = document.activeElement;
    const desbordeOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // El primer control del diálogo recibe el foco; si no hay ninguno, lo toma
    // el propio diálogo para que el lector de pantalla anuncie el título.
    const primero = dialogo.current?.querySelector<HTMLElement>(ENFOCABLES);
    (primero ?? dialogo.current)?.focus();

    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        alCerrar();
        return;
      }

      if (evento.key !== 'Tab') return;

      const enfocables = dialogo.current?.querySelectorAll<HTMLElement>(ENFOCABLES);
      if (!enfocables?.length) return;

      const primerElemento = enfocables[0]!;
      const ultimo = enfocables[enfocables.length - 1]!;

      // Ciclo cerrado: desde el último con Tab se vuelve al primero, y al revés
      // con Shift+Tab. Sin esto, el foco se escapa al contenido de atrás.
      if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primerElemento.focus();
      } else if (evento.shiftKey && document.activeElement === primerElemento) {
        evento.preventDefault();
        ultimo.focus();
      }
    }

    document.addEventListener('keydown', alPresionar);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = desbordeOriginal;
      (disparador.current as HTMLElement | null)?.focus?.();
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return createPortal(
    <div
      className="capa-fondo"
      // Clic fuera cierra, pero solo si empezó fuera: arrastrar una selección
      // desde adentro hasta el fondo no debería cerrar el diálogo.
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div
        className={`modal${ancho ? ' modal--ancho' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        aria-describedby={descripcion ? 'modal-descripcion' : undefined}
        ref={dialogo}
        tabIndex={-1}
      >
        <header className="modal__cabecera">
          <div>
            <h2 className="tarjeta__titulo" id="modal-titulo">
              {titulo}
            </h2>
            {descripcion && (
              <p className="tarjeta__descripcion" id="modal-descripcion">
                {descripcion}
              </p>
            )}
          </div>
          <Boton
            variante="sutil"
            pequeno
            onClick={alCerrar}
            aria-label="Cerrar"
            icono={<X size={16} aria-hidden />}
          />
        </header>

        <div className="modal__cuerpo">{children}</div>

        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>,
    document.body,
  );
}
