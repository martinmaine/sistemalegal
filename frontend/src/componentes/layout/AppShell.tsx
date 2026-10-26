import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BarraLateral } from './BarraLateral';
import { BarraSuperior } from './BarraSuperior';
import { BusquedaGlobal } from './BusquedaGlobal';
import { tituloDeRuta } from './navegacion';

/**
 * Estructura común a todas las pantallas autenticadas.
 *
 * La preferencia de barra contraída se guarda en localStorage. Es lo único que
 * se persiste en el navegador, y a propósito: es una comodidad visual, no un
 * dato del estudio ni nada que debiera sobrevivir en el dispositivo de alguien.
 */

const CLAVE_CONTRAIDA = 'sistemalegal.barra-contraida';

export function AppShell() {
  const [contraida, setContraida] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_CONTRAIDA) === 'true';
    } catch {
      // En modo privado o con el almacenamiento bloqueado, leer puede fallar.
      return false;
    }
  });
  const [menuMovil, setMenuMovil] = useState(false);
  const [busqueda, setBusqueda] = useState(false);
  const ubicacion = useLocation();
  const titulo = tituloDeRuta(ubicacion.pathname);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_CONTRAIDA, String(contraida));
    } catch {
      // Sin almacenamiento, la preferencia simplemente no se recuerda.
    }
  }, [contraida]);

  // El título del documento sigue a la sección: así las pestañas del navegador
  // y el historial son legibles cuando hay varias abiertas.
  useEffect(() => {
    document.title = `${titulo} · SistemaLegal`;
  }, [titulo]);

  // Al cambiar de ruta se cierra el cajón: en el teléfono, si no, el menú tapa
  // la pantalla a la que se acaba de navegar.
  useEffect(() => {
    setMenuMovil(false);
  }, [ubicacion.pathname]);

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        setBusqueda(true);
      }
    }
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, []);

  return (
    <div className={`shell${contraida ? ' shell--contraida' : ''}`}>
      <a className="salto-contenido" href="#contenido">
        Saltar al contenido
      </a>

      <BarraLateral
        contraida={contraida}
        alternarContraida={() => setContraida((valor) => !valor)}
        abiertaEnMovil={menuMovil}
        alCerrarEnMovil={() => setMenuMovil(false)}
      />

      {menuMovil && (
        <div className="velo-lateral" onClick={() => setMenuMovil(false)} aria-hidden />
      )}

      <div className="principal">
        <BarraSuperior
          titulo={titulo}
          alAbrirMenu={() => setMenuMovil(true)}
          alAbrirBusqueda={() => setBusqueda(true)}
        />

        <main className="pagina" id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <BusquedaGlobal abierta={busqueda} alCerrar={() => setBusqueda(false)} />
    </div>
  );
}
