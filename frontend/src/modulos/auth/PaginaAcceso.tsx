import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Scale } from 'lucide-react';
import { useSesion } from './ContextoSesion';
import { ErrorApi } from '../../servicios/api';
import { Boton } from '../../componentes/ui/Boton';
import { CampoTexto } from '../../componentes/ui/Campo';
import { Cargando } from '../../componentes/ui/Estados';

/**
 * Pantalla de inicio de sesión.
 *
 * El error del servidor se muestra entero —no se traduce ni se resume— porque
 * el backend ya redacta mensajes pensados para el usuario, y porque distinguir
 * "credenciales incorrectas" de "cuenta desactivada" o "demasiados intentos"
 * es lo que evita que alguien pruebe su contraseña diez veces sin entender qué
 * está pasando.
 */

export function PaginaAcceso() {
  const { estado, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [erroresCampo, setErroresCampo] = useState<Record<string, string[]>>({});
  const [enviando, setEnviando] = useState(false);

  if (estado === 'comprobando') {
    return (
      <div className="acceso">
        <Cargando texto="Comprobando tu sesión…" />
      </div>
    );
  }

  if (estado === 'autenticado') {
    return <Navigate to="/" replace />;
  }

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    setError(undefined);
    setErroresCampo({});
    setEnviando(true);

    try {
      await iniciarSesion(email, password);
      // Vuelve a donde quería ir antes de que lo mandaran al login.
      const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/';
      navegar(destino, { replace: true });
    } catch (fallo) {
      if (fallo instanceof ErrorApi) {
        setError(fallo.message);
        setErroresCampo(fallo.detalles ?? {});
      } else {
        setError('No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.');
      }
      // La contraseña se limpia, el correo no: reescribir ambos en cada
      // intento fallido es una molestia sin ninguna ventaja de seguridad.
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="acceso">
      <div className="acceso__panel">
        <div className="acceso__marca">
          <span className="acceso__logo" aria-hidden>
            <Scale size={21} />
          </span>
          <span className="acceso__nombre">SistemaLegal</span>
        </div>

        <section className="tarjeta">
          <div className="tarjeta__cuerpo" style={{ paddingTop: 'var(--esp-6)' }}>
            <h1 className="tarjeta__titulo" style={{ marginBottom: 'var(--esp-1)' }}>
              Iniciá sesión
            </h1>
            <p className="tarjeta__descripcion" style={{ marginBottom: 'var(--esp-5)' }}>
              Ingresá con la cuenta que te dio el estudio.
            </p>

            <form onSubmit={enviar} noValidate className="pila">
              {error && (
                <div className="aviso aviso--peligro" role="alert">
                  <span className="aviso__cuerpo">{error}</span>
                </div>
              )}

              <CampoTexto
                etiqueta="Correo electrónico"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="nombre@estudio.com"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                error={erroresCampo.email?.[0]}
                obligatorio
                autoFocus
              />

              <CampoTexto
                etiqueta="Contraseña"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(evento) => setPassword(evento.target.value)}
                error={erroresCampo.password?.[0]}
                obligatorio
              />

              <Boton
                type="submit"
                variante="primario"
                bloque
                cargando={enviando}
                icono={<LogIn size={16} aria-hidden />}
              >
                {enviando ? 'Ingresando…' : 'Ingresar'}
              </Boton>
            </form>
          </div>
        </section>

        {/* Credenciales del entorno de demostración. Los datos son ficticios y
            la base se recrea en cada arranque; en una instalación real este
            bloque no existe. */}
        {import.meta.env.DEV && (
          <div className="acceso__demo">
            <strong>Entorno de demostración.</strong> Usuarios de{' '}
            <code>database/seed/002_datos_demo.sql</code>: <code>admin@estudiodemo.test</code>,{' '}
            <code>jefe@estudiodemo.test</code> o <code>empleado1@estudiodemo.test</code>, contraseña{' '}
            <code>Demo1234!</code>.
          </div>
        )}

        <p className="acceso__creditos">
          SistemaLegal — desarrollado por <strong>UTMA Technologies</strong>
        </p>
      </div>
    </div>
  );
}
