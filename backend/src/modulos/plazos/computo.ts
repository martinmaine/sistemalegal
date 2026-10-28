/**
 * Motor de cómputo de plazos procesales.
 *
 * Es una función pura: recibe la fecha de notificación, la regla y el
 * calendario, y devuelve la fecha de vencimiento junto con **el detalle de
 * cómo llegó a ella**. No toca la base ni el reloj del sistema. Esa es la
 * condición para poder probarlo con casos documentados, que es lo que exige la
 * migración 006.
 *
 * Qué está acá y qué no:
 *
 *  - **Acá está el algoritmo**: cómo se cuentan los días, qué se saltea y
 *    cuándo se corre un vencimiento.
 *  - **Acá NO están las reglas jurídicas**: cuántos días tiene cada plazo, si
 *    se cuentan hábiles o corridos y qué días son inhábiles son *datos* que
 *    vienen de `tipo_plazo` y `dia_inhabil`. Cambiar de provincia es insertar
 *    filas, no tocar este archivo.
 *
 * El resultado nunca es una garantía legal. El motor dice cómo llegó a la
 * fecha para que un abogado pueda verificarlo; la responsabilidad de
 * controlarlo sigue siendo suya, y la interfaz lo dice.
 *
 * Las fechas se manejan como texto `YYYY-MM-DD` y toda la aritmética usa UTC.
 * Construir un `Date` desde una fecha local corre el día según la zona
 * horaria, y en un vencimiento procesal un día de diferencia es el perjuicio
 * que el sistema existe para evitar.
 */

export type Computo = 'HABIL' | 'CORRIDO';

export interface DiaInhabil {
  /** `YYYY-MM-DD`. */
  fecha: string;
  tipo: string;
  motivo: string;
}

export interface Suspension {
  /** `YYYY-MM-DD`. */
  desde: string;
  /** `YYYY-MM-DD`, o ausente mientras la suspensión sigue vigente. */
  hasta?: string;
  /** Para poder nombrarla en la explicación del cómputo. */
  motivo?: string;
}

export interface EntradaComputo {
  fechaNotificacion: string;
  cantidadDias: number;
  computo: Computo;
  /** Días inhábiles de la jurisdicción. El orden no importa. */
  inhabiles?: DiaInhabil[];
  suspensiones?: Suspension[];
  /**
   * Primer día que cuenta, si no es el que el motor propondría.
   *
   * La regla general es el día hábil siguiente a la notificación, pero varía
   * según el acto procesal, así que se puede fijar a mano y queda registrado.
   */
  fechaInicioComputo?: string;
}

export type MotivoSalteo = 'FIN_DE_SEMANA' | 'INHABIL' | 'SUSPENDIDO';

export interface DiaDelComputo {
  fecha: string;
  /** Si no cuenta, por qué. */
  salteadoPor?: MotivoSalteo;
  /** Detalle del salteo: "Feria judicial", "Suspensión: incidente". */
  detalle?: string;
  /** Número de día del plazo, cuando cuenta. */
  numero?: number;
}

export interface ResultadoComputo {
  fechaInicioComputo: string;
  fechaVencimiento: string;
  /** Día por día, para poder auditar el cálculo. */
  dias: DiaDelComputo[];
  /** El mismo cálculo en frases, para mostrar sin leer la tabla. */
  explicacion: string[];
  /** Vencía ese día pero cayó inhábil y se corrió al hábil siguiente. */
  corridoPorInhabil: boolean;
}

/**
 * Tope de iteraciones, en días de calendario.
 *
 * Un calendario mal cargado —toda la feria sin fecha de fin, una suspensión
 * abierta— haría que el motor nunca termine de contar. Antes que colgar el
 * servidor conviene fallar con un mensaje que diga qué revisar.
 */
const TOPE_DIAS = 366 * 5;

/* --- Aritmética de fechas sin zona horaria --------------------------------- */

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

function aMilisegundos(fecha: string): number {
  if (!FORMATO.test(fecha)) {
    throw new Error(`La fecha "${fecha}" no tiene el formato YYYY-MM-DD`);
  }

  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const ms = Date.UTC(anio, mes - 1, dia);

  // Date.UTC acomoda un 31 de febrero al 3 de marzo sin avisar. Comparar la
  // vuelta con la entrada es lo que detecta una fecha que no existe.
  if (aTexto(ms) !== fecha) throw new Error(`La fecha "${fecha}" no existe en el calendario`);
  return ms;
}

