import { useEffect, useState } from 'react';
import { api, ErrorApi } from './servicios/api';
import type { Causa, EstadoSalud } from './tipos/causa';

/**
 * Pantalla de verificación del despliegue.
 *
 * No es una vista del producto: su trabajo es demostrar que la cadena completa
 * —SPA en Vercel, API en Render, PostgreSQL en Neon— responde de punta a punta.
 * Las vistas de los módulos la reemplazan a partir del Sprint S1.
 */

type Carga = 'cargando' | 'listo' | 'error';

export function App() {
  const [salud, setSalud] = useState<EstadoSalud>();
  const [causas, setCausas] = useState<Causa[]>([]);
  const [total, setTotal] = useState(0);
  const [carga, setCarga] = useState<Carga>('cargando');
  const [error, setError] = useState<string>();
  const [demorado, setDemorado] = useState(false);

  useEffect(() => {
    // Si la respuesta tarda, avisamos que el servicio gratuito está despertando
    // en lugar de dejar la pantalla en blanco.
    const avisoDemora = setTimeout(() => setDemorado(true), 3000);

    async function cargar() {
      try {
        const [estado, listado] = await Promise.all([api.salud(), api.causas()]);
        setSalud(estado);
        setCausas(listado.causas);
        setTotal(listado.total);
        setCarga('listo');
      } catch (e) {
        setError(e instanceof ErrorApi ? e.message : 'Error inesperado');
        setCarga('error');
      } finally {
        clearTimeout(avisoDemora);
        setDemorado(false);
      }
    }

    void cargar();
    return () => clearTimeout(avisoDemora);
  }, []);

  return (
    <main className="contenedor">
      <h1>Sistema de Gestión Integral para Estudios Jurídicos</h1>
      <p className="subtitulo">
        Verificación del despliegue — Sprint S0. La aplicación empieza en el Sprint S1.
      </p>

      <section className="tarjeta">
        <dl className="estado">
          <div>
            <dt>API</dt>
            <dd className={carga === 'error' ? 'mal' : 'ok'}>
              {carga === 'cargando' ? 'consultando…' : carga === 'error' ? 'sin respuesta' : 'ok'}
            </dd>
          </div>
          <div>
            <dt>Base de datos</dt>
            <dd className={salud?.base === 'conectada' ? 'ok' : 'mal'}>
              {salud ? salud.base : '—'}
            </dd>
          </div>
          <div>
            <dt>Entorno</dt>
            <dd>{salud?.entorno ?? '—'}</dd>
          </div>
          <div>
            <dt>Origen</dt>
            <dd>
              <code>{api.urlBase}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="tarjeta">
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>
          Causas cargadas {carga === 'listo' && <span className="aviso">({total} en total)</span>}
        </h2>

        {carga === 'cargando' && (
          <p className="aviso">
            {demorado
              ? 'La API está despertando: en el plan gratuito de Render la primera llamada puede tardar casi un minuto.'
              : 'Cargando…'}
          </p>
        )}

        {carga === 'error' && (
          <p className="aviso mal">
            {error}. Revisá que el backend esté levantado y que <code>VITE_API_URL</code> apunte al
            lugar correcto.
          </p>
        )}

        {carga === 'listo' && causas.length === 0 && (
          <p className="aviso">
            La API respondió, pero no hay causas. Faltan aplicar los seeds (
            <code>database/seed/</code>).
          </p>
        )}

        {carga === 'listo' && causas.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Expediente</th>
                <th>Carátula</th>
                <th>Fuero</th>
                <th>Estado</th>
                <th>Inicio</th>
              </tr>
            </thead>
            <tbody>
              {causas.map((causa) => (
                <tr key={causa.id}>
                  <td>{causa.numero_expediente ?? 'sin radicar'}</td>
                  <td>{causa.caratula}</td>
                  <td>{causa.fuero}</td>
                  <td>{causa.estado}</td>
                  <td>{causa.fecha_inicio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="aviso">
        Datos ficticios de <code>database/seed/002_datos_demo.sql</code>. Ningún dato real de
        personas.
      </p>
    </main>
  );
}
