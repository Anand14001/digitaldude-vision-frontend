import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    // Emitted but not linked from the bundles, so stack traces stay readable
    // via an error reporter without publishing the source to every visitor.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // Keep the vendor bundle separate so app deploys do not bust its cache.
        // Only genuinely shared dependencies belong here: naming a chunk makes
        // it a static import of the entry, which Vite then preloads on first
        // load. recharts is used by one lazy route, so it must stay inside that
        // route's chunk rather than being hoisted out of it.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
