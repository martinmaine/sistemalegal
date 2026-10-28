import { useEffect, useMemo, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCatalogos, useCrearCausa, useEditarCausa } from '../../servicios/consultas';
import type { DatosEditarCausa } from '../../servicios/consultas';
import type { CausaDetalle } from '../../tipos/api';
import { useErroresFormulario } from '../../lib/formulario';
import { useAvisos } from '../../componentes/ui/Avisos';
import { Modal } from '../../componentes/ui/Modal';
import { Boton } from '../../componentes/ui/Boton';
import { CampoArea, CampoSelect, CampoTexto } from '../../componentes/ui/Campo';
import { Cargando } from '../../componentes/ui/Estados';

/**
 * Alta y edición de expediente, en un solo formulario.
 *
 * Son el mismo formulario a propósito: si fueran dos, cada campo que se agregue
 * habría que agregarlo dos veces, y tarde o temprano uno de los dos quedaría
 * atrás. La diferencia entre alta y edición es qué campos se ofrecen —cerrar
 * una causa solo tiene sentido sobre una que ya existe— y qué pasa al guardar.
 *
 * Pide lo mínimo para que la causa exista —carátula, fuero, estado y fecha— y
 * deja el resto detrás de "Más datos". Un formulario de quince campos para dar
 * de alta una causa es la forma más segura de que nadie la dé de alta.
 */

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  /** Presente: se edita ese expediente. Ausente: se crea uno nuevo. */
  causa?: CausaDetalle;
}

type Valores = Required<Omit<DatosEditarCausa, 'monto_reclamado'>> & { monto_reclamado: string };

const HOY = new Date().toISOString().slice(0, 10);

function vacios(): Valores {
  return {
    caratula: '',
    numero_expediente: '',
    fuero_id: '',
    estado_causa_id: '',
    tribunal_id: '',
    tipo_causa_id: '',
    fecha_inicio: HOY,
    fecha_cierre: '',
    monto_reclamado: '',
    moneda: 'ARS',
    observaciones: '',
  };
}

function desde(causa: CausaDetalle): Valores {
  return {
    caratula: causa.caratula,
    numero_expediente: causa.numero_expediente ?? '',
    fuero_id: causa.fuero_id,
    estado_causa_id: causa.estado_causa_id,
    tribunal_id: causa.tribunal_id ?? '',
    tipo_causa_id: causa.tipo_causa_id ?? '',
    fecha_inicio: causa.fecha_inicio,
    fecha_cierre: causa.fecha_cierre ?? '',
    // Viaja como texto porque la columna es NUMERIC y convertirla a number en
    // el camino perdería precisión en montos grandes.
    monto_reclamado: causa.monto_reclamado ?? '',
    moneda: causa.moneda,
    observaciones: causa.observaciones ?? '',
  };
}

