import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { DiaDelComputo } from '../../tipos/api';
import { fecha as formatearFecha } from '../../lib/formato';

/**
 * Cómo se llegó a la fecha de vencimiento.
 *
 * Es la parte del producto que decide si un abogado puede confiar en el
 * cálculo: no alcanza con mostrar una fecha, hay que poder reconstruirla. Por
 * eso se muestran las frases siempre y el día por día a un clic.
 *
 * El aviso de abajo no es formalismo. El sistema ayuda a no perder un plazo;
 * no reemplaza el control del profesional, y la pantalla tiene que decirlo
 * donde se lee la fecha, no enterrado en un manual.
 */

interface Props {
  explicacion: string[];
  dias: DiaDelComputo[];
  /** Cuando el cálculo de hoy no coincide con lo guardado. */
  advertencia?: string;
}

/**
 * Pasa las fechas de las frases del motor a formato local.
 *
 * El motor trabaja y explica en `YYYY-MM-DD` porque es el formato que no se
 * presta a ambigüedad entre día y mes, y porque así sus pruebas no dependen de
 * una configuración regional. Pero "2026-10-28" no es como un abogado escribe
 * una fecha, así que se traduce acá, al mostrarla, y no en el motor.
 */
const ISO = /\d{4}-\d{2}-\d{2}/g;

function conFechasLocales(frase: string): string {
  return frase.replace(ISO, (encontrada) => formatearFecha(encontrada));
}

const ETIQUETA_SALTEO: Record<string, string> = {
  FIN_DE_SEMANA: 'No laborable',
  INHABIL: 'Inhábil',
  SUSPENDIDO: 'Suspendido',
};

export function ExplicacionComputo({ explicacion, dias, advertencia }: Props) {
  const [verDetalle, setVerDetalle] = useState(false);

  const contados = dias.filter((dia) => dia.numero !== undefined).length;
  const salteados = dias.length - contados;

  return (
    <div className="computo">
      {advertencia && (
        <div className="aviso aviso--alerta" role="alert">
          <span className="aviso__cuerpo">{advertencia}</span>
        </div>
      )}

      <ol className="computo__pasos">
        {explicacion.map((frase, indice) => (
          <li key={indice} className="computo__paso">
            {conFechasLocales(frase)}
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="boton boton--sutil boton--pequeno"
        onClick={() => setVerDetalle((abierto) => !abierto)}
        aria-expanded={verDetalle}
      >
        {verDetalle ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
        {verDetalle
          ? 'Ocultar el detalle día por día'
          : `Ver el detalle día por día (${contados} cuentan, ${salteados} no)`}
      </button>

      {verDetalle && (
        <div className="tabla-envoltorio computo__detalle">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Fecha</th>
                <th scope="col">Por qué</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((dia) => (
                <tr key={dia.fecha} className={dia.numero === undefined ? 'computo__fila--salteada' : ''}>
                  <td className="tabla__numero">
                    {dia.numero ?? <span className="dato__valor--vacio">—</span>}
                  </td>
                  <td className="tabla__numero">{formatearFecha(dia.fecha)}</td>
                  <td className="tabla__secundario">
                    {dia.numero !== undefined
                      ? 'Cuenta'
                      : `${ETIQUETA_SALTEO[dia.salteadoPor ?? ''] ?? 'No cuenta'}${
                          dia.detalle ? ` · ${dia.detalle}` : ''
                        }`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="computo__aviso">
        <Info size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          El cálculo se hace sobre el calendario de días inhábiles cargado en el sistema. Es una
          ayuda para no perder un vencimiento, no un dictamen: el control del plazo sigue siendo
          del profesional a cargo.
        </span>
      </p>
    </div>
  );
}
