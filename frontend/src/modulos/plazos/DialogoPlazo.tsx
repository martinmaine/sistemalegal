import { useEffect, useMemo, useState } from 'react';
import type { SubmitEvent } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  useCatalogos,
  useCrearPlazo,
  useEditarPlazo,
  useSimularPlazo,
} from '../../servicios/consultas';
import type { DatosPlazo } from '../../servicios/consultas';
import type { PlazoDetalle, SimulacionPlazo } from '../../tipos/api';
import { useErroresFormulario } from '../../lib/formulario';
import { fecha as formatearFecha, fechaLarga } from '../../lib/formato';
import { useAvisos } from '../../componentes/ui/Avisos';
import { Modal } from '../../componentes/ui/Modal';
import { Boton } from '../../componentes/ui/Boton';
import { CampoArea, CampoSelect, CampoTexto } from '../../componentes/ui/Campo';
import { ExplicacionComputo } from './ExplicacionComputo';

/**
 * Alta y edición de un plazo procesal.
 *
 * Lo que distingue este formulario del resto: **muestra el vencimiento antes
 * de guardar**. En cuanto hay fecha de notificación, días y tipo de cómputo,
 * pide el cálculo al servidor y lo muestra con su explicación. Cargar un plazo
 * y descubrir después a qué día cayó sería pedirle al abogado que confíe sin
 * mirar, justo en el dato que más importa.
 *
 * El cálculo lo hace el servidor y no el navegador: el calendario de días
 * inhábiles vive en la base, y duplicar la lógica acá garantizaría que las dos
 * versiones se separen.
 */

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  causaId: string;
  caratula: string;
  /** Presente: se edita ese plazo. Ausente: se crea uno nuevo. */
  plazo?: PlazoDetalle;
}

type Valores = {
  descripcion: string;
  tipo_plazo_id: string;
  fecha_notificacion: string;
  fecha_inicio_computo: string;
  cantidad_dias: string;
  computo: 'HABIL' | 'CORRIDO';
  responsable_id: string;
  observaciones: string;
};

const HOY = new Date().toISOString().slice(0, 10);

function vacios(): Valores {
  return {
    descripcion: '',
    tipo_plazo_id: '',
    fecha_notificacion: HOY,
    fecha_inicio_computo: '',
    cantidad_dias: '',
    computo: 'HABIL',
    responsable_id: '',
    observaciones: '',
  };
}

function desde(plazo: PlazoDetalle): Valores {
  return {
    descripcion: plazo.descripcion,
    tipo_plazo_id: plazo.tipo_plazo_id ?? '',
    fecha_notificacion: plazo.fecha_notificacion,
    fecha_inicio_computo: plazo.fecha_inicio_computo,
    cantidad_dias: String(plazo.cantidad_dias),
    computo: plazo.computo === 'CORRIDO' ? 'CORRIDO' : 'HABIL',
    responsable_id: plazo.responsable_id ?? '',
    observaciones: plazo.observaciones ?? '',
  };
}

