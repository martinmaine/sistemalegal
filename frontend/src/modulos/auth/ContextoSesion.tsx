import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { alCaerLaSesion, api, ErrorApi, guardarAccessToken } from '../../servicios/api';
import type { Usuario } from '../../tipos/api';

/**
 * Estado de la sesión para toda la aplicación.
 *
 * El access token no se guarda acá ni en localStorage: vive dentro del cliente
 * de API, en memoria. Este contexto solo conoce al usuario y su estado.
 *
 * Al recargar la página el token de memoria se pierde, así que se intenta
 * renovar con la cookie httpOnly antes de mostrar nada. Ese intento es la razón
 * del estado "comprobando": sin él, una recarga mandaría al login a alguien que
 * tiene la sesión viva.
 */

type EstadoSesion = 'comprobando' | 'autenticado' | 'anonimo';

interface ValorContexto {
  estado: EstadoSesion;
  usuario?: Usuario;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  /** Verifica un permiso modulo.accion. El backend lo vuelve a verificar siempre. */
  puede: (permiso: string) => boolean;
}

const Contexto = createContext<ValorContexto | undefined>(undefined);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>('comprobando');
  const [usuario, setUsuario] = useState<Usuario>();

  // En modo estricto React monta dos veces en desarrollo. Sin esta guarda, el
  // arranque dispararía dos refrescos y el segundo llegaría con un token ya
  // rotado, que el backend interpreta —con razón— como reutilización.
  const yaArranco = useRef(false);

  useEffect(() => {
    if (yaArranco.current) return;
    yaArranco.current = true;

    void (async () => {
      try {
        const datos = await api.sesion.refrescar();
        guardarAccessToken(datos.accessToken);
        setUsuario(datos.usuario);
        setEstado('autenticado');
      } catch {
        // No hay sesión que recuperar: es el caso normal del primer ingreso.
        setEstado('anonimo');
      }
    })();
  }, []);

  // Cuando el cliente de API agota los reintentos, la sesión murió de verdad.
  useEffect(() => {
    alCaerLaSesion(() => {
      guardarAccessToken(undefined);
      setUsuario(undefined);
      setEstado('anonimo');
    });
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const datos = await api.sesion.login(email, password);
    guardarAccessToken(datos.accessToken);
    setUsuario(datos.usuario);
    setEstado('autenticado');
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await api.sesion.logout();
    } catch (error) {
      // Si el servidor no responde, la sesión local se cierra igual: dejar al
      // usuario adentro porque falló una petición sería lo contrario de lo que
      // pidió. El refresh token caduca solo.
      if (!(error instanceof ErrorApi)) throw error;
    } finally {
      guardarAccessToken(undefined);
      setUsuario(undefined);
      setEstado('anonimo');
    }
  }, []);

  const puede = useCallback(
    (permiso: string) => usuario?.permisos.includes(permiso) ?? false,
    [usuario],
  );

  const valor = useMemo<ValorContexto>(
    () => ({ estado, usuario, iniciarSesion, cerrarSesion, puede }),
    [estado, usuario, iniciarSesion, cerrarSesion, puede],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ValorContexto {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return valor;
}
