/**
 * Tipos compartidos con el backend. Hoy se mantienen a mano; cuando el contrato
 * crezca conviene generarlos desde el backend para que no se desincronicen.
 */

export interface Causa {
  id: string;
  numero_expediente: string | null;
  caratula: string;
  fecha_inicio: string;
  estado: string;
  fuero: string;
}

export interface ListadoCausas {
  total: number;
  causas: Causa[];
}

export interface EstadoSalud {
  estado: string;
  entorno: string;
  base: 'conectada' | 'sin-conexion';
  detalleBase?: string;
  momento: string;
}