export function DialogoPlazo({ abierto, alCerrar, causaId, caratula, plazo }: Props) {
  const editando = Boolean(plazo);
  const { data: catalogos } = useCatalogos();

  const crear = useCrearPlazo(causaId);
  const editar = useEditarPlazo(plazo?.id ?? '', causaId);
  const simular = useSimularPlazo(causaId);
  const guardando = crear.isPending || editar.isPending;

  const { avisar } = useAvisos();
  const { errores, errorGeneral, limpiar, limpiarCampo, registrar } = useErroresFormulario();

  const [valores, setValores] = useState<Valores>(() => (plazo ? desde(plazo) : vacios()));
  const [vista, setVista] = useState<SimulacionPlazo>();
  const [errorVista, setErrorVista] = useState<string>();

  useEffect(() => {
    if (!abierto) return;
    setValores(plazo ? desde(plazo) : vacios());
    setVista(undefined);
    setErrorVista(undefined);
    limpiar();
  }, [abierto, plazo, limpiar]);

  function cambiar<C extends keyof Valores>(campo: C, valor: Valores[C]) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    limpiarCampo(campo as string);
  }

  /** Los tipos de plazo del fuero de la causa no están filtrados acá: el catálogo
      los trae todos y el estudio elige. Filtrar por fuero escondería reglas que
      a veces se aplican por analogía. */
  const tiposPlazo = catalogos?.tiposPlazo ?? [];

  /** Al elegir una regla del catálogo se precargan sus valores, que siguen siendo editables. */
  function elegirTipo(id: string) {
    const tipo = tiposPlazo.find((t) => t.id === id);
    setValores((previos) => ({
      ...previos,
      tipo_plazo_id: id,
      cantidad_dias: tipo ? String(tipo.cantidad_dias) : previos.cantidad_dias,
      computo: tipo ? (tipo.computo === 'CORRIDO' ? 'CORRIDO' : 'HABIL') : previos.computo,
      descripcion: previos.descripcion || (tipo?.nombre ?? ''),
    }));
    limpiarCampo('cantidad_dias');
  }

  // Los insumos del cálculo. Cuando están todos, se pide la previsualización.
  const insumos = useMemo(
    () => ({
      fecha_notificacion: valores.fecha_notificacion,
      fecha_inicio_computo: valores.fecha_inicio_computo || undefined,
      cantidad_dias: Number(valores.cantidad_dias),
      computo: valores.computo,
      tipo_plazo_id: valores.tipo_plazo_id || undefined,
    }),
    [valores.fecha_notificacion, valores.fecha_inicio_computo, valores.cantidad_dias, valores.computo, valores.tipo_plazo_id],
  );

  const listoParaCalcular =
    Boolean(insumos.fecha_notificacion) && Number.isInteger(insumos.cantidad_dias) && insumos.cantidad_dias > 0;

  // Se recalcula con un retardo corto: sin él, cada tecla del campo de días
  // dispararía una petición.
  useEffect(() => {
    if (!abierto || !listoParaCalcular) {
      setVista(undefined);
      setErrorVista(undefined);
      return;
    }

    const reloj = setTimeout(() => {
      simular
        .mutateAsync(insumos)
        .then((resultado) => {
          setVista(resultado);
          setErrorVista(undefined);
        })
        .catch((fallo: unknown) => {
          setVista(undefined);
          setErrorVista(
            fallo instanceof Error ? fallo.message : 'No se pudo calcular el vencimiento.',
          );
        });
    }, 400);

    return () => clearTimeout(reloj);
    // `simular` es estable entre renders de la misma mutación; incluirlo
    // reiniciaría el retardo en cada ciclo y la petición no saldría nunca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, listoParaCalcular, insumos]);

  function cerrar() {
    limpiar();
    alCerrar();
  }

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    const datos: DatosPlazo = {
      descripcion: valores.descripcion,
      tipo_plazo_id: valores.tipo_plazo_id || undefined,
      fecha_notificacion: valores.fecha_notificacion,
      fecha_inicio_computo: valores.fecha_inicio_computo || undefined,
      cantidad_dias: Number(valores.cantidad_dias),
      computo: valores.computo,
      responsable_id: valores.responsable_id || undefined,
      observaciones: valores.observaciones || undefined,
    };

    try {
      if (plazo) {
        await editar.mutateAsync(datos);
        avisar('Plazo guardado.');
      } else {
        const creado = await crear.mutateAsync(datos);
        avisar(`Plazo cargado: vence el ${formatearFecha(creado.fecha_vencimiento)}.`);
      }
      cerrar();
    } catch (fallo) {
      registrar(fallo, 'No se pudo guardar el plazo. Revisá tu conexión e intentá de nuevo.');
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo={editando ? 'Editar plazo' : 'Nuevo plazo'}
      descripcion={caratula}
      ancho
      pie={
        <>
          <Boton onClick={cerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            type="submit"
            form="formulario-plazo"
            cargando={guardando}
            disabled={!vista}
          >
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Cargar plazo'}
          </Boton>
        </>
      }
    >
      <form id="formulario-plazo" onSubmit={enviar} noValidate className="pila">
        {errorGeneral && (
          <div className="aviso aviso--peligro" role="alert">
            <span className="aviso__cuerpo">{errorGeneral}</span>
          </div>
        )}

        <CampoSelect
          etiqueta="Tipo de plazo"
          value={valores.tipo_plazo_id}
          onChange={(evento) => elegirTipo(evento.target.value)}
          opciones={tiposPlazo.map((tipo) => ({
            valor: tipo.id,
            texto: `${tipo.nombre} — ${tipo.cantidad_dias} días ${
              tipo.computo === 'HABIL' ? 'hábiles' : 'corridos'
            }`,
          }))}
          vacio="Plazo a medida (sin regla del catálogo)"
          ayuda="Precarga los días y el tipo de cómputo. Podés cambiarlos después."
          error={errores.tipo_plazo_id?.[0]}
        />

        <CampoTexto
          etiqueta="Qué hay que hacer"
          value={valores.descripcion}
          onChange={(evento) => cambiar('descripcion', evento.target.value)}
          placeholder="Contestar la demanda"
          ayuda="Es lo que vas a leer en la agenda cuando se acerque el vencimiento."
          error={errores.descripcion?.[0]}
          obligatorio
          maxLength={300}
        />

        <div className="datos">
          <CampoTexto
            etiqueta="Fecha de notificación"
            type="date"
            value={valores.fecha_notificacion}
            onChange={(evento) => cambiar('fecha_notificacion', evento.target.value)}
            ayuda="El día de la notificación no se cuenta."
            error={errores.fecha_notificacion?.[0]}
            obligatorio
          />

          <CampoTexto
            etiqueta="Cantidad de días"
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            value={valores.cantidad_dias}
            onChange={(evento) => cambiar('cantidad_dias', evento.target.value)}
            placeholder="10"
            error={errores.cantidad_dias?.[0]}
            obligatorio
          />

          <CampoSelect
            etiqueta="Cómputo"
            value={valores.computo}
            onChange={(evento) => cambiar('computo', evento.target.value as Valores['computo'])}
            opciones={[
              { valor: 'HABIL', texto: 'Días hábiles' },
              { valor: 'CORRIDO', texto: 'Días corridos' },
            ]}
            ayuda={
              valores.computo === 'HABIL'
                ? 'Descuenta fines de semana, feriados y feria.'
                : 'Cuenta todos los días del calendario.'
            }
            error={errores.computo?.[0]}
            obligatorio
          />

          <CampoSelect
            etiqueta="Responsable"
            value={valores.responsable_id}
            onChange={(evento) => cambiar('responsable_id', evento.target.value)}
            opciones={(catalogos?.profesionales ?? []).map((p) => ({
              valor: p.id,
              texto: p.nombre,
            }))}
            vacio="Sin asignar"
            error={errores.responsable_id?.[0]}
          />
        </div>

        <CampoTexto
          etiqueta="El cómputo arranca el"
          type="date"
          value={valores.fecha_inicio_computo}
          onChange={(evento) => cambiar('fecha_inicio_computo', evento.target.value)}
          min={valores.fecha_notificacion}
          ayuda="Dejalo vacío para que arranque el día hábil siguiente a la notificación, que es la regla general."
          error={errores.fecha_inicio_computo?.[0]}
        />

        {/* El resultado, antes de guardar. */}
        <section className="previsualizacion" aria-live="polite">
          {!listoParaCalcular && (
            <p className="previsualizacion__espera">
              Completá la fecha de notificación y la cantidad de días para ver cuándo vence.
            </p>
          )}

          {listoParaCalcular && errorVista && (
            <div className="aviso aviso--peligro" role="alert">
              <span className="aviso__cuerpo">{errorVista}</span>
            </div>
          )}

          {listoParaCalcular && !errorVista && !vista && (
            <p className="previsualizacion__espera">Calculando el vencimiento…</p>
          )}

          {vista && (
            <>
              <p className="previsualizacion__titular">
                <CalendarClock size={18} aria-hidden />
                Vence el <strong>{fechaLarga(vista.fecha_vencimiento)}</strong>
              </p>
              <ExplicacionComputo explicacion={vista.explicacion} dias={vista.dias} />
            </>
          )}
        </section>

        <CampoArea
          etiqueta="Observaciones"
          value={valores.observaciones}
          onChange={(evento) => cambiar('observaciones', evento.target.value)}
          placeholder="Notas internas sobre este plazo."
          error={errores.observaciones?.[0]}
        />
      </form>
    </Modal>
  );
}
