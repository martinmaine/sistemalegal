import { describe, it, expect } from 'vitest';
import { origenAutorizado, config } from '../src/config';

/**
 * La allowlist de CORS es lo único que separa a la API de que cualquier sitio
 * la consuma desde el navegador de un usuario logueado, así que conviene que
 * esté cubierta.
 */

describe('origenAutorizado', () => {
  const prefijo = config.prefijoPreviewVercel;

  it('autoriza el dominio de producción del proyecto', () => {
    expect(origenAutorizado(`https://${prefijo}.vercel.app`)).toBe(true);
  });

  it('autoriza los previews, que cambian de subdominio en cada push', () => {
    expect(origenAutorizado(`https://${prefijo}-abc123-equipo.vercel.app`)).toBe(true);
  });

  it('rechaza otros proyectos de Vercel', () => {
    expect(origenAutorizado('https://otroproyecto.vercel.app')).toBe(false);
  });

  it('rechaza un prefijo pegado sin guion, que no es un preview del proyecto', () => {
    expect(origenAutorizado(`https://${prefijo}malicioso.vercel.app`)).toBe(false);
  });

  it('rechaza subdominios anidados bajo otro dueño', () => {
    expect(origenAutorizado(`https://${prefijo}.ajeno.vercel.app`)).toBe(false);
  });

  it('rechaza dominios que solo se parecen: los puntos no son comodines', () => {
    expect(origenAutorizado(`https://${prefijo}xvercelyapp`)).toBe(false);
    expect(origenAutorizado(`https://${prefijo}.vercel.app.ajeno.com`)).toBe(false);
  });

  it('rechaza http, para que el origen no viaje sin TLS', () => {
    expect(origenAutorizado(`http://${prefijo}.vercel.app`)).toBe(false);
  });

  it('rechaza un origen con puerto, que es otro origen', () => {
    expect(origenAutorizado(`https://${prefijo}.vercel.app:8443`)).toBe(false);
  });

  it('rechaza basura que no es una URL', () => {
    expect(origenAutorizado('null')).toBe(false);
    expect(origenAutorizado('')).toBe(false);
  });

  it('autoriza lo que esté explícitamente en CORS_ORIGIN', () => {
    const permitido = config.origenesPermitidos[0];
    if (permitido) expect(origenAutorizado(permitido)).toBe(true);
  });
});
