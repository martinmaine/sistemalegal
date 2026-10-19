import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Las pruebas de integración abren conexiones a PostgreSQL; un único
    // proceso evita agotar el pool de conexiones de Neon en la capa gratuita.
    fileParallelism: false,
  },
});
