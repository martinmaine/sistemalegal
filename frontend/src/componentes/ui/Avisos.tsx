import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

/**
 * Avisos emergentes.
 *
 * Confirman que una acción ocurrió —"Expediente guardado"— sin interrumpir el
 * trabajo. Se anuncian con aria-live para que un lector de pantalla también los
 * reciba: un mensaje que solo se ve no sirve para todos los usuarios.
 *
 * No se usan para errores de formulario: esos van junto al campo que falla,
 * donde el usuario está mirando.
 */

type TipoAviso = 'exito' | 'error' | 'info';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

interface ValorContexto {
  avisar: (texto: string, tipo?: TipoAviso) => void;
}

const Contexto = createContext<ValorContexto | undefined>(undefined);

const DURACION_MS = 5000;

const ICONOS: Record<TipoAviso, ReactNode> = {
  exito: <CheckCircle2 size={18} aria-hidden />,
  error: <XCircle size={18} aria-hidden />,
  info: <Info size={18} aria-hidden />,
};

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const descartar = useCallback((id: number) => {
    setAvisos((previos) => previos.filter((aviso) => aviso.id !== id));
  }, []);

  const avisar = useCallback(
    (texto: string, tipo: TipoAviso = 'exito') => {
      const id = Date.now() + Math.random();
      setAvisos((previos) => [...previos, { id, tipo, texto }]);
      setTimeout(() => descartar(id), DURACION_MS);
    },
    [descartar],
  );

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Contexto.Provider value={valor}>
      {children}

      <div className="avisos-flotantes" role="status" aria-live="polite">
        {avisos.map((aviso) => (
          <div key={aviso.id} className={`aviso-flotante aviso-flotante--${aviso.tipo}`}>
            {ICONOS[aviso.tipo]}
            <span style={{ flex: 1 }}>{aviso.texto}</span>
            <button
              type="button"
              className="buscador__limpiar"
              style={{ position: 'static' }}
              onClick={() => descartar(aviso.id)}
              aria-label="Cerrar aviso"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos(): ValorContexto {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useAvisos debe usarse dentro de <ProveedorAvisos>');
  return valor;
}
