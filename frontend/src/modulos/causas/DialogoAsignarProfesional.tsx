import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useAsignarProfesional, useCatalogos } from '../../servicios/consultas';
import type { ProfesionalCausa } from '../../tipos/api';
import { ROLES_PROFESIONAL } from '../../lib/vocabulario';
import { useErroresFormulario } from '../../lib/formulario';
import { useAvisos } from '../../componentes/ui/Avisos';
import { Modal } from '../../componentes/ui/Modal';
import { Boton } from '../../componentes/ui/Boton';
import { CampoSelect } from '../../componentes/ui/Campo';
import { Cargando } from '../../componentes/ui/Estados';

/**
 * Asigna un integrante del estudio al expediente.
 *
 * El desplegable ofrece solo a quien no esté ya asignado: dejar a los demás en
 * la lista para que el servidor los rechace después es hacer trabajar al
 * usuario para llegar a un error previsible.
 *
 * El rol importa: el titular es quien figura como responsable en el listado y
 * a quien se le notifican los vencimientos.
 */

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  causaId: string;
  caratula: string;
  /** Los ya asignados, para no volver a ofrecerlos. */
  yaAsignados: ProfesionalCausa[];
}

export function DialogoAsignarProfesional({
  abierto,
  alCerrar,
  causaId,
  caratula,
  yaAsignados,
}: Props) {
  const { data: catalogos, isPending: cargandoCatalogos } = useCatalogos();
  const asignar = useAsignarProfesional(causaId);
  const { avisar } = useAvisos();
  const { errores, errorGeneral, limpiar, limpiarCampo, registrar } = useErroresFormulario();

  const [usuarioId, setUsuarioId] = useState('');
  const [rol, setRol] = useState('COLABORADOR');

  useEffect(() => {
    if (abierto) return;
    setUsuarioId('');
    setRol('COLABORADOR');
    limpiar();
  }, [abierto, limpiar]);

  const asignadosIds = new Set(yaAsignados.map((profesional) => profesional.usuario_id));
  const disponibles = (catalogos?.profesionales ?? []).filter(
    (profesional) => !asignadosIds.has(profesional.id),
  );

  function cerrar() {
    limpiar();
    alCerrar();
  }

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    limpiar();

    try {
      const asignado = await asignar.mutateAsync({ usuario_id: usuarioId, rol_en_causa: rol });
      avisar(`${asignado.nombre_completo} quedó asignado al expediente.`);
      cerrar();
    } catch (fallo) {
      registrar(fallo, 'No se pudo asignar. Revisá tu conexión e intentá de nuevo.');
    }
  }

  const hayTitular = yaAsignados.some((profesional) => profesional.rol_en_causa === 'TITULAR');

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo="Asignar al expediente"
      descripcion={caratula}
      pie={
        <>
          <Boton onClick={cerrar} disabled={asignar.isPending}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            type="submit"
            form="formulario-profesional"
            cargando={asignar.isPending}
            disabled={!usuarioId || disponibles.length === 0}
          >
            {asignar.isPending ? 'Asignando…' : 'Asignar'}
          </Boton>
        </>
      }
    >
      {cargandoCatalogos ? (
        <Cargando texto="Cargando integrantes del estudio…" />
      ) : (
        <form id="formulario-profesional" onSubmit={enviar} noValidate className="pila">
          {errorGeneral && (
            <div className="aviso aviso--peligro" role="alert">
              <span className="aviso__cuerpo">{errorGeneral}</span>
            </div>
          )}

          {disponibles.length === 0 ? (
            <div className="aviso aviso--info">
              <span className="aviso__cuerpo">
                Todos los integrantes del estudio ya están asignados a este expediente.
              </span>
            </div>
          ) : (
            <>
              <CampoSelect
                etiqueta="Integrante del estudio"
                value={usuarioId}
                onChange={(evento) => {
                  setUsuarioId(evento.target.value);
                  limpiarCampo('usuario_id');
                }}
                opciones={disponibles.map((profesional) => ({
                  valor: profesional.id,
                  texto: profesional.nombre,
                }))}
                vacio="Elegí a quién asignar"
                error={errores.usuario_id?.[0]}
                obligatorio
              />

              <CampoSelect
                etiqueta="Rol en la causa"
                value={rol}
                onChange={(evento) => {
                  setRol(evento.target.value);
                  limpiarCampo('rol_en_causa');
                }}
                opciones={ROLES_PROFESIONAL.map((opcion) => ({
                  valor: opcion.valor,
                  texto: opcion.texto,
                }))}
                ayuda={
                  hayTitular && rol === 'TITULAR'
                    ? 'Este expediente ya tiene un titular; quedarían dos.'
                    : 'El titular es quien figura como responsable en el listado de expedientes.'
                }
                error={errores.rol_en_causa?.[0]}
                obligatorio
              />
            </>
          )}
        </form>
      )}
    </Modal>
  );
}
