import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { ErrorAutenticacion } from '../../comun/errores';
import type { SesionUsuario } from './tipos';

/**
 * Emisión y verificación de tokens.
 *
 * El access token lleva la identidad y los permisos dentro: así cada petición
 * se resuelve sin consultar la base. El precio es que un cambio de rol o de
 * permisos tarda en aplicarse lo que dure el token (15 minutos por defecto).
 * Es un intercambio deliberado, y es también la razón por la que la vida del
 * access token es corta.
 *
 * El refresh token, en cambio, NO es un JWT: es un valor aleatorio opaco cuyo
 * hash se guarda en la tabla refresh_token. Eso es lo que permite revocar una
 * sesión del lado del servidor, que un JWT autocontenido no permitiría.
 */

const EMISOR = 'sistemalegal';

interface ContenidoAccessToken {
  sub: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  rolNombre: string;
  jerarquia: number;
  permisos: string[];
}

export function firmarAccessToken(usuario: SesionUsuario): string {
  const contenido: ContenidoAccessToken = {
    sub: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol: usuario.rol,
    rolNombre: usuario.rolNombre,
    jerarquia: usuario.jerarquia,
    permisos: usuario.permisos,
  };

  return jwt.sign(contenido, config.secretoJwt, {
    algorithm: 'HS256',
    issuer: EMISOR,
    expiresIn: `${config.minutosAccessToken}m`,
  });
}

export function verificarAccessToken(token: string): SesionUsuario {
  let contenido: ContenidoAccessToken;
  try {
    // `algorithms` fijo: sin esta lista, un token con alg "none" o firmado con
    // otro algoritmo podría aceptarse. Es el error clásico de JWT.
    contenido = jwt.verify(token, config.secretoJwt, {
      algorithms: ['HS256'],
      issuer: EMISOR,
    }) as ContenidoAccessToken;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ErrorAutenticacion('Tu sesión expiró. Volvé a iniciar sesión.');
    }
    throw new ErrorAutenticacion('La sesión no es válida.');
  }

  return {
    id: contenido.sub,
    email: contenido.email,
    nombre: contenido.nombre,
    apellido: contenido.apellido,
    rol: contenido.rol,
    rolNombre: contenido.rolNombre,
    jerarquia: contenido.jerarquia,
    permisos: contenido.permisos ?? [],
  };
}

/** Valor opaco de 256 bits. No se guarda: lo que se persiste es su hash. */
export function generarRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 en hexadecimal, que es el formato que declara refresh_token.token_hash.
 *
 * Se usa SHA-256 y no bcrypt a propósito: el token ya es aleatorio de 256 bits,
 * así que no hay nada que proteger contra fuerza bruta, y un hash rápido
 * permite buscar la fila por igualdad en lugar de comparar contra cada fila.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function vencimientoRefreshToken(desde = new Date()): Date {
  const vencimiento = new Date(desde);
  vencimiento.setDate(vencimiento.getDate() + config.diasRefreshToken);
  return vencimiento;
}
