import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages sub-path.
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    // Disable HMR via env (used by sandboxed/agent-driven editors).
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
