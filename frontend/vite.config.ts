import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // host: true hace que el servidor escuche fuera del contenedor de docker compose.
    host: true,
    port: 5173,
  },
});
