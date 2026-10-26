import type { ReactNode } from 'react';

/** Superficie base del producto: cabecera opcional, cuerpo y pie opcional. */

interface Props {
  titulo?: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
  pie?: ReactNode;
  /** Para cuerpos que ya traen su propio relleno, como tablas y listas. */
  sinRelleno?: boolean;
  className?: string;
  children: ReactNode;
}

export function Tarjeta({
  titulo,
  descripcion,
  accion,
  pie,
  sinRelleno = false,
  className,
  children,
}: Props) {
  return (
    <section className={['tarjeta', className].filter(Boolean).join(' ')}>
      {(titulo || accion) && (
        <header className="tarjeta__cabecera">
          <div>
            {titulo && <h2 className="tarjeta__titulo">{titulo}</h2>}
            {descripcion && <p className="tarjeta__descripcion">{descripcion}</p>}
          </div>
          {accion}
        </header>
      )}

      <div className={`tarjeta__cuerpo${sinRelleno ? ' tarjeta__cuerpo--sin-relleno' : ''}`}>
        {children}
      </div>

      {pie && <footer className="tarjeta__pie">{pie}</footer>}
    </section>
  );
}
