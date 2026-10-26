import { obtenerPool } from '../../db';
import type { UsuarioConRol } from './tipos';

/** Única capa que escribe SQL del módulo de autenticación. */

const SQL_USUARIO_POR_EMAIL = `
  SELECT u.id,
         u.email,
         u.password_hash,
         u.nombre,
         u.apellido,
         u.matricula,
         u.activo,
         r.codigo    AS rol,
         r.nombre    AS rol_nombre,
         r.jerarquia
    FROM usuario u
    JOIN rol r ON r.id = u.rol_id
   WHERE lower(u.email) = lower($1)
`;

export async function buscarPorEmail(email: string): Promise<UsuarioConRol | undefined> {
  const { rows } = await obtenerPool().query<UsuarioConRol>(SQL_USUARIO_POR_EMAIL, [email]);
  return rows[0];
}

const SQL_USUARIO_POR_ID = `
  SELECT u.id,
         u.email,
         u.password_hash,
         u.nombre,
         u.apellido,
         u.matricula,
         u.activo,
         r.codigo    AS rol,
         r.nombre    AS rol_nombre,
         r.jerarquia
    FROM usuario u
    JOIN rol r ON r.id = u.rol_id
   WHERE u.id = $1
`;

export async function buscarPorId(id: string): Promise<UsuarioConRol | undefined> {
  const { rows } = await obtenerPool().query<UsuarioConRol>(SQL_USUARIO_POR_ID, [id]);
  return rows[0];
}

const SQL_PERMISOS = `
  SELECT p.codigo
    FROM usuario u
    JOIN rol_permiso rp ON rp.rol_id = u.rol_id
    JOIN permiso p      ON p.id = rp.permiso_id
   WHERE u.id = $1
   ORDER BY p.codigo
`;

export async function permisosDe(usuarioId: string): Promise<string[]> {
  const { rows } = await obtenerPool().query<{ codigo: string }>(SQL_PERMISOS, [usuarioId]);
  return rows.map((fila) => fila.codigo);
}

export async function registrarAcceso(usuarioId: string): Promise<void> {
  await obtenerPool().query('UPDATE usuario SET ultimo_acceso_en = now() WHERE id = $1', [usuarioId]);
}

/** Guarda el hash del refresh token recién emitido. */
export async function guardarRefreshToken(datos: {
  usuarioId: string;
  tokenHash: string;
  expiraEn: Date;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  await obtenerPool().query(
    `INSERT INTO refresh_token (usuario_id, token_hash, expira_en, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [datos.usuarioId, datos.tokenHash, datos.expiraEn, datos.ip ?? null, datos.userAgent?.slice(0, 300) ?? null],
  );
}

export interface FilaRefreshToken {
  id: string;
  usuario_id: string;
  expira_en: Date;
  revocado_en: Date | null;
}

export async function buscarRefreshToken(tokenHash: string): Promise<FilaRefreshToken | undefined> {
  const { rows } = await obtenerPool().query<FilaRefreshToken>(
    'SELECT id, usuario_id, expira_en, revocado_en FROM refresh_token WHERE token_hash = $1',
    [tokenHash],
  );
  return rows[0];
}

export async function revocarRefreshToken(tokenHash: string): Promise<void> {
  await obtenerPool().query(
    'UPDATE refresh_token SET revocado_en = now() WHERE token_hash = $1 AND revocado_en IS NULL',
    [tokenHash],
  );
}

/**
 * Revoca todas las sesiones vivas de un usuario.
 *
 * Se usa al detectar la reutilización de un refresh token ya consumido: el
 * escenario más probable es que un atacante tenga una copia, así que se cortan
 * todas las sesiones y se obliga a volver a entrar.
 */
export async function revocarSesionesDe(usuarioId: string): Promise<void> {
  await obtenerPool().query(
    'UPDATE refresh_token SET revocado_en = now() WHERE usuario_id = $1 AND revocado_en IS NULL',
    [usuarioId],
  );
}
