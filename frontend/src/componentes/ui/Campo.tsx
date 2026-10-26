import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Campos de formulario.
 *
 * Cada campo arma por su cuenta la relación entre etiqueta, control, ayuda y
 * error (`htmlFor`, `aria-describedby`, `aria-invalid`). Si eso quedara en
 * manos de cada pantalla, tarde o temprano alguno quedaría suelto y el lector
 * de pantalla leería un control sin nombre.
 */

interface Base {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  obligatorio?: boolean;
}

function Envoltorio({
  etiqueta,
  ayuda,
  error,
  obligatorio,
  idControl,
  idAyuda,
  idError,
  children,
}: Base & { idControl: string; idAyuda: string; idError: string; children: ReactNode }) {
  return (
    <div className={`campo${error ? ' campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={idControl}>
        {etiqueta}
        {obligatorio && (
          <span className="campo__obligatorio" aria-hidden>
            *
          </span>
        )}
      </label>

      {children}

      {ayuda && !error && (
        <p className="campo__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}

      {error && (
        <p className="campo__error" id={idError}>
          <AlertCircle size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          {error}
        </p>
      )}
    </div>
  );
}

/** Ids de ayuda y error que el control declara en aria-describedby. */
function descripcion(ayuda: string | undefined, error: string | undefined, idAyuda: string, idError: string) {
  if (error) return idError;
  if (ayuda) return idAyuda;
  return undefined;
}

type PropsTexto = Base & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'>;

export function CampoTexto({ etiqueta, ayuda, error, obligatorio, ...resto }: PropsTexto) {
  const base = useId();
  const idControl = `${base}-control`;

  return (
    <Envoltorio
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      obligatorio={obligatorio}
      idControl={idControl}
      idAyuda={`${base}-ayuda`}
      idError={`${base}-error`}
    >
      <input
        id={idControl}
        className="campo__control"
        required={obligatorio}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion(ayuda, error, `${base}-ayuda`, `${base}-error`)}
        {...resto}
      />
    </Envoltorio>
  );
}

type PropsArea = Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'>;

export function CampoArea({ etiqueta, ayuda, error, obligatorio, ...resto }: PropsArea) {
  const base = useId();
  const idControl = `${base}-control`;

  return (
    <Envoltorio
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      obligatorio={obligatorio}
      idControl={idControl}
      idAyuda={`${base}-ayuda`}
      idError={`${base}-error`}
    >
      <textarea
        id={idControl}
        className="campo__control"
        required={obligatorio}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion(ayuda, error, `${base}-ayuda`, `${base}-error`)}
        {...resto}
      />
    </Envoltorio>
  );
}

export interface Opcion {
  valor: string;
  texto: string;
}

type PropsSelect = Base &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id' | 'children'> & {
    opciones: Opcion[];
    /** Texto de la opción vacía. Si falta, el campo no ofrece "sin elegir". */
    vacio?: string;
  };

export function CampoSelect({
  etiqueta,
  ayuda,
  error,
  obligatorio,
  opciones,
  vacio,
  ...resto
}: PropsSelect) {
  const base = useId();
  const idControl = `${base}-control`;

  return (
    <Envoltorio
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      obligatorio={obligatorio}
      idControl={idControl}
      idAyuda={`${base}-ayuda`}
      idError={`${base}-error`}
    >
      <select
        id={idControl}
        className="campo__control"
        required={obligatorio}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion(ayuda, error, `${base}-ayuda`, `${base}-error`)}
        {...resto}
      >
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </Envoltorio>
  );
}

/** Select compacto para la barra de filtros: su etiqueta no se dibuja, se lee. */
export function FiltroSelect({
  etiqueta,
  opciones,
  vacio,
  ...resto
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> & {
  etiqueta: string;
  opciones: Opcion[];
  vacio: string;
}) {
  return (
    <select className="campo__control" aria-label={etiqueta} {...resto}>
      <option value="">{vacio}</option>
      {opciones.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor}>
          {opcion.texto}
        </option>
      ))}
    </select>
  );
}
