import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Boton } from './Boton';

/**
 * Confirmación de una acción que no se deshace sola.
 *
 * Tres decisiones deliberadas:
 *
 *  - **Dice qué se va a hacer y sobre qué.** "¿Confirmás?" obliga al usuario a
 *    recordar qué apretó. El nombre del expediente o de la persona va en el
 *    cuerpo del mensaje.
 *  - **El botón nombra la acción**, no dice "Aceptar": lo último que se lee
 *    antes de hacer clic tiene que ser la consecuencia.
 *  - **Cancelar es lo más fácil.** Escape cierra, el clic afuera cierra, y
 *    Cancelar queda primero en el orden de tabulación.
 */

interface Props {
  abierto: boolean;
  titulo: string;
  /** Qué va a pasar, en una o dos frases. Nombrá el registro afectado. */
  mensaje: React.ReactNode;
  /** Texto del botón que confirma. Un verbo: "Dar de baja", "Quitar del expediente". */
  textoConfirmar: string;
  cargando?: boolean;
  /** El error del servidor: una baja puede estar bloqueada por una regla de negocio. */
  error?: string;
  alConfirmar: () => void;
  alCerrar: () => void;
}

export function DialogoConfirmar({
  abierto,
  titulo,
  mensaje,
  textoConfirmar,
  cargando = false,
  error,
  alConfirmar,
  alCerrar,
}: Props) {
  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={cargando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={alConfirmar} cargando={cargando}>
            {cargando ? 'Procesando…' : textoConfirmar}
          </Boton>
        </>
      }
    >
      <div className="pila">
        <div className="fila" style={{ gap: 'var(--esp-3)', alignItems: 'flex-start' }}>
          <span className="indicador__icono indicador__icono--alerta" aria-hidden>
            <AlertTriangle size={17} />
          </span>
          <p style={{ margin: 0 }}>{mensaje}</p>
        </div>

        {error && (
          <div className="aviso aviso--peligro" role="alert">
            <span className="aviso__cuerpo">{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
