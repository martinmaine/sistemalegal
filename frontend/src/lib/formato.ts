/**
 * Formato de fechas, importes y textos para la interfaz.
 *
 * Todo en es-AR: día antes que mes, coma decimal, punto de miles.
 */

const LOCAL = 'es-AR';

/**
 * Convierte una fecha 'YYYY-MM-DD' del backend en un Date LOCAL.
 *
 * No se puede usar `new Date('2026-03-12')` directamente: la norma dice que una
 * fecha sola se interpreta como UTC, así que en Argentina (UTC-3) esa expresión
 * da el 11 de marzo a las 21:00 y la pantalla muestra el día anterior. Un
 * vencimiento corrido un día en un sistema de plazos procesales es inadmisible,
 * así que se arman los componentes a mano.
 */
export function aFechaLocal(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;

  const partes = iso.slice(0, 10).split('-');
  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  if (!anio || !mes || !dia) return undefined;
  return new Date(anio, mes - 1, dia);
}

/** 12/03/2026 — el formato que un abogado espera en una tabla. */
export function fecha(iso: string | null | undefined): string {
  const valor = aFechaLocal(iso);
  if (!valor) return '—';
  return valor.toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 12 de marzo de 2026 — para cabeceras y fichas, donde hay lugar. */
export function fechaLarga(iso: string | null | undefined): string {
  const valor = aFechaLocal(iso);
  if (!valor) return '—';
  return valor.toLocaleDateString(LOCAL, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Para marcas de tiempo completas (TIMESTAMPTZ), donde la hora sí importa. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const valor = new Date(iso);
  if (Number.isNaN(valor.getTime())) return '—';
  return valor.toLocaleString(LOCAL, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hora(iso: string | null | undefined): string {
  if (!iso) return '';
  const valor = new Date(iso);
  if (Number.isNaN(valor.getTime())) return '';
  return valor.toLocaleTimeString(LOCAL, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Traduce una cantidad de días a lenguaje natural.
 *
 * Es lo que convierte un dato en una señal: "vence mañana" se entiende de un
 * vistazo, "2026-03-12" hay que calcularlo mentalmente.
 */
export function enDias(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return '—';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias === -1) return 'venció ayer';
  if (dias < 0) return `venció hace ${Math.abs(dias)} días`;
  return `en ${dias} días`;
}

/** Urgencia de un vencimiento, para elegir el color de la etiqueta. */
export type Urgencia = 'vencido' | 'hoy' | 'proximo' | 'normal';

export function urgencia(dias: number | null | undefined): Urgencia {
  if (dias === null || dias === undefined) return 'normal';
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoy';
  if (dias <= 3) return 'proximo';
  return 'normal';
}

/** Tiempo transcurrido, en la escala que corresponda. */
export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return '—';
  const valor = new Date(iso);
  if (Number.isNaN(valor.getTime())) return '—';

  const segundos = Math.floor((Date.now() - valor.getTime()) / 1000);
  if (segundos < 60) return 'recién';
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86_400) return `hace ${Math.floor(segundos / 3600)} h`;

  const dias = Math.floor(segundos / 86_400);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  return fecha(iso);
}

/** Importe con separadores locales. El monto llega como texto para no perder precisión. */
export function importe(monto: string | number | null | undefined, moneda = 'ARS'): string {
  if (monto === null || monto === undefined || monto === '') return '—';

  const numero = typeof monto === 'number' ? monto : Number(monto);
  if (Number.isNaN(numero)) return '—';

  return numero.toLocaleString(LOCAL, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function tamanoArchivo(bytes: string | number | null | undefined): string {
  const numero = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!numero || Number.isNaN(numero)) return '—';

  const unidades = ['B', 'KB', 'MB', 'GB'];
  let valor = numero;
  let unidad = 0;
  while (valor >= 1024 && unidad < unidades.length - 1) {
    valor /= 1024;
    unidad += 1;
  }
  return `${valor.toFixed(unidad === 0 ? 0 : 1)} ${unidades[unidad]}`;
}

export function iniciales(nombre: string | null | undefined, apellido?: string | null): string {
  const primera = nombre?.trim()[0] ?? '';
  const segunda = apellido?.trim()[0] ?? '';
  return (primera + segunda).toUpperCase() || '?';
}

/**
 * Pasa un código de la base (DEMANDADO, EN_CURSO) a algo legible.
 *
 * Los códigos viven en restricciones CHECK del esquema y no en una tabla de
 * catálogo, así que la traducción tiene que estar en algún lado; acá está junto
 * al resto del formato y no repartida por las pantallas.
 */
export function legible(codigo: string | null | undefined): string {
  if (!codigo) return '—';
  const texto = codigo.replace(/_/g, ' ').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Corta un texto largo sin partir una palabra por la mitad. */
export function recortar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${corte.slice(0, ultimoEspacio > maximo * 0.6 ? ultimoEspacio : maximo)}…`;
}
