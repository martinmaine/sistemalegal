import type { CookieOptions, Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { ErrorAutenticacion } from '../../comun/errores';
import * as servicio from './servicio';
import type { DatosLogin } from './esquemas';
import type { ResultadoLogin } from './tipos';

/**
 * Controlador de autenticación.
 *
 * El refresh token viaja en una cookie httpOnly y **nunca** en el cuerpo de la
 * respuesta: así un XSS no puede leerlo desde JavaScript. El access token, en
 * cambio, sí va en el cuerpo, porque el frontend lo guarda en memoria y lo
 * manda en la cabecera Authorization.
 */

export const COOKIE_REFRESH = 'sl_refresh';

function opcionesCookie(expira: Date): CookieOptions {
  const enProduccion = config.entorno === 'production';
  return {
    httpOnly: true,
    // En producción el frontend (Vercel) y la API (Render) están en dominios
    // distintos, así que la cookie tiene que ser SameSite=None, y eso exige
    // Secure. En local ambos son localhost: alcanza con Lax sobre http.
    secure: enProduccion,
    sameSite: enProduccion ? 'none' : 'lax',
    // La cookie solo hace falta en los endpoints que la consumen; no se manda
    // en cada petición a /api.
    path: '/api/auth',
    expires: expira,
  };
}

function responderConSesion(res: Response, resultado: ResultadoLogin): void {
  res.cookie(COOKIE_REFRESH, resultado.refreshToken, opcionesCookie(resultado.expiraRefreshEn));
  res.json({
    accessToken: resultado.accessToken,
    expiraEnMinutos: config.minutosAccessToken,
    usuario: resultado.usuario,
  });
}

function contexto(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
}

export async function postLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await servicio.iniciarSesion(req.body as DatosLogin, contexto(req));
    responderConSesion(res, resultado);
  } catch (error) {
    next(error);
  }
}

export async function postRefrescar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE_REFRESH] as string | undefined;
    if (!token) throw new ErrorAutenticacion('No hay una sesión para renovar.');

    const resultado = await servicio.refrescarSesion(token, contexto(req));
    responderConSesion(res, resultado);
  } catch (error) {
    // Una sesión que no se puede renovar es una sesión terminada: se limpia la
    // cookie para que el navegador no siga reintentando con un token muerto.
    res.clearCookie(COOKIE_REFRESH, { ...opcionesCookie(new Date(0)), expires: undefined });
    next(error);
  }
}

export async function postLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await servicio.cerrarSesion(req.cookies?.[COOKIE_REFRESH] as string | undefined);
    res.clearCookie(COOKIE_REFRESH, { ...opcionesCookie(new Date(0)), expires: undefined });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function getPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // requiereSesion ya garantizó que req.sesion existe.
    res.json({ usuario: await servicio.perfil(req.sesion!.id) });
  } catch (error) {
    next(error);
  }
}
