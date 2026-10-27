import { describe, it, expect } from 'vitest';
import { computarPlazo, type DiaInhabil, type EntradaComputo } from '../src/modulos/plazos/computo';

/**
 * Casos de prueba del motor de cómputo.
 *
 * El calendario de abajo es un **dato de prueba**, no el calendario judicial de
 * Córdoba: se fija acá para que cada caso tenga una respuesta verificable a
 * mano. El calendario real vive en la tabla `dia_inhabil` y lo carga el
 * estudio.
 *
 * Cada caso dice qué día de la semana cae cada fecha, para que se pueda
 * controlar el resultado sin ejecutar nada.
 */

const CALENDARIO: DiaInhabil[] = [
  { fecha: '2026-04-02', tipo: 'FERIADO_NACIONAL', motivo: 'Jueves Santo' },
  { fecha: '2026-04-03', tipo: 'FERIADO_NACIONAL', motivo: 'Viernes Santo' },
  // Feria de prueba: lunes 13 a viernes 17 de abril.
  { fecha: '2026-04-13', tipo: 'FERIA_JUDICIAL', motivo: 'Feria judicial' },
  { fecha: '2026-04-14', tipo: 'FERIA_JUDICIAL', motivo: 'Feria judicial' },
  { fecha: '2026-04-15', tipo: 'FERIA_JUDICIAL', motivo: 'Feria judicial' },
  { fecha: '2026-04-16', tipo: 'FERIA_JUDICIAL', motivo: 'Feria judicial' },
  { fecha: '2026-04-17', tipo: 'FERIA_JUDICIAL', motivo: 'Feria judicial' },
  { fecha: '2027-01-01', tipo: 'FERIADO_NACIONAL', motivo: 'Año nuevo' },
];

function computar(entrada: Partial<EntradaComputo> & Pick<EntradaComputo, 'fechaNotificacion'>) {
  return computarPlazo({
    cantidadDias: 5,
    computo: 'HABIL',
    inhabiles: CALENDARIO,
    ...entrada,
  });
}

describe('días hábiles', () => {
  it('no cuenta el día de la notificación y arranca el hábil siguiente', () => {
    // Notificación lunes 9/3. Arranca martes 10/3 y ese mismo día se agota.
    const resultado = computar({ fechaNotificacion: '2026-03-09', cantidadDias: 1 });

    expect(resultado.fechaInicioComputo).toBe('2026-03-10');
    expect(resultado.fechaVencimiento).toBe('2026-03-10');
  });

  it('cuenta cinco días hábiles salteando el fin de semana', () => {
    // Notificación martes 10/3 → arranca miércoles 11.
    // 11 mié(1) 12 jue(2) 13 vie(3) · 14 sáb · 15 dom · 16 lun(4) 17 mar(5).
    const resultado = computar({ fechaNotificacion: '2026-03-10', cantidadDias: 5 });

    expect(resultado.fechaVencimiento).toBe('2026-03-17');
    expect(resultado.corridoPorInhabil).toBe(false);
  });

  it('una notificación del viernes empieza a correr el lunes', () => {
    // Viernes 13/3 → sábado y domingo no son hábiles → arranca lunes 16.
    const resultado = computar({ fechaNotificacion: '2026-03-13', cantidadDias: 3 });

    expect(resultado.fechaInicioComputo).toBe('2026-03-16');
    expect(resultado.fechaVencimiento).toBe('2026-03-18');
  });

  it('saltea los feriados que caen en el medio', () => {
    // Notificación martes 31/3 → arranca miércoles 1/4.
    // 1 mié(1) · 2 jue feriado · 3 vie feriado · 4 sáb · 5 dom ·
    // 6 lun(2) 7 mar(3) 8 mié(4) 9 jue(5).
    const resultado = computar({ fechaNotificacion: '2026-03-31', cantidadDias: 5 });

    expect(resultado.fechaVencimiento).toBe('2026-04-09');
  });

  it('atraviesa una feria judicial completa', () => {
    // Notificación viernes 10/4 → el lunes 13 ya es feria, que va hasta el 17.
    // Arranca el lunes 20: 20(1) 21(2) 22(3).
    const resultado = computar({ fechaNotificacion: '2026-04-10', cantidadDias: 3 });

    expect(resultado.fechaInicioComputo).toBe('2026-04-20');
    expect(resultado.fechaVencimiento).toBe('2026-04-22');
  });

  it('cruza el fin de año salteando el 1 de enero', () => {
    // Notificación miércoles 30/12 → arranca jueves 31(1).
    // 1/1 feriado · 2 sáb · 3 dom · 4 lun(2) 5 mar(3).
    const resultado = computar({ fechaNotificacion: '2026-12-30', cantidadDias: 3 });

    expect(resultado.fechaVencimiento).toBe('2027-01-05');
  });
});

