import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCrearPersona, useEditarPersona } from '../../servicios/consultas';
import type { DatosPersona } from '../../servicios/consultas';
import type { PersonaDetalle } from '../../tipos/api';
import { TIPOS_DOCUMENTO, TIPOS_PERSONA } from '../../lib/vocabulario';
import { useErroresFormulario } from '../../lib/formulario';
import { useAvisos } from '../../componentes/ui/Avisos';
import { Modal } from '../../componentes/ui/Modal';
import { Boton } from '../../componentes/ui/Boton';
import { CampoArea, CampoSelect, CampoTexto } from '../../componentes/ui/Campo';

/**
 * Alta y edición de una persona de la agenda.
 *
 * El formulario cambia con el tipo: una persona física tiene nombre y
 * apellido, una jurídica tiene razón social. Mostrar los tres campos a la vez
 * y dejar que el usuario adivine cuáles llenar es la forma de conseguir fichas
 * a medio cargar, así que se muestra solo lo que corresponde.
 *
 * Lo obligatorio es el tipo y la identificación. Documento, contacto y
 * domicilio quedan detrás de "Más datos": para anotar a una contraria de la
 * que solo se sabe el nombre no hace falta nada más.
 */

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  /** Presente: se edita esa persona. Ausente: se crea una nueva. */
  persona?: PersonaDetalle;
  /** Se llama con la persona guardada. Permite vincularla sin volver a buscarla. */
  alGuardar?: (persona: PersonaDetalle) => void;
}

type Valores = Required<DatosPersona>;

function vacios(): Valores {
  return {
    tipo_persona: 'FISICA',
    nombre: '',
    apellido: '',
    razon_social: '',
    tipo_documento: '',
    numero_documento: '',
    cuit_cuil: '',
    email: '',
    telefono: '',
    domicilio: '',
    localidad: '',
    provincia: '',
    observaciones: '',
  };
}

function desde(persona: PersonaDetalle): Valores {
  return {
    tipo_persona: persona.tipo_persona === 'JURIDICA' ? 'JURIDICA' : 'FISICA',
    nombre: persona.nombre ?? '',
    apellido: persona.apellido ?? '',
    razon_social: persona.razon_social ?? '',
    tipo_documento: persona.tipo_documento ?? '',
    numero_documento: persona.numero_documento ?? '',
    cuit_cuil: persona.cuit_cuil ?? '',
    email: persona.email ?? '',
    telefono: persona.telefono ?? '',
    domicilio: persona.domicilio ?? '',
    localidad: persona.localidad ?? '',
    provincia: persona.provincia ?? '',
    observaciones: persona.observaciones ?? '',
  };
}

/** Quita los opcionales vacíos: el backend los trata como ausentes y guarda NULL. */
function aEnviar(valores: Valores): DatosPersona {
  const datos: DatosPersona = { tipo_persona: valores.tipo_persona };

  const campos = [
    'nombre',
    'apellido',
    'razon_social',
    'tipo_documento',
    'numero_documento',
    'cuit_cuil',
    'email',
    'telefono',
    'domicilio',
    'localidad',
    'provincia',
    'observaciones',
  ] as const;

  for (const campo of campos) {
    const valor = valores[campo].trim();
    if (valor) datos[campo] = valor;
  }

  return datos;
}

