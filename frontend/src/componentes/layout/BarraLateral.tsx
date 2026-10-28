import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Scale, Stethoscope } from 'lucide-react';
import { useSesion } from '../../modulos/auth/ContextoSesion';
import { Boton } from '../ui/Boton';
import { NAVEGACION, NAVEGACION_PENDIENTE } from './navegacion';

/**
 * Barra lateral: la navegación principal.
 *
 * Clara y con los nombres siempre visibles mientras no se contraiga. Los
 * iconos acompañan al texto, no lo reemplazan: un icono solo es ambiguo, y la
 * especificación lo pide explícitamente.
 */

interface Props {
  contraida: boolean;
  alternarContraida: () => void;
  abiertaEnMovil: boolean;
  alCerrarEnMovil: () => void;
  nombreEstudio?: string;
}

export function BarraLateral({
  contraida,
  alternarContraida,
  abiertaEnMovil,
  alCerrarEnMovil,
  nombreEstudio,
}: Props) {
  const { puede } = useSesion();
  const visibles = NAVEGACION.filter((item) => !item.permiso || puede(item.permiso));

  return (
    <aside
      className={`barra-lateral${abiertaEnMovil ? ' barra-lateral--abierta' : ''}`}
      aria-label="Navegación principal"
    >
      <NavLink to="/" className="barra-lateral__marca" onClick={alCerrarEnMovil}>
        <span className="barra-lateral__logo" aria-hidden>
          <Scale size={18} />
        </span>
        <span className="barra-lateral__identidad">
          <span className="barra-lateral__nombre">SistemaLegal</span>
          {nombreEstudio && <span className="barra-lateral__estudio">{nombreEstudio}</span>}
        </span>
      </NavLink>

      <nav className="barra-lateral__navegacion">
        <div className="barra-lateral__grupo">
          {visibles.map((item) => (
            <NavLink
              key={item.ruta}
              to={item.ruta}
              // `end` solo en Inicio: sin eso, "/" quedaría activo en todas las
              // rutas, porque toda ruta empieza con barra.
              end={item.ruta === '/'}
              onClick={alCerrarEnMovil}
              title={contraida ? item.texto : undefined}
              className={({ isActive }) =>
                `navegacion__enlace${isActive ? ' navegacion__enlace--activo' : ''}`
              }
            >
              <item.icono size={18} aria-hidden />
              <span className="navegacion__texto">{item.texto}</span>
            </NavLink>
          ))}
        </div>

        <div className="barra-lateral__grupo">
          <p className="barra-lateral__titulo-grupo">En desarrollo</p>
          {NAVEGACION_PENDIENTE.map((item) => (
            <span
              key={item.texto}
              className="navegacion__enlace"
              style={{ opacity: 0.45, cursor: 'default' }}
              title={`${item.texto} — todavía no está disponible`}
              aria-disabled="true"
            >
              <item.icono size={18} aria-hidden />
              <span className="navegacion__texto">{item.texto}</span>
            </span>
          ))}
        </div>
      </nav>

      <div className="barra-lateral__pie">
        <NavLink
          to="/diagnostico"
          onClick={alCerrarEnMovil}
          title={contraida ? 'Diagnóstico del sistema' : undefined}
          className={({ isActive }) => `navegacion__enlace${isActive ? ' navegacion__enlace--activo' : ''}`}
        >
          <Stethoscope size={18} aria-hidden />
          <span className="navegacion__texto">Diagnóstico</span>
        </NavLink>

        <div className="fila fila--separada" style={{ marginTop: 'var(--esp-2)' }}>
          <span className="barra-lateral__creditos">Powered by UTMA Technologies</span>
          <Boton
            variante="sutil"
            pequeno
            onClick={alternarContraida}
            aria-label={contraida ? 'Expandir la barra lateral' : 'Contraer la barra lateral'}
            icono={contraida ? <PanelLeftOpen size={16} aria-hidden /> : <PanelLeftClose size={16} aria-hidden />}
          />
        </div>
      </div>
    </aside>
  );
}
