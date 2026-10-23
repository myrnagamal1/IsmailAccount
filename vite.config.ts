import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/IsmailAccount/',
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist' },
});