describe('días corridos', () => {
  it('cuenta sábados, domingos y feriados', () => {
    // Notificación lunes 9/3 → arranca martes 10. 10(1) 11(2) 12(3).
    const resultado = computar({
      fechaNotificacion: '2026-03-09',
      cantidadDias: 3,
      computo: 'CORRIDO',
    });

    expect(resultado.fechaVencimiento).toBe('2026-03-12');
    expect(resultado.dias.filter((dia) => dia.salteadoPor)).toHaveLength(0);
  });

  it('corre el vencimiento al hábil siguiente si el último día cae inhábil', () => {
    // Notificación martes 31/3 → arranca miércoles 1/4.
    // 1(1) 2(2) 3(3) 4(4) 5(5) → el día 5 es domingo, así que vence el lunes 6.
    const resultado = computar({
      fechaNotificacion: '2026-03-31',
      cantidadDias: 5,
      computo: 'CORRIDO',
    });

    expect(resultado.fechaVencimiento).toBe('2026-04-06');
    expect(resultado.corridoPorInhabil).toBe(true);
    expect(resultado.explicacion.join(' ')).toContain('inhábil');
  });

  it('empieza igual que el hábil: el día de la notificación no cuenta', () => {
    const corrido = computar({ fechaNotificacion: '2026-03-10', computo: 'CORRIDO' });
    const habil = computar({ fechaNotificacion: '2026-03-10', computo: 'HABIL' });

    expect(corrido.fechaInicioComputo).toBe(habil.fechaInicioComputo);
  });
});

describe('suspensiones', () => {
  it('no cuenta los días suspendidos', () => {
    // Notificación martes 10/3 → arranca miércoles 11(1).
    // Suspendido del 12 al 16 · 17 mar(2) 18(3) 19(4) 20(5).
    const resultado = computar({
      fechaNotificacion: '2026-03-10',
      cantidadDias: 5,
      suspensiones: [{ desde: '2026-03-12', hasta: '2026-03-16', motivo: 'Incidente' }],
    });

    expect(resultado.fechaVencimiento).toBe('2026-03-20');
    expect(
      resultado.dias.some((dia) => dia.salteadoPor === 'SUSPENDIDO' && dia.fecha === '2026-03-12'),
    ).toBe(true);
  });

  it('suspende también un plazo en días corridos', () => {
    const resultado = computar({
      fechaNotificacion: '2026-03-09',
      cantidadDias: 3,
      computo: 'CORRIDO',
      suspensiones: [{ desde: '2026-03-11', hasta: '2026-03-12', motivo: 'Acuerdo de partes' }],
    });

    // 10(1) · 11 y 12 suspendidos · 13(2) 14(3) → sábado, corre al lunes 16.
    expect(resultado.fechaVencimiento).toBe('2026-03-16');
  });

  it('nombra el motivo de la suspensión en el detalle', () => {
    // La suspensión cae después del arranque: el 11 es el día 1 y el 12 no cuenta.
    const resultado = computar({
      fechaNotificacion: '2026-03-10',
      cantidadDias: 2,
      suspensiones: [{ desde: '2026-03-12', hasta: '2026-03-12', motivo: 'Feria extraordinaria' }],
    });

    expect(resultado.fechaVencimiento).toBe('2026-03-13');

    const suspendido = resultado.dias.find((dia) => dia.salteadoPor === 'SUSPENDIDO');
    expect(suspendido?.fecha).toBe('2026-03-12');
    expect(suspendido?.detalle).toContain('Feria extraordinaria');
  });

  it('si el día de arranque está suspendido, el cómputo empieza después', () => {
    // No es un caso de borde inventado: una notificación en vísperas de una
    // suspensión acordada entra justo acá.
    const resultado = computar({
      fechaNotificacion: '2026-03-10',
      cantidadDias: 1,
      suspensiones: [{ desde: '2026-03-11', hasta: '2026-03-13', motivo: 'Acuerdo de partes' }],
    });

    expect(resultado.fechaInicioComputo).toBe('2026-03-16');
    expect(resultado.fechaVencimiento).toBe('2026-03-16');
  });

  it('falla con un mensaje claro si la suspensión no tiene fecha de fin', () => {
    // Una suspensión abierta hace que el plazo nunca avance. Es un dato mal
    // cargado, y el motor tiene que decirlo en vez de colgarse.
    expect(() =>
      computar({
        fechaNotificacion: '2026-03-10',
        cantidadDias: 3,
        suspensiones: [{ desde: '2026-03-11', motivo: 'Sin reanudar' }],
      }),
    ).toThrow(/calendario|suspensiones/i);
  });
});

