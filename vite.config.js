import { defineConfig } from 'vite';
import path from 'path';

const dirname = import.meta.dirname;

export default defineConfig({
  root: 'renderer',
  base: './',
  server: {
    hmr: {
        overlay: false,
    },
  },
  build: {
    outDir: '../renderer/dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@core': path.resolve(dirname, 'renderer/core'),
      '@data': path.resolve(dirname, 'renderer/data'),
      '@migration': path.resolve(dirname, 'renderer/migration'),
      '@common': path.resolve(dirname, 'renderer/common'),
      '@views': path.resolve(dirname, 'renderer/views'),
      '@ui': path.resolve(dirname, 'renderer/ui')
    }
  }
});