export function DialogoPersona({ abierto, alCerrar, persona, alGuardar }: Props) {
  const editando = Boolean(persona);
  const crear = useCrearPersona();
  const editar = useEditarPersona(persona?.id ?? '');
  const guardando = crear.isPending || editar.isPending;

  const { avisar } = useAvisos();
  const { errores, errorGeneral, limpiar, limpiarCampo, registrar } = useErroresFormulario();

  const [valores, setValores] = useState<Valores>(() => (persona ? desde(persona) : vacios()));
  const [avanzado, setAvanzado] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setValores(persona ? desde(persona) : vacios());
    // En edición conviene ver todo: casi siempre se abre para completar un
    // teléfono o un domicilio que faltaba.
    setAvanzado(Boolean(persona));
    limpiar();
  }, [abierto, persona, limpiar]);

  function cambiar<C extends keyof Valores>(campo: C, valor: Valores[C]) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    limpiarCampo(campo as string);
  }

  function cerrar() {
    limpiar();
    alCerrar();
  }

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    try {
      const guardada = persona
        ? await editar.mutateAsync(aEnviar(valores))
        : await crear.mutateAsync(aEnviar(valores));

      avisar(editando ? 'Ficha guardada.' : 'Persona agregada a la agenda.');
      cerrar();
      alGuardar?.(guardada);
    } catch (fallo) {
      registrar(fallo, 'No se pudo guardar la ficha. Revisá tu conexión e intentá de nuevo.');
    }
  }

  const esJuridica = valores.tipo_persona === 'JURIDICA';

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo={editando ? 'Editar ficha' : 'Nueva persona'}
      descripcion={
        editando
          ? 'Los cambios se reflejan en todos los expedientes donde interviene.'
          : 'Queda en la agenda del estudio y se puede vincular a cualquier expediente.'
      }
      pie={
        <>
          <Boton onClick={cerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form="formulario-persona" cargando={guardando}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar a la agenda'}
          </Boton>
        </>
      }
    >
      <form id="formulario-persona" onSubmit={enviar} noValidate className="pila">
        {errorGeneral && (
          <div className="aviso aviso--peligro" role="alert">
            <span className="aviso__cuerpo">{errorGeneral}</span>
          </div>
        )}

        <CampoSelect
          etiqueta="Tipo"
          value={valores.tipo_persona}
          onChange={(evento) => cambiar('tipo_persona', evento.target.value as Valores['tipo_persona'])}
          opciones={TIPOS_PERSONA.map((t) => ({ valor: t.valor, texto: t.texto }))}
          ayuda="Determina si se pide nombre y apellido o razón social."
          error={errores.tipo_persona?.[0]}
          obligatorio
        />

        {esJuridica ? (
          <CampoTexto
            etiqueta="Razón social"
            value={valores.razon_social}
            onChange={(evento) => cambiar('razon_social', evento.target.value)}
            placeholder="Seguros del Sur S.A."
            error={errores.razon_social?.[0]}
            obligatorio
            maxLength={150}
          />
        ) : (
          <div className="datos">
            <CampoTexto
              etiqueta="Apellido"
              value={valores.apellido}
              onChange={(evento) => cambiar('apellido', evento.target.value)}
              placeholder="Pérez"
              error={errores.apellido?.[0]}
              obligatorio
              maxLength={80}
            />

            <CampoTexto
              etiqueta="Nombre"
              value={valores.nombre}
              onChange={(evento) => cambiar('nombre', evento.target.value)}
              placeholder="Juan"
              error={errores.nombre?.[0]}
              obligatorio
              maxLength={80}
            />
          </div>
        )}

        <div>
          <button
            type="button"
            className="boton boton--sutil boton--pequeno"
            onClick={() => setAvanzado((abierto) => !abierto)}
            aria-expanded={avanzado}
          >
            {avanzado ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
            Documento, contacto y domicilio
          </button>
        </div>

        {avanzado && (
          <>
            <div className="datos">
              <CampoSelect
                etiqueta="Tipo de documento"
                value={valores.tipo_documento}
                onChange={(evento) => cambiar('tipo_documento', evento.target.value)}
                opciones={TIPOS_DOCUMENTO.map((t) => ({ valor: t.valor, texto: t.texto }))}
                vacio="Sin especificar"
                error={errores.tipo_documento?.[0]}
              />

              <CampoTexto
                etiqueta="Número de documento"
                value={valores.numero_documento}
                onChange={(evento) => cambiar('numero_documento', evento.target.value)}
                placeholder="20123456"
                error={errores.numero_documento?.[0]}
                maxLength={20}
              />

              <CampoTexto
                etiqueta="CUIT / CUIL"
                value={valores.cuit_cuil}
                onChange={(evento) => cambiar('cuit_cuil', evento.target.value)}
                placeholder="20-20123456-3"
                ayuda="Con o sin guiones."
                error={errores.cuit_cuil?.[0]}
                maxLength={13}
              />

              <CampoTexto
                etiqueta="Correo electrónico"
                type="email"
                value={valores.email}
                onChange={(evento) => cambiar('email', evento.target.value)}
                placeholder="nombre@ejemplo.com"
                error={errores.email?.[0]}
                maxLength={150}
              />

              <CampoTexto
                etiqueta="Teléfono"
                type="tel"
                value={valores.telefono}
                onChange={(evento) => cambiar('telefono', evento.target.value)}
                placeholder="351 555 0000"
                error={errores.telefono?.[0]}
                maxLength={30}
              />

              <CampoTexto
                etiqueta="Domicilio"
                value={valores.domicilio}
                onChange={(evento) => cambiar('domicilio', evento.target.value)}
                placeholder="Av. Colón 1234, Piso 3"
                error={errores.domicilio?.[0]}
                maxLength={200}
              />

              <CampoTexto
                etiqueta="Localidad"
                value={valores.localidad}
                onChange={(evento) => cambiar('localidad', evento.target.value)}
                placeholder="Córdoba"
                error={errores.localidad?.[0]}
                maxLength={100}
              />

              <CampoTexto
                etiqueta="Provincia"
                value={valores.provincia}
                onChange={(evento) => cambiar('provincia', evento.target.value)}
                placeholder="Córdoba"
                error={errores.provincia?.[0]}
                maxLength={100}
              />
            </div>

            <CampoArea
              etiqueta="Observaciones"
              value={valores.observaciones}
              onChange={(evento) => cambiar('observaciones', evento.target.value)}
              placeholder="Notas internas sobre esta persona."
              error={errores.observaciones?.[0]}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