describe('inicio del cómputo fijado a mano', () => {
  it('respeta la fecha indicada y lo dice en la explicación', () => {
    const resultado = computar({
      fechaNotificacion: '2026-03-10',
      fechaInicioComputo: '2026-03-10',
      cantidadDias: 2,
    });

    expect(resultado.fechaInicioComputo).toBe('2026-03-10');
    expect(resultado.fechaVencimiento).toBe('2026-03-11');
    expect(resultado.explicacion.join(' ')).toMatch(/a mano/i);
  });

  it('rechaza un inicio anterior a la notificación', () => {
    expect(() =>
      computar({ fechaNotificacion: '2026-03-10', fechaInicioComputo: '2026-03-09' }),
    ).toThrow(/antes de la notificación/i);
  });
});

describe('entradas inválidas', () => {
  it('rechaza una cantidad de días que no sea un entero positivo', () => {
    for (const dias of [0, -3, 2.5]) {
      expect(() => computar({ fechaNotificacion: '2026-03-10', cantidadDias: dias })).toThrow(
        /entero mayor que cero/i,
      );
    }
  });

  it('rechaza una fecha con formato equivocado', () => {
    expect(() => computar({ fechaNotificacion: '10/03/2026' })).toThrow(/YYYY-MM-DD/);
  });

  it('rechaza una fecha que no existe en el calendario', () => {
    // Date.UTC acomodaría el 30 de febrero al 2 de marzo sin avisar.
    expect(() => computar({ fechaNotificacion: '2026-02-30' })).toThrow(/no existe/i);
    expect(() => computar({ fechaNotificacion: '2027-02-29' })).toThrow(/no existe/i);
  });

  it('acepta el 29 de febrero de un año bisiesto', () => {
    // 2028 es bisiesto: el 29/2 existe y el cómputo tiene que poder arrancar ahí.
    expect(() => computar({ fechaNotificacion: '2028-02-29', cantidadDias: 1 })).not.toThrow();
  });
});

describe('explicación del cálculo', () => {
  it('detalla día por día qué contó y qué no, y por qué', () => {
    const resultado = computar({ fechaNotificacion: '2026-03-10', cantidadDias: 5 });

    const contados = resultado.dias.filter((dia) => dia.numero !== undefined);
    expect(contados).toHaveLength(5);
    expect(contados.map((dia) => dia.numero)).toEqual([1, 2, 3, 4, 5]);

    const sabado = resultado.dias.find((dia) => dia.fecha === '2026-03-14');
    expect(sabado?.salteadoPor).toBe('FIN_DE_SEMANA');
    expect(sabado?.detalle).toBe('Sábado');

    const domingo = resultado.dias.find((dia) => dia.fecha === '2026-03-15');
    expect(domingo?.detalle).toBe('Domingo');
  });

  it('nombra el feriado concreto que salteó', () => {
    const resultado = computar({ fechaNotificacion: '2026-03-31', cantidadDias: 5 });

    const feriado = resultado.dias.find((dia) => dia.fecha === '2026-04-02');
    expect(feriado?.salteadoPor).toBe('INHABIL');
    expect(feriado?.detalle).toBe('Jueves Santo');
  });

  it('explica en frases la notificación, el arranque y el vencimiento', () => {
    const resultado = computar({ fechaNotificacion: '2026-03-10', cantidadDias: 5 });
    const texto = resultado.explicacion.join(' ');

    expect(texto).toContain('2026-03-10');
    expect(texto).toContain('2026-03-11');
    expect(texto).toContain('2026-03-17');
    // Tiene que decir que el día de la notificación no se cuenta: es la parte
    // que más se discute cuando alguien revisa un vencimiento.
    expect(texto).toMatch(/no se cuenta/i);
  });

  it('el último día contado coincide con el vencimiento cuando no hay corrimiento', () => {
    const resultado = computar({ fechaNotificacion: '2026-03-10', cantidadDias: 5 });
    const contados = resultado.dias.filter((dia) => dia.numero !== undefined);

    expect(contados[contados.length - 1]!.fecha).toBe(resultado.fechaVencimiento);
  });
});

describe('sin calendario cargado', () => {
  it('sigue descontando sábados y domingos', () => {
    // Si el estudio todavía no cargó feriados, el cómputo hábil no puede
    // degradarse a corrido: el fin de semana no depende del calendario.
    const resultado = computarPlazo({
      fechaNotificacion: '2026-03-13',
      cantidadDias: 1,
      computo: 'HABIL',
    });

    expect(resultado.fechaInicioComputo).toBe('2026-03-16');
  });
});
