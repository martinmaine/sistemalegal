/** Fila del listado de causas, tal como viaja al frontend. */
export interface CausaListada {
  id: string;
  numero_expediente: string | null;
  caratula: string;
  /** Texto YYYY-MM-DD: la base guarda DATE y convertirlo a Date corre el día por zona horaria. */
  fecha_inicio: string;
  estado: string;
  fuero: string;
}