function aTexto(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const UN_DIA = 86_400_000;

function sumarDias(fecha: string, dias: number): string {
  return aTexto(aMilisegundos(fecha) + dias * UN_DIA);
}

/** 0 domingo … 6 sábado, en UTC, que es como se guardaron las fechas. */
function diaDeLaSemana(fecha: string): number {
  return new Date(aMilisegundos(fecha)).getUTCDay();
}

function esFinDeSemana(fecha: string): boolean {
  const dia = diaDeLaSemana(fecha);
  return dia === 0 || dia === 6;
}

/* --- Calendario ------------------------------------------------------------ */

/** Índice por fecha. El motor pregunta por día, no recorre la lista entera. */
function indexar(inhabiles: DiaInhabil[]): Map<string, DiaInhabil> {
  return new Map(inhabiles.map((dia) => [dia.fecha, dia]));
}

function enSuspension(fecha: string, suspensiones: Suspension[]): Suspension | undefined {
  return suspensiones.find((tramo) => {
    if (fecha < tramo.desde) return false;
    // Sin fecha de fin la suspensión sigue abierta: todo lo posterior al
    // comienzo está suspendido.
    return tramo.hasta === undefined || fecha <= tramo.hasta;
  });
}

interface Calendario {
  inhabiles: Map<string, DiaInhabil>;
  suspensiones: Suspension[];
}

/** Por qué un día no cuenta, o `undefined` si cuenta. */
function porQueNoCuenta(
  fecha: string,
  calendario: Calendario,
  computo: Computo,
): { motivo: MotivoSalteo; detalle: string } | undefined {
  const suspension = enSuspension(fecha, calendario.suspensiones);
  if (suspension) {
    return { motivo: 'SUSPENDIDO', detalle: `Suspensión: ${suspension.motivo ?? 'sin motivo'}` };
  }

  // Un plazo en días corridos cuenta sábados, domingos y feriados: esa es la
  // diferencia con el cómputo en días hábiles.
  if (computo === 'CORRIDO') return undefined;

  if (esFinDeSemana(fecha)) {
    return { motivo: 'FIN_DE_SEMANA', detalle: diaDeLaSemana(fecha) === 6 ? 'Sábado' : 'Domingo' };
  }

  const inhabil = calendario.inhabiles.get(fecha);
  if (inhabil) return { motivo: 'INHABIL', detalle: inhabil.motivo };

  return undefined;
}

/** Un día hábil es laborable, no feriado y no suspendido. Sirve para los bordes. */
function esHabil(fecha: string, calendario: Calendario): boolean {
  return porQueNoCuenta(fecha, calendario, 'HABIL') === undefined;
}

/** Primer día hábil igual o posterior a la fecha dada. */
function habilDesde(fecha: string, calendario: Calendario): string {
  let actual = fecha;
  for (let paso = 0; paso <= TOPE_DIAS; paso += 1) {
    if (esHabil(actual, calendario)) return actual;
    actual = sumarDias(actual, 1);
  }
  throw new Error(
    'No se encontró un día hábil en cinco años. Revisá el calendario de días inhábiles y las suspensiones abiertas.',
  );
}

/* --- El cómputo ------------------------------------------------------------ */

export function computarPlazo(entrada: EntradaComputo): ResultadoComputo {
  if (!Number.isInteger(entrada.cantidadDias) || entrada.cantidadDias < 1) {
    throw new Error('La cantidad de días del plazo tiene que ser un entero mayor que cero');
  }

  const calendario: Calendario = {
    inhabiles: indexar(entrada.inhabiles ?? []),
    suspensiones: entrada.suspensiones ?? [],
  };

  const explicacion: string[] = [];

  // 1. Desde cuándo se cuenta.
  //
  // La regla general es que el plazo empieza a correr el día hábil siguiente a
  // la notificación: el día de la notificación no se cuenta. Como varía según
  // el acto, quien carga el plazo puede fijar otro día, y entonces se respeta.
  let inicio: string;
  if (entrada.fechaInicioComputo) {
    inicio = entrada.fechaInicioComputo;
    aMilisegundos(inicio);
    if (inicio < entrada.fechaNotificacion) {
      throw new Error('El cómputo no puede empezar antes de la notificación');
    }
    explicacion.push(`El cómputo arranca el ${inicio}, fijado a mano al cargar el plazo.`);
  } else {
    inicio = habilDesde(sumarDias(entrada.fechaNotificacion, 1), calendario);
    explicacion.push(
      `Notificación el ${entrada.fechaNotificacion}; el día de la notificación no se cuenta.`,
    );
    explicacion.push(`El cómputo arranca el ${inicio}, primer día hábil siguiente.`);
  }

  // 2. Contar.
  const dias: DiaDelComputo[] = [];
  let contados = 0;
  let actual = inicio;
  let ultimoContado = inicio;

  for (let paso = 0; paso <= TOPE_DIAS && contados < entrada.cantidadDias; paso += 1) {
    const razon = porQueNoCuenta(actual, calendario, entrada.computo);

    if (razon) {
      dias.push({ fecha: actual, salteadoPor: razon.motivo, detalle: razon.detalle });
    } else {
      contados += 1;
      ultimoContado = actual;
      dias.push({ fecha: actual, numero: contados });
    }

    actual = sumarDias(actual, 1);
  }

  if (contados < entrada.cantidadDias) {
    throw new Error(
      'No se pudo completar el cómputo en cinco años. Revisá el calendario de días inhábiles y las suspensiones abiertas.',
    );
  }

  const tipoDia = entrada.computo === 'HABIL' ? 'hábiles' : 'corridos';
  const salteados = dias.filter((dia) => dia.salteadoPor).length;

  explicacion.push(
    salteados === 0
      ? `Se cuentan ${entrada.cantidadDias} días ${tipoDia} sin interrupciones.`
      : `Se cuentan ${entrada.cantidadDias} días ${tipoDia}, salteando ${salteados} ${
          salteados === 1 ? 'día que no cuenta' : 'días que no cuentan'
        }.`,
  );

  // 3. Si el último día cae inhábil, el plazo vence el hábil siguiente.
  //
  // En cómputo hábil el último día contado ya es hábil por construcción. En
  // cómputo corrido puede caer sábado, domingo o feriado, y entonces se corre.
  const vencimiento = habilDesde(ultimoContado, calendario);
  const corridoPorInhabil = vencimiento !== ultimoContado;

  if (corridoPorInhabil) {
    explicacion.push(
      `El día ${entrada.cantidadDias} caía el ${ultimoContado}, que es inhábil; el plazo vence el ${vencimiento}, primer día hábil siguiente.`,
    );
  } else {
    explicacion.push(`El plazo vence el ${vencimiento}.`);
  }

  return {
    fechaInicioComputo: inicio,
    fechaVencimiento: vencimiento,
    dias,
    explicacion,
    corridoPorInhabil,
  };
}
