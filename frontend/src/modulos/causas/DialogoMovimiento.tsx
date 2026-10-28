import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { useRegistrarMovimiento } from '../../servicios/consultas';
import { useErroresFormulario } from '../../lib/formulario';
import { useAvisos } from '../../componentes/ui/Avisos';
import { Modal } from '../../componentes/ui/Modal';
import { Boton } from '../../componentes/ui/Boton';
import { CampoArea, CampoTexto } from '../../componentes/ui/Campo';

/**
 * Registro de un movimiento procesal.
 *
 * Tres campos, de los cuales uno es opcional: el historial del expediente se
 * carga a diario y a mano —el Poder Judicial de Córdoba no ofrece una API de
 * lectura— así que cada campo de más es una razón para no cargarlo.
 */

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  causaId: string;
  caratula: string;
}

const HOY = new Date().toISOString().slice(0, 10);

export function DialogoMovimiento({ abierto, alCerrar, causaId, caratula }: Props) {
  const registrarMovimiento = useRegistrarMovimiento(causaId);
  const { avisar } = useAvisos();
  const { errores, errorGeneral, limpiar, limpiarCampo, registrar } = useErroresFormulario();

  const [fecha, setFecha] = useState(HOY);
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');

  function cerrar() {
    limpiar();
    setFecha(HOY);
    setTipo('');
    setDescripcion('');
    alCerrar();
  }

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    try {
      await registrarMovimiento.mutateAsync({
        fecha,
        tipo: tipo || undefined,
        descripcion,
      });
      avisar('Movimiento registrado.');
      cerrar();
    } catch (fallo) {
      registrar(fallo, 'No se pudo registrar el movimiento. Revisá tu conexión e intentá de nuevo.');
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo="Registrar movimiento"
      descripcion={caratula}
      pie={
        <>
          <Boton onClick={cerrar} disabled={registrarMovimiento.isPending}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            type="submit"
            form="formulario-movimiento"
            cargando={registrarMovimiento.isPending}
          >
            Registrar
          </Boton>
        </>
      }
    >
      <form id="formulario-movimiento" onSubmit={enviar} noValidate className="pila">
        {errorGeneral && (
          <div className="aviso aviso--peligro" role="alert">
            <span className="aviso__cuerpo">{errorGeneral}</span>
          </div>
        )}

        <div className="datos">
          <CampoTexto
            etiqueta="Fecha"
            type="date"
            value={fecha}
            onChange={(evento) => {
              setFecha(evento.target.value);
              limpiarCampo('fecha');
            }}
            ayuda="La del movimiento en el expediente, no la de hoy."
            error={errores.fecha?.[0]}
            obligatorio
          />

          <CampoTexto
            etiqueta="Tipo"
            value={tipo}
            onChange={(evento) => {
              setTipo(evento.target.value);
              limpiarCampo('tipo');
            }}
            placeholder="Cédula, proveído, audiencia…"
            error={errores.tipo?.[0]}
            maxLength={100}
          />
        </div>

        <CampoArea
          etiqueta="Qué pasó"
          value={descripcion}
          onChange={(evento) => {
            setDescripcion(evento.target.value);
            limpiarCampo('descripcion');
          }}
          placeholder="Se notifica el traslado de la demanda."
          error={errores.descripcion?.[0]}
          obligatorio
        />
      </form>
    </Modal>
  );
}
