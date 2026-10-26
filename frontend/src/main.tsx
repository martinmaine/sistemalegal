import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/estructura.css';

/**
 * Punto de entrada.
 *
 * El orden de las hojas de estilo importa: los tokens definen las variables que
 * usan las demás, y la estructura se carga última porque sus reglas de pantalla
 * chica tienen que poder ajustar a los componentes.
 */

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el nodo #raiz en index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
