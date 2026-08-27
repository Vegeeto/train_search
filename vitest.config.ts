import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom is needed for the component/functional tests; the service tests stub
    // `fetch` themselves so they are unaffected by the DOM environment.
    environment: 'jsdom',
    // An explicit non-opaque origin is required for jsdom to expose localStorage.
    environmentOptions: { jsdom: { url: 'http://localhost:3000/' } },
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
