import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
  server: {
    // Honour PORT so a second dev server can run alongside the default one.
    port: Number(process.env.PORT) || 5183,
  },
});
