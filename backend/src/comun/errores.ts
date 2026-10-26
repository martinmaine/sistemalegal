/**
 * Errores de aplicación con código HTTP.
 *
 * El manejador central distingue estos errores de los inesperados: un
 * ErrorHttp es una condición prevista (falta un permiso, no existe el recurso)
 * y su mensaje está pensado para que el usuario lo lea, así que viaja al
 * cliente también en producción. Cualquier otro error se reporta como 500 sin
 * detalle, porque su mensaje puede contener datos internos.
 */

export class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    /** Código estable, en MAYUSCULA_CON_GUIONES, para que el frontend ramifique sin parsear el texto. */
    readonly codigo: string,
    mensaje: string,
    /** Errores por campo, en formato { campo: [mensajes] }. Lo usan los formularios. */
    readonly detalles?: Record<string, string[]>,
  ) {
    super(mensaje);
    this.name = 'ErrorHttp';
  }
}

export class ErrorSolicitud extends ErrorHttp {
  constructor(mensaje: string, detalles?: Record<string, string[]>) {
    super(400, 'SOLICITUD_INVALIDA', mensaje, detalles);
  }
}

export class ErrorAutenticacion extends ErrorHttp {
  constructor(mensaje = 'Necesitás iniciar sesión para continuar.') {
    super(401, 'NO_AUTENTICADO', mensaje);
  }
}

export class ErrorAutorizacion extends ErrorHttp {
  constructor(mensaje = 'No tenés permisos para realizar esta acción.') {
    super(403, 'SIN_PERMISO', mensaje);
  }
}

export class ErrorNoEncontrado extends ErrorHttp {
  constructor(mensaje = 'No se encontró el recurso solicitado.') {
    super(404, 'NO_ENCONTRADO', mensaje);
  }
}

export class ErrorConflicto extends ErrorHttp {
  constructor(mensaje: string, detalles?: Record<string, string[]>) {
    super(409, 'CONFLICTO', mensaje, detalles);
  }
}
