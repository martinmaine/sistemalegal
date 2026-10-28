import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Buscador con retardo.
 *
 * Escribe en el campo al instante pero avisa al padre recién cuando el usuario
 * deja de tipear: sin eso, cada tecla dispararía una consulta al servidor.
 *
 * El valor controlado se sincroniza desde afuera para que, si la búsqueda se
 * limpia desde otro lado (un botón de "quitar filtros", por ejemplo), el campo
 * se vacíe también.
 */

interface Props {
  valor: string;
  alCambiar: (valor: string) => void;
  marcador?: string;
  etiqueta: string;
  retardoMs?: number;
  autoFoco?: boolean;
}

export function Buscador({
  valor,
  alCambiar,
  marcador = 'Buscar…',
  etiqueta,
  retardoMs = 300,
  autoFoco = false,
}: Props) {
  const [texto, setTexto] = useState(valor);
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;

  useEffect(() => {
    setTexto(valor);
  }, [valor]);

  useEffect(() => {
    if (texto === valor) return;

    const reloj = setTimeout(() => alCambiarRef.current(texto), retardoMs);
    return () => clearTimeout(reloj);
    // `valor` queda fuera a propósito: incluirlo reiniciaría el retardo cada
    // vez que el padre confirma el cambio, y la búsqueda nunca se dispararía.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, retardoMs]);

  function limpiar() {
    setTexto('');
    alCambiarRef.current('');
  }

  return (
    <div className="buscador">
      <Search size={16} className="buscador__icono" aria-hidden />
      <input
        type="search"
        className="entrada"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={marcador}
        aria-label={etiqueta}
        autoFocus={autoFoco}
      />
      {texto && (
        <button type="button" className="buscador__limpiar" onClick={limpiar} aria-label="Limpiar búsqueda">
          <X size={15} aria-hidden />
        </button>
      )}
    </div>
  );
}
