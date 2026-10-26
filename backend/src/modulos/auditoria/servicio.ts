import type { Request } from 'express';
import { obtenerPool } from '../../db';

/**
 * Registro de auditoría.
 *
 * La tabla existía desde el esquema inicial y hasta ahora nadie escribía en
 * ella. Se registra toda operación que modifica datos: quién, qué, cuándo y
 * desde dónde.
 *
 * Dos decisiones:
 *
 *  - **Nunca interrumpe la operación.** Si el registro falla, se loguea y se
 *    sigue: perder una línea de auditoría es malo, pero hacer fracasar el alta
 *    de un expediente porque la auditoría falló es peor.
 *  - **No guarda password_hash ni tokens.** Los campos sensibles se filtran
 *    antes de serializar, porque datos_antes/datos_despues son JSONB y
 *    quedarían en claro para cualquiera que consulte la auditoría.
 */

export type AccionAuditada = 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR' | 'CONSULTAR' | 'EXPORTAR';

const CAMPOS_SENSIBLES = new Set(['password_hash', 'password', 'token_hash', 'refresh_token']);

function limpiar(datos: unknown): unknown {
  if (datos === null || typeof datos !== 'object') return datos;
  if (Array.isArray(datos)) return datos.map(limpiar);

  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(datos as Record<string, unknown>)) {
    salida[clave] = CAMPOS_SENSIBLES.has(clave) ? '[omitido]' : limpiar(valor);
  }
  return salida;
}

export interface EventoAuditoria {
  entidad: string;
  entidadId?: string;
  accion: AccionAuditada;
  datosAntes?: unknown;
  datosDespues?: unknown;
}

export async function registrar(req: Request, evento: EventoAuditoria): Promise<void> {
  try {
    await obtenerPool().query(
      `INSERT INTO auditoria (usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.sesion?.id ?? null,
        evento.entidad,
        evento.entidadId ?? null,
        evento.accion,
        evento.datosAntes === undefined ? null : JSON.stringify(limpiar(evento.datosAntes)),
        evento.datosDespues === undefined ? null : JSON.stringify(limpiar(evento.datosDespues)),
        req.ip ?? null,
        req.get('user-agent')?.slice(0, 300) ?? null,
      ],
    );
  } catch (error) {
    console.error('[auditoria] no se pudo registrar el evento', evento.entidad, evento.accion, error);
  }
}
