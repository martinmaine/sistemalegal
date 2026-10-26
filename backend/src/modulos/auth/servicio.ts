import { compare } from 'bcryptjs';
import { ErrorAutenticacion } from '../../comun/errores';
import * as repositorio from './repositorio';
import {
  firmarAccessToken,
  generarRefreshToken,
  hashRefreshToken,
  vencimientoRefreshToken,
} from './tokens';
import type { DatosLogin } from './esquemas';
import type { ResultadoLogin, SesionUsuario, UsuarioConRol } from './tipos';

/** Reglas de negocio de la autenticación. */

interface ContextoPeticion {
  ip?: string;
  userAgent?: string;
}

/**
 * Mensaje único para credenciales inválidas.
 *
 * No distingue «ese correo no existe» de «la contraseña es incorrecta»: si lo
 * hiciera, el formulario de login serviría para averiguar qué direcciones
 * tienen cuenta en el estudio.
 */
const CREDENCIALES_INVALIDAS = 'El correo o la contraseña no son correctos.';

export async function iniciarSesion(datos: DatosLogin, contexto: ContextoPeticion): Promise<ResultadoLogin> {
  const usuario = await repositorio.buscarPorEmail(datos.email);

  // Se compara contra un hash igualmente cuando el usuario no existe, para que
  // el tiempo de respuesta no delate si el correo está registrado.
  const hashAComparar = usuario?.password_hash ?? HASH_SEÑUELO;
  const coincide = await compare(datos.password, hashAComparar);

  if (!usuario || !coincide) {
    throw new ErrorAutenticacion(CREDENCIALES_INVALIDAS);
  }
  if (!usuario.activo) {
    throw new ErrorAutenticacion('Tu cuenta está desactivada. Contactá al administrador del estudio.');
  }

  const sesion = await armarSesion(usuario);
  await repositorio.registrarAcceso(usuario.id);

  const { refreshToken, expiraRefreshEn } = await emitirRefreshToken(usuario.id, contexto);
  return { accessToken: firmarAccessToken(sesion), refreshToken, expiraRefreshEn, usuario: sesion };
}

/**
 * Hash bcrypt de una contraseña que nadie conoce.
 *
 * Existe solo para que el login tarde lo mismo exista o no el usuario. El valor
 * es un bcrypt válido, así que compare() hace el trabajo completo.
 */
const HASH_SEÑUELO = '$2a$10$N9qo8uLOickgx2ZMRZoMye1VdLLFPDLxQxQGPDhOx7QpLx8bkZ8Gu';

/**
 * Renueva la sesión y **rota** el refresh token: el usado se revoca y se emite
 * uno nuevo. Así, una copia robada deja de servir en cuanto el usuario legítimo
 * renueva, y su reutilización se vuelve detectable.
 */
export async function refrescarSesion(
  refreshToken: string,
  contexto: ContextoPeticion,
): Promise<ResultadoLogin> {
  const hash = hashRefreshToken(refreshToken);
  const fila = await repositorio.buscarRefreshToken(hash);

  if (!fila) {
    throw new ErrorAutenticacion('Tu sesión no es válida. Volvé a iniciar sesión.');
  }

  if (fila.revocado_en) {
    // Alguien está usando un token ya consumido: o es una copia robada, o es el
    // usuario legítimo después de que le robaran la suya. En ambos casos lo
    // correcto es cortar todas las sesiones de esa cuenta.
    await repositorio.revocarSesionesDe(fila.usuario_id);
    throw new ErrorAutenticacion('Se detectó un uso indebido de la sesión. Volvé a iniciar sesión.');
  }

  if (fila.expira_en.getTime() <= Date.now()) {
    throw new ErrorAutenticacion('Tu sesión expiró. Volvé a iniciar sesión.');
  }

  const usuario = await repositorio.buscarPorId(fila.usuario_id);
  if (!usuario || !usuario.activo) {
    await repositorio.revocarSesionesDe(fila.usuario_id);
    throw new ErrorAutenticacion('Tu cuenta ya no está activa.');
  }

  await repositorio.revocarRefreshToken(hash);

  const sesion = await armarSesion(usuario);
  const { refreshToken: nuevo, expiraRefreshEn } = await emitirRefreshToken(usuario.id, contexto);
  return { accessToken: firmarAccessToken(sesion), refreshToken: nuevo, expiraRefreshEn, usuario: sesion };
}

export async function cerrarSesion(refreshToken: string | undefined): Promise<void> {
  // Cerrar sesión siempre "funciona": si el token ya no sirve, el resultado
  // para el usuario es el mismo y no hay nada que informar.
  if (!refreshToken) return;
  await repositorio.revocarRefreshToken(hashRefreshToken(refreshToken));
}

/** Perfil fresco desde la base, para cuando el frontend recarga con un token vigente. */
export async function perfil(usuarioId: string): Promise<SesionUsuario> {
  const usuario = await repositorio.buscarPorId(usuarioId);
  if (!usuario || !usuario.activo) {
    throw new ErrorAutenticacion('Tu cuenta ya no está activa.');
  }
  return armarSesion(usuario);
}

async function armarSesion(usuario: UsuarioConRol): Promise<SesionUsuario> {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol: usuario.rol,
    rolNombre: usuario.rol_nombre,
    jerarquia: usuario.jerarquia,
    permisos: await repositorio.permisosDe(usuario.id),
  };
}

async function emitirRefreshToken(
  usuarioId: string,
  contexto: ContextoPeticion,
): Promise<Pick<ResultadoLogin, 'refreshToken' | 'expiraRefreshEn'>> {
  const refreshToken = generarRefreshToken();
  const expiraRefreshEn = vencimientoRefreshToken();

  await repositorio.guardarRefreshToken({
    usuarioId,
    tokenHash: hashRefreshToken(refreshToken),
    expiraEn: expiraRefreshEn,
    ip: contexto.ip,
    userAgent: contexto.userAgent,
  });

  return { refreshToken, expiraRefreshEn };
}
