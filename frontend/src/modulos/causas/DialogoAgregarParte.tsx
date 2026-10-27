import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { useAgregarParte, usePersonas } from '../../servicios/consultas';
import type { ParteCausa, PersonaDetalle, PersonaListada } from '../../tipos/api';
import { CARACTERES_PARTE } from '../../lib/vocabulario';
import { useErroresFormulario } from '../../lib/formulario';
import { useSesion } from '../auth/ContextoSesion';
import { useAvisos } from '../../componentes/ui/Avisos';
import { Modal } from '../../componentes/ui/Modal';
import { Boton } from '../../componentes/ui/Boton';
import { Buscador } from '../../componentes/ui/Buscador';
import { CampoCasilla, CampoSelect, CampoTexto } from '../../componentes/ui/Campo';
import { Etiqueta } from '../../componentes/ui/Etiqueta';
import { EsqueletoLista, Vacio } from '../../componentes/ui/Estados';
import { Dato } from '../../componentes/ui/Tabla';
import { DialogoPersona } from '../personas/DialogoPersona';

/**
 * Vincula una persona de la agenda al expediente.
 *
 * La persona se elige, no se escribe: la agenda es una entidad reutilizable y
 * tipear el nombre otra vez crearía duplicados —la misma contraria cargada
 * tres veces con tres grafías—. El paso es: buscar, elegir, decir con qué
 * carácter interviene.
 *
 * Si no está en la agenda, se la crea desde acá sin perder el expediente de
 * vista: al guardarla queda seleccionada y el formulario sigue donde estaba.
 */

interface Props {
  /** Siempre true: el padre monta el diálogo recién cuando se abre. */
  abierto: boolean;
  alCerrar: () => void;
  causaId: string;
  /** Carátula del expediente, para que el diálogo diga sobre qué está operando. */
  caratula: string;
  /** Ya vinculadas: se marcan en la lista para no intentar agregarlas dos veces. */
  yaEnLaCausa: ParteCausa[];
}

