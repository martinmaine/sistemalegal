import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Botón de la aplicación.
 *
 * `cargando` deshabilita y muestra el giro en el mismo lugar del icono, para
 * que el botón no cambie de ancho al enviarse un formulario: si se moviera,
 * un segundo clic podría caer en otro control.
 */

type Variante = 'primario' | 'secundario' | 'sutil' | 'peligro';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  pequeno?: boolean;
  bloque?: boolean;
  cargando?: boolean;
  icono?: ReactNode;
}

export function Boton({
  variante = 'secundario',
  pequeno = false,
  bloque = false,
  cargando = false,
  icono,
  children,
  className,
  disabled,
  type = 'button',
  ...resto
}: Props) {
  const clases = [
    'boton',
    `boton--${variante}`,
    pequeno && 'boton--pequeno',
    bloque && 'boton--bloque',
    !children && 'boton--icono',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={clases}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando ? <Loader2 size={16} className="gira" aria-hidden /> : icono}
      {children}
    </button>
  );
}
