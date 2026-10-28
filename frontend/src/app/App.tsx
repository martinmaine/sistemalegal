import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProveedorSesion } from '../modulos/auth/ContextoSesion';
import { ProveedorAvisos } from '../componentes/ui/Avisos';
import { RutaProtegida } from '../modulos/auth/RutaProtegida';
import { AppShell } from '../componentes/layout/AppShell';
import { PaginaAcceso } from '../modulos/auth/PaginaAcceso';
import { PaginaPanel } from '../modulos/panel/PaginaPanel';
import { PaginaExpedientes } from '../modulos/causas/PaginaExpedientes';
import { PaginaExpediente } from '../modulos/causas/PaginaExpediente';
import { PaginaClientes } from '../modulos/personas/PaginaClientes';
import { PaginaAgenda } from '../modulos/agenda/PaginaAgenda';
import { PaginaCliente } from '../modulos/personas/PaginaCliente';
import { PaginaDiagnostico } from '../modulos/diagnostico/PaginaDiagnostico';
import { ErrorApi } from '../servicios/api';

/**
 * Raíz de la aplicación: proveedores y rutas.
 */

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      // Un expediente no cambia entre que se abre el listado y se entra al
      // detalle: medio minuto de frescura evita repetir consultas al navegar.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry(cantidad, error) {
        // No tiene sentido reintentar una sesión caída ni una falta de
        // permisos: el resultado va a ser el mismo. Los fallos de red sí.
        if (error instanceof ErrorApi && (error.esDeSesion || error.esDePermiso)) return false;
        return cantidad < 2;
      },
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <BrowserRouter>
        <ProveedorSesion>
          <ProveedorAvisos>
            <Routes>
              <Route path="/acceso" element={<PaginaAcceso />} />

              <Route element={<RutaProtegida />}>
                <Route element={<AppShell />}>
                  <Route index element={<PaginaPanel />} />
                  <Route path="expedientes" element={<PaginaExpedientes />} />
                  <Route path="expedientes/:id" element={<PaginaExpediente />} />
                  <Route path="clientes" element={<PaginaClientes />} />
                  <Route path="clientes/:id" element={<PaginaCliente />} />
                  <Route path="agenda" element={<PaginaAgenda />} />
                  <Route path="diagnostico" element={<PaginaDiagnostico />} />
                </Route>
              </Route>

              {/* Cualquier otra ruta vuelve al inicio en lugar de dejar la
                  pantalla en blanco. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ProveedorAvisos>
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