export function DialogoExpediente({ abierto, alCerrar, causa }: Props) {
  const editando = Boolean(causa);
  const { data: catalogos, isPending: cargandoCatalogos } = useCatalogos();
  const crear = useCrearCausa();
  const editar = useEditarCausa(causa?.id ?? '');
  const guardando = crear.isPending || editar.isPending;

  const { avisar } = useAvisos();
  const navegar = useNavigate();
  const { errores, errorGeneral, limpiar, limpiarCampo, registrar } = useErroresFormulario();

  const [valores, setValores] = useState<Valores>(() => (causa ? desde(causa) : vacios()));
  // En edición se abre expandido: quien edita suele venir a cambiar justamente
  // uno de los campos de abajo —el tribunal, el cierre, el monto—.
  const [avanzado, setAvanzado] = useState(editando);

  // Al abrirse, el formulario vuelve a reflejar el expediente: si quedó a medio
  // editar de la vez anterior, esos valores ya no son los guardados.
  useEffect(() => {
    if (!abierto) return;
    setValores(causa ? desde(causa) : vacios());
    setAvanzado(Boolean(causa));
    limpiar();
  }, [abierto, causa, limpiar]);

  function cambiar<C extends keyof Valores>(campo: C, valor: Valores[C]) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    limpiarCampo(campo as string);
  }

  // Tribunales y tipos de causa dependen del fuero: ofrecer los de todos los
  // fueros obligaría al usuario a saber cuál corresponde.
  const tribunales = useMemo(
    () => (catalogos?.tribunales ?? []).filter((t) => !valores.fuero_id || t.fuero_id === valores.fuero_id),
    [catalogos, valores.fuero_id],
  );

  const tiposCausa = useMemo(
    () => (catalogos?.tiposCausa ?? []).filter((t) => !valores.fuero_id || t.fuero_id === valores.fuero_id),
    [catalogos, valores.fuero_id],
  );

  function cerrar() {
    limpiar();
    alCerrar();
  }

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    // Los opcionales vacíos no se mandan: el backend los trata como ausentes y
    // guarda NULL, que no es lo mismo que la cadena vacía.
    const datos: DatosEditarCausa = {
      caratula: valores.caratula,
      fuero_id: valores.fuero_id,
      estado_causa_id: valores.estado_causa_id,
      fecha_inicio: valores.fecha_inicio,
      numero_expediente: valores.numero_expediente || undefined,
      tribunal_id: valores.tribunal_id || undefined,
      tipo_causa_id: valores.tipo_causa_id || undefined,
      fecha_cierre: valores.fecha_cierre || undefined,
      monto_reclamado: valores.monto_reclamado ? Number(valores.monto_reclamado) : undefined,
      moneda: valores.moneda || 'ARS',
      observaciones: valores.observaciones || undefined,
    };

    try {
      if (causa) {
        await editar.mutateAsync(datos);
        avisar('Expediente guardado.');
        cerrar();
        return;
      }

      const creada = await crear.mutateAsync(datos);
      avisar('Expediente creado correctamente.');
      cerrar();
      // Se va directo al detalle: después de crear una causa, lo siguiente es
      // cargarle partes, plazos o documentos.
      navegar(`/expedientes/${creada.id}`);
    } catch (fallo) {
      registrar(fallo, 'No se pudo guardar el expediente. Revisá tu conexión e intentá de nuevo.');
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo={editando ? 'Editar expediente' : 'Nuevo expediente'}
      descripcion={
        editando
          ? 'Los cambios quedan registrados en la auditoría.'
          : 'Con la carátula, el fuero, el estado y la fecha alcanza para empezar.'
      }
      pie={
        <>
          <Boton onClick={cerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form="formulario-expediente" cargando={guardando}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear expediente'}
          </Boton>
        </>
      }
    >
      {cargandoCatalogos ? (
        <Cargando texto="Cargando fueros y tribunales…" />
      ) : (
        <form id="formulario-expediente" onSubmit={enviar} noValidate className="pila">
          {errorGeneral && (
            <div className="aviso aviso--peligro" role="alert">
              <span className="aviso__cuerpo">{errorGeneral}</span>
            </div>
          )}

          <CampoTexto
            etiqueta="Carátula"
            value={valores.caratula}
            onChange={(evento) => cambiar('caratula', evento.target.value)}
            placeholder="PÉREZ, JUAN c/ SEGUROS DEL SUR S.A. - ORDINARIO"
            ayuda="Tal como la registra el tribunal."
            error={errores.caratula?.[0]}
            obligatorio
            maxLength={300}
          />

          <div className="datos">
            <CampoSelect
              etiqueta="Fuero"
              value={valores.fuero_id}
              onChange={(evento) => {
                // Al cambiar el fuero, el tribunal y el tipo elegidos pueden
                // ya no pertenecer a él: se limpian en lugar de quedar mal.
                const fuero = evento.target.value;
                setValores((previos) => ({
                  ...previos,
                  fuero_id: fuero,
                  tribunal_id: '',
                  tipo_causa_id: '',
                }));
                limpiarCampo('fuero_id');
              }}
              opciones={(catalogos?.fueros ?? []).map((f) => ({ valor: f.id, texto: f.nombre }))}
              vacio="Elegí un fuero"
              error={errores.fuero_id?.[0]}
              obligatorio
            />

            <CampoSelect
              etiqueta="Estado"
              value={valores.estado_causa_id}
              onChange={(evento) => cambiar('estado_causa_id', evento.target.value)}
              opciones={(catalogos?.estados ?? []).map((e) => ({ valor: e.id, texto: e.nombre }))}
              vacio="Elegí un estado"
              error={errores.estado_causa_id?.[0]}
              obligatorio
            />

            <CampoTexto
              etiqueta="Fecha de inicio"
              type="date"
              value={valores.fecha_inicio}
              onChange={(evento) => cambiar('fecha_inicio', evento.target.value)}
              error={errores.fecha_inicio?.[0]}
              obligatorio
            />

            <CampoTexto
              etiqueta="Número de expediente"
              value={valores.numero_expediente}
              onChange={(evento) => cambiar('numero_expediente', evento.target.value)}
              placeholder="12345678"
              ayuda="Podés dejarlo vacío si todavía no está radicado."
              error={errores.numero_expediente?.[0]}
              maxLength={50}
            />
          </div>

          <div>
            <button
              type="button"
              className="boton boton--sutil boton--pequeno"
              onClick={() => setAvanzado((abierto) => !abierto)}
              aria-expanded={avanzado}
            >
              {avanzado ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
              Más datos
            </button>
          </div>

          {avanzado && (
            <>
              <div className="datos">
                <CampoSelect
                  etiqueta="Tribunal"
                  value={valores.tribunal_id}
                  onChange={(evento) => cambiar('tribunal_id', evento.target.value)}
                  opciones={tribunales.map((t) => ({ valor: t.id, texto: t.nombre }))}
                  vacio={valores.fuero_id ? 'Sin asignar' : 'Elegí primero un fuero'}
                  disabled={!valores.fuero_id}
                  error={errores.tribunal_id?.[0]}
                />

                <CampoSelect
                  etiqueta="Tipo de causa"
                  value={valores.tipo_causa_id}
                  onChange={(evento) => cambiar('tipo_causa_id', evento.target.value)}
                  opciones={tiposCausa.map((t) => ({ valor: t.id, texto: t.nombre }))}
                  vacio={valores.fuero_id ? 'Sin especificar' : 'Elegí primero un fuero'}
                  disabled={!valores.fuero_id}
                  error={errores.tipo_causa_id?.[0]}
                />

                {editando && (
                  <CampoTexto
                    etiqueta="Fecha de cierre"
                    type="date"
                    value={valores.fecha_cierre}
                    onChange={(evento) => cambiar('fecha_cierre', evento.target.value)}
                    ayuda="Dejala vacía mientras la causa siga abierta."
                    min={valores.fecha_inicio}
                    error={errores.fecha_cierre?.[0]}
                  />
                )}

                <CampoTexto
                  etiqueta="Monto reclamado"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={valores.monto_reclamado}
                  onChange={(evento) => cambiar('monto_reclamado', evento.target.value)}
                  placeholder="0,00"
                  ayuda={`En ${valores.moneda}.`}
                  error={errores.monto_reclamado?.[0]}
                />
              </div>

              <CampoArea
                etiqueta="Observaciones"
                value={valores.observaciones}
                onChange={(evento) => cambiar('observaciones', evento.target.value)}
                placeholder="Notas internas sobre el expediente."
                error={errores.observaciones?.[0]}
              />
            </>
          )}

          {!editando && (
            <p className="texto-pequeno texto-tenue">
              Quedás asignado como profesional titular del expediente. Podés cambiarlo después.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
