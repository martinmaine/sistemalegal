import type { ReactNode } from 'react';
import { urgencia } from '../../lib/formato';

/**
 * Etiqueta de estado.
 *
 * Siempre lleva texto además del color: distinguir estados únicamente por
 * color deja afuera a quien no percibe esa diferencia, y en una pantalla de
 * vencimientos eso es un riesgo real, no un detalle de accesibilidad.
 */

export type Tono = 'neutral' | 'exito' | 'alerta' | 'peligro' | 'info' | 'marca';

interface Props {
  tono?: Tono;
  punto?: boolean;
  children: ReactNode;
  title?: string;
}

export function Etiqueta({ tono = 'neutral', punto = false, children, title }: Props) {
  return (
    <span className={`etiqueta etiqueta--${tono}`} title={title}>
      {punto && <span className="etiqueta__punto" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Tono de un estado de causa.
 *
 * Las causas cerradas van en neutro y las vivas en el color de marca: lo que
 * importa destacar es lo que sigue en trámite.
 */
export function EstadoCausa({ estado, esFinal }: { estado: string; esFinal: boolean }) {
  return (
    <Etiqueta tono={esFinal ? 'neutral' : 'marca'} punto>
      {estado}
    </Etiqueta>
  );
}

const TONO_PLAZO: Record<string, Tono> = {
  PENDIENTE: 'alerta',
  CUMPLIDO: 'exito',
  VENCIDO: 'peligro',
  SUSPENDIDO: 'info',
  CANCELADO: 'neutral',
};

const ETIQUETA_PLAZO: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CUMPLIDO: 'Cumplido',
  VENCIDO: 'Vencido',
  SUSPENDIDO: 'Suspendido',
  CANCELADO: 'Cancelado',
};

export function EstadoPlazo({ estado }: { estado: string }) {
  return <Etiqueta tono={TONO_PLAZO[estado] ?? 'neutral'}>{ETIQUETA_PLAZO[estado] ?? estado}</Etiqueta>;
}

const TONO_TAREA: Record<string, Tono> = {
  PENDIENTE: 'alerta',
  EN_CURSO: 'info',
  COMPLETADA: 'exito',
  CANCELADA: 'neutral',
};

const ETIQUETA_TAREA: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

export function EstadoTarea({ estado }: { estado: string }) {
  return <Etiqueta tono={TONO_TAREA[estado] ?? 'neutral'}>{ETIQUETA_TAREA[estado] ?? estado}</Etiqueta>;
}

/** Vencimiento expresado en días, con el tono que corresponde a su urgencia. */
export function Vencimiento({ dias, texto }: { dias: number | null | undefined; texto: string }) {
  const nivel = urgencia(dias);
  const tono: Tono =
    nivel === 'vencido' ? 'peligro' : nivel === 'hoy' ? 'peligro' : nivel === 'proximo' ? 'alerta' : 'neutral';

  return <Etiqueta tono={tono}>{texto}</Etiqueta>;
}

const TONO_PRIORIDAD: Record<string, Tono> = {
  ALTA: 'peligro',
  MEDIA: 'alerta',
  BAJA: 'neutral',
};

export function Prioridad({ prioridad }: { prioridad: string }) {
  const etiquetas: Record<string, string> = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };
  return (
    <Etiqueta tono={TONO_PRIORIDAD[prioridad] ?? 'neutral'}>
      {etiquetas[prioridad] ?? prioridad}
    </Etiqueta>
  );
}
