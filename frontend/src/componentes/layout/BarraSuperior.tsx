import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useSesion } from '../../modulos/auth/ContextoSesion';
import { iniciales } from '../../lib/formato';
import { Boton } from '../ui/Boton';

/**
 * Barra superior: contexto de la sección, búsqueda global y usuario.
 */

interface Props {
  titulo: string;
  alAbrirMenu: () => void;
  alAbrirBusqueda: () => void;
}

export function BarraSuperior({ titulo, alAbrirMenu, alAbrirBusqueda }: Props) {
  const { usuario, cerrarSesion } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const navegar = useNavigate();

  // Un menú abierto se cierra al hacer clic afuera o con Escape. Sin esto,
  // queda flotando mientras el usuario trabaja en otra parte.
  useEffect(() => {
    if (!menuAbierto) return;

    function alClic(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setMenuAbierto(false);
    }
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setMenuAbierto(false);
    }

    document.addEventListener('mousedown', alClic);
    document.addEventListener('keydown', alPresionar);
    return () => {
      document.removeEventListener('mousedown', alClic);
      document.removeEventListener('keydown', alPresionar);
    };
  }, [menuAbierto]);

  async function salir() {
    setMenuAbierto(false);
    await cerrarSesion();
    navegar('/acceso', { replace: true });
  }

  return (
    <header className="barra-superior">
      <Boton
        variante="sutil"
        className="boton-menu"
        onClick={alAbrirMenu}
        aria-label="Abrir la navegación"
        icono={<Menu size={18} aria-hidden />}
      />

      <div className="barra-superior__contexto">
        <h1 className="barra-superior__titulo">{titulo}</h1>
      </div>

      <div className="barra-superior__busqueda">
        <button
          type="button"
          className="buscador"
          onClick={alAbrirBusqueda}
          style={{ width: '100%' }}
          aria-label="Buscar en todo el sistema"
        >
          <Search size={16} className="buscador__icono" aria-hidden />
          <span
            className="entrada"
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 'var(--esp-8)',
              color: 'var(--neutro-400)',
              background: 'var(--superficie-sutil)',
            }}
          >
            Buscar expedientes, clientes…
          </span>
          <kbd className="atajo">Ctrl K</kbd>
        </button>
      </div>

      <div className="barra-superior__acciones">
        <Boton
          variante="sutil"
          onClick={alAbrirBusqueda}
          className="boton-menu"
          aria-label="Buscar"
          icono={<Search size={18} aria-hidden />}
        />

        <div className="menu-usuario" ref={contenedor}>
          <button
            type="button"
            className="menu-usuario__disparador"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
          >
            <span className="avatar" aria-hidden>
              {iniciales(usuario?.nombre, usuario?.apellido)}
            </span>
            <span className="menu-usuario__datos">
              <span className="menu-usuario__nombre">
                {usuario?.nombre} {usuario?.apellido}
              </span>
              <span className="menu-usuario__rol">{usuario?.rolNombre}</span>
            </span>
          </button>

          {menuAbierto && (
            <div className="menu" role="menu">
              <div className="menu__cabecera">
                <p className="menu-usuario__nombre">
                  {usuario?.nombre} {usuario?.apellido}
                </p>
                <p className="texto-pequeno texto-tenue">{usuario?.email}</p>
                <p className="texto-pequeno texto-tenue" style={{ marginTop: 2 }}>
                  <UserRound size={12} aria-hidden style={{ display: 'inline', verticalAlign: -2 }} />{' '}
                  {usuario?.rolNombre}
                </p>
              </div>

              <button type="button" className="menu__item menu__item--peligro" role="menuitem" onClick={salir}>
                <LogOut size={16} aria-hidden />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
