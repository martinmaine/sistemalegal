import type { SesionUsuario } from '../modulos/auth/tipos';

/**
 * Extensiones de los tipos de Express.
 *
 * `sesion` la completa el middleware de autenticación; `consulta` la deja el de
 * validación. Declararlas acá evita castear `req as any` en cada controlador.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Usuario autenticado. Indefinido en rutas públicas. */
      sesion?: SesionUsuario;
      /** Query string ya validada por validarConsulta(). */
      consulta?: unknown;
    }
  }
}

export {};
