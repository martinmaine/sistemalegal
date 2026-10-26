import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ErrorApi } from '../../servicios/api';
import { useCatalogos, useCrearCausa } from '../../servicios/consultas';
import type { DatosNuevaCausa } from '../../servicios/consultas';
import { useAvisos } from '../../componentes/ui/Avisos';
import { Modal } from '../../componentes/ui/Modal';
import { Boton } from '../../componentes/ui/Boton';
import { CampoArea, CampoSelect, CampoTexto } from '../../componentes/ui/Campo';
import { Cargando } from '../../componentes/ui/Estados';

/**
 * Alta de expediente.
 *
 * Pide lo mínimo para que la causa exista —carátula, fuero, estado y fecha— y
 * deja el resto detrás de "Más datos". Un formulario de quince campos para dar
 * de alta una causa es la forma más segura de que nadie la dé de alta.
 *
 * Los errores por campo los devuelve el backend con el mismo nombre que el
 * formulario, así que se vuelcan directamente bajo cada control.
 */

interface Props {
  abierto: boolean;
  alCerrar: () => void;
}

const HOY = new Date().toISOString().slice(0, 10);

export function DialogoNuevoExpediente({ abierto, alCerrar }: Props) {
  const { data: catalogos, isPending: cargandoCatalogos } = useCatalogos();
  const crear = useCrearCausa();
  const { avisar } = useAvisos();
  const navegar = useNavigate();

  const [valores, setValores] = useState<DatosNuevaCausa>({
    caratula: '',
    numero_expediente: '',
    fuero_id: '',
    estado_causa_id: '',
    tribunal_id: '',
    tipo_causa_id: '',
    fecha_inicio: HOY,
    observaciones: '',
  });
  const [avanzado, setAvanzado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string>();

  function cambiar<C extends keyof DatosNuevaCausa>(campo: C, valor: DatosNuevaCausa[C]) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    // El error del campo se borra en cuanto el usuario lo toca: dejarlo rojo
    // mientras lo está corrigiendo es ruido.
    setErrores((previos) => {
      if (!previos[campo as string]) return previos;
      const siguiente = { ...previos };
      delete siguiente[campo as string];
      return siguiente;
    });
  }

  // Tribunales y tipos de causa dependen del fuero: ofrecer los 7 tribunales
  // de todos los fueros obligaría al usuario a saber cuál corresponde.
  const tribunales = useMemo(
    () => (catalogos?.tribunales ?? []).filter((t) => !valores.fuero_id || t.fuero_id === valores.fuero_id),
    [catalogos, valores.fuero_id],
  );

  const tiposCausa = useMemo(
    () => (catalogos?.tiposCausa ?? []).filter((t) => !valores.fuero_id || t.fuero_id === valores.fuero_id),
    [catalogos, valores.fuero_id],
  );

  function cerrar() {
    setErrores({});
    setErrorGeneral(undefined);
    alCerrar();
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrores({});
    setErrorGeneral(undefined);

    try {
      const creada = await crear.mutateAsync({
        ...valores,
        // Los opcionales vacíos no se mandan: el backend los trata como ausentes.
        numero_expediente: valores.numero_expediente || undefined,
        tribunal_id: valores.tribunal_id || undefined,
        tipo_causa_id: valores.tipo_causa_id || undefined,
        observaciones: valores.observaciones || undefined,
      });

      avisar('Expediente creado correctamente.');
      cerrar();
      // Se va directo al detalle: después de crear una causa, lo siguiente es
      // cargarle partes, plazos o documentos.
      navegar(`/expedientes/${creada.id}`);
    } catch (fallo) {
      if (fallo instanceof ErrorApi) {
        setErrores(fallo.detalles ?? {});
        // Si el error no apunta a un campo, se muestra arriba del formulario.
        if (!fallo.detalles) setErrorGeneral(fallo.message);
      } else {
        setErrorGeneral('No se pudo guardar el expediente. Revisá tu conexión e intentá de nuevo.');
      }
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo="Nuevo expediente"
      descripcion="Con la carátula, el fuero, el estado y la fecha alcanza para empezar."
      pie={
        <>
          <Boton onClick={cerrar} disabled={crear.isPending}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form="formulario-expediente" cargando={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Crear expediente'}
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
                cambiar('fuero_id', evento.target.value);
                setValores((previos) => ({ ...previos, tribunal_id: '', tipo_causa_id: '' }));
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
              value={valores.numero_expediente ?? ''}
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
                  value={valores.tribunal_id ?? ''}
                  onChange={(evento) => cambiar('tribunal_id', evento.target.value)}
                  opciones={tribunales.map((t) => ({ valor: t.id, texto: t.nombre }))}
                  vacio={valores.fuero_id ? 'Sin asignar' : 'Elegí primero un fuero'}
                  disabled={!valores.fuero_id}
                  error={errores.tribunal_id?.[0]}
                />

                <CampoSelect
                  etiqueta="Tipo de causa"
                  value={valores.tipo_causa_id ?? ''}
                  onChange={(evento) => cambiar('tipo_causa_id', evento.target.value)}
                  opciones={tiposCausa.map((t) => ({ valor: t.id, texto: t.nombre }))}
                  vacio={valores.fuero_id ? 'Sin especificar' : 'Elegí primero un fuero'}
                  disabled={!valores.fuero_id}
                  error={errores.tipo_causa_id?.[0]}
                />
              </div>

              <CampoArea
                etiqueta="Observaciones"
                value={valores.observaciones ?? ''}
                onChange={(evento) => cambiar('observaciones', evento.target.value)}
                placeholder="Notas internas sobre el expediente."
                error={errores.observaciones?.[0]}
              />
            </>
          )}

          <p className="texto-pequeno texto-tenue">
            Quedás asignado como profesional titular del expediente. Podés cambiarlo después.
          </p>
        </form>
      )}
    </Modal>
  );
}
