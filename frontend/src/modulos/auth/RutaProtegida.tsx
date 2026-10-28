import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from './ContextoSesion';
import { Cargando } from '../../componentes/ui/Estados';

/**
 * Puerta de entrada a las pantallas autenticadas.
 *
 * Esto es comodidad de navegación, no seguridad: quien quite este componente
 * no obtiene nada, porque la API responde 401 sin un token válido. Lo que
 * resuelve es que nadie vea un esqueleto de pantalla vacío antes de que le
 * digan que tiene que iniciar sesión.
 */

export function RutaProtegida() {
  const { estado } = useSesion();
  const ubicacion = useLocation();

  if (estado === 'comprobando') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <Cargando texto="Cargando SistemaLegal…" />
      </div>
    );
  }

  if (estado === 'anonimo') {
    // Se recuerda a dónde iba para volver ahí después de entrar.
    return <Navigate to="/acceso" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  }

  return <Outlet />;
}