export function DialogoAgregarParte({ abierto, alCerrar, causaId, caratula, yaEnLaCausa }: Props) {
  const agregar = useAgregarParte(causaId);
  const { avisar } = useAvisos();
  const { puede } = useSesion();
  const { errores, errorGeneral, limpiar, limpiarCampo, registrar } = useErroresFormulario();

  const [busqueda, setBusqueda] = useState('');
  const [elegida, setElegida] = useState<PersonaListada | PersonaDetalle>();
  const [caracter, setCaracter] = useState('');
  const [esCliente, setEsCliente] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [altaAbierta, setAltaAbierta] = useState(false);

  // El diálogo se monta recién cuando se abre (ver PaginaExpediente), así que
  // esta consulta no corre mientras está cerrado.
  const personas = usePersonas({ pagina: 1, tamano: 8, busqueda: busqueda || undefined });

  useEffect(() => {
    if (abierto) return;
    // Al cerrarse se olvida todo: reabrirlo con la selección anterior haría
    // agregar una parte que no se quería.
    setBusqueda('');
    setElegida(undefined);
    setCaracter('');
    setEsCliente(false);
    setObservaciones('');
    limpiar();
  }, [abierto, limpiar]);

  function cerrar() {
    limpiar();
    alCerrar();
  }

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    if (!elegida) return;

    try {
      await agregar.mutateAsync({
        persona_id: elegida.id,
        caracter,
        es_cliente: esCliente,
        observaciones: observaciones.trim() || undefined,
      });

      avisar(`${elegida.nombre_completo} quedó vinculada al expediente.`);
      cerrar();
    } catch (fallo) {
      registrar(fallo, 'No se pudo vincular la parte. Revisá tu conexión e intentá de nuevo.');
    }
  }

  const caracteresTomados = new Set(
    yaEnLaCausa.filter((parte) => parte.persona_id === elegida?.id).map((parte) => parte.caracter),
  );

  return (
    <>
      <Modal
        abierto={abierto && !altaAbierta}
        alCerrar={cerrar}
        titulo="Agregar parte al expediente"
        descripcion={caratula}
        pie={
          <>
            <Boton onClick={cerrar} disabled={agregar.isPending}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              type="submit"
              form="formulario-parte"
              cargando={agregar.isPending}
              // Sin persona o sin carácter no hay nada que guardar: el botón
              // deshabilitado dice que falta algo antes de intentarlo.
              disabled={!elegida || !caracter}
            >
              {agregar.isPending ? 'Vinculando…' : 'Vincular al expediente'}
            </Boton>
          </>
        }
      >
        <form id="formulario-parte" onSubmit={enviar} noValidate className="pila">
          {errorGeneral && (
            <div className="aviso aviso--peligro" role="alert">
              <span className="aviso__cuerpo">{errorGeneral}</span>
            </div>
          )}

          {elegida ? (
            <div className="seleccionado">
              <span className="seleccionado__cuerpo">
                <span className="seleccionado__nombre">{elegida.nombre_completo}</span>
                <span className="texto-pequeno texto-tenue">
                  {elegida.tipo_persona === 'JURIDICA' ? 'Persona jurídica' : 'Persona física'}
                  {elegida.documento && ` · ${elegida.documento}`}
                </span>
              </span>
              <button
                type="button"
                className="boton boton--sutil boton--pequeno"
                onClick={() => {
                  setElegida(undefined);
                  setCaracter('');
                }}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="pila">
              <div>
                <p className="campo__etiqueta" id="titulo-busqueda-parte">
                  ¿Quién interviene?
                </p>
                <Buscador
                  valor={busqueda}
                  alCambiar={setBusqueda}
                  etiqueta="Buscar en la agenda del estudio"
                  marcador="Buscar por nombre, documento o CUIT…"
                  autoFoco
                />
              </div>

              {personas.isPending && <EsqueletoLista />}

              {personas.data?.datos.length === 0 && (
                <Vacio
                  titulo="No encontramos a nadie"
                  texto={
                    busqueda
                      ? 'Probá con otro dato, o agregá la persona a la agenda.'
                      : 'La agenda está vacía. Agregá la primera persona.'
                  }
                  icono={<Users size={20} aria-hidden />}
                />
              )}

              {personas.data && personas.data.datos.length > 0 && (
                <ul className="lista lista--encuadrada" aria-labelledby="titulo-busqueda-parte">
                  {personas.data.datos.map((persona) => {
                    const vinculada = yaEnLaCausa.some((parte) => parte.persona_id === persona.id);

                    return (
                      <li key={persona.id}>
                        <button
                          type="button"
                          className="lista__item lista__item--boton"
                          onClick={() => {
                            setElegida(persona);
                            limpiarCampo('persona_id');
                          }}
                        >
                          <span className="lista__cuerpo">
                            <span className="lista__titulo">{persona.nombre_completo}</span>
                            <span className="lista__meta">
                              <Dato>{persona.documento ?? persona.cuit_cuil}</Dato>
                            </span>
                          </span>
                          <span className="lista__lateral">
                            {vinculada && (
                              <Etiqueta tono="info" title="Ya figura en este expediente">
                                Ya vinculada
                              </Etiqueta>
                            )}
                            {persona.es_cliente && <Etiqueta tono="marca">Cliente</Etiqueta>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {personas.data && personas.data.total > personas.data.datos.length && (
                <p className="texto-pequeno texto-tenue">
                  Se muestran {personas.data.datos.length} de {personas.data.total}. Afiná la búsqueda
                  para ver el resto.
                </p>
              )}

              {puede('persona.crear') && (
                <div>
                  <button
                    type="button"
                    className="boton boton--sutil boton--pequeno"
                    onClick={() => setAltaAbierta(true)}
                  >
                    <UserPlus size={15} aria-hidden />
                    No está en la agenda, agregarla
                  </button>
                </div>
              )}
            </div>
          )}

          {errores.persona_id?.[0] && (
            <p className="campo__error">{errores.persona_id[0]}</p>
          )}

          {elegida && (
            <>
              <CampoSelect
                etiqueta="Carácter con que interviene"
                value={caracter}
                onChange={(evento) => {
                  setCaracter(evento.target.value);
                  limpiarCampo('caracter');
                }}
                opciones={CARACTERES_PARTE.map((opcion) => ({
                  valor: opcion.valor,
                  // Un carácter ya usado por esta persona en esta causa se
                  // marca en el texto: el backend lo rechaza y conviene
                  // avisarlo antes de intentarlo.
                  texto: caracteresTomados.has(opcion.valor)
                    ? `${opcion.texto} (ya registrado)`
                    : opcion.texto,
                }))}
                vacio="Elegí el carácter"
                error={errores.caracter?.[0]}
                obligatorio
              />

              <CampoCasilla
                etiqueta="Es el cliente del estudio en este expediente"
                ayuda="El estudio puede representar al actor en una causa y al demandado en otra, así que esto se define por expediente."
                checked={esCliente}
                onChange={(evento) => setEsCliente(evento.target.checked)}
              />

              <CampoTexto
                etiqueta="Observaciones"
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                placeholder="Domicilio constituido, apoderado, etc."
                error={errores.observaciones?.[0]}
                maxLength={300}
              />
            </>
          )}
        </form>
      </Modal>

      {/* El alta queda seleccionada al volver: el usuario no tiene que buscarla. */}
      <DialogoPersona
        abierto={altaAbierta}
        alCerrar={() => setAltaAbierta(false)}
        alGuardar={(persona) => {
          setElegida(persona);
          setAltaAbierta(false);
        }}
      />
    </>
  );
}
