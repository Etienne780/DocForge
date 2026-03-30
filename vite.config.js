import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'renderer',
  base: './',
  build: {
    outDir: '../renderer/dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'renderer/core'),
      '@data': path.resolve(__dirname, 'renderer/data'),
      '@common': path.resolve(__dirname, 'renderer/common'),
      '@views': path.resolve(__dirname, 'renderer/views')
    }
  }
});