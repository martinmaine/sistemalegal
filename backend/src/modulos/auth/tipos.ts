/** Identidad del usuario autenticado, tal como la transporta el access token. */
export interface SesionUsuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  /** ADMIN | JEFE_ESTUDIO | EMPLEADO */
  rol: string;
  rolNombre: string;
  /** Menor número = más privilegios (ver comentario de rol.jerarquia en la migración 003). */
  jerarquia: number;
  /** Códigos modulo.accion que el rol tiene habilitados. */
  permisos: string[];
}

/** Fila de usuario con su rol, tal como la devuelve el repositorio. */
export interface UsuarioConRol {
  id: string;
  email: string;
  password_hash: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  activo: boolean;
  rol: string;
  rol_nombre: string;
  jerarquia: number;
}

export interface ResultadoLogin {
  accessToken: string;
  refreshToken: string;
  expiraRefreshEn: Date;
  usuario: SesionUsuario;
}
