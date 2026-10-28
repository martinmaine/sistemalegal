import type { Request, Response, NextFunction } from 'express';
import { ErrorAutenticacion, ErrorAutorizacion } from '../comun/errores';
import { verificarAccessToken } from '../modulos/auth/tokens';

/**
 * Autenticación y autorización.
 *
 * Esta es la verificación que cuenta. El frontend oculta lo que el usuario no
 * puede hacer, pero eso es comodidad visual, no seguridad: quien llame la API
 * directamente pasa igual por acá.
 */

export function requiereSesion(req: Request, _res: Response, next: NextFunction): void {
  const cabecera = req.get('authorization');
  if (!cabecera?.startsWith('Bearer ')) {
    next(new ErrorAutenticacion());
    return;
  }

  try {
    req.sesion = verificarAccessToken(cabecera.slice('Bearer '.length).trim());
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Exige uno o más permisos concretos (formato modulo.accion).
 *
 * Se piden TODOS los indicados. Para alternativas conviene un permiso propio en
 * el catálogo antes que relajar la regla acá.
 */
export function requierePermiso(...codigos: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const sesion = req.sesion;
    if (!sesion) {
      next(new ErrorAutenticacion());
      return;
    }

    const faltantes = codigos.filter((codigo) => !sesion.permisos.includes(codigo));
    if (faltantes.length > 0) {
      next(new ErrorAutorizacion());
      return;
    }
    next();
  };
}

/** Atajo para "este usuario puede X", cuando la regla depende de los datos y no solo de la ruta. */
export function puede(req: Request, codigo: string): boolean {
  return req.sesion?.permisos.includes(codigo) ?? false;
}
