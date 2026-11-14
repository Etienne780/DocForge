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
    emptyOutDir: true,
    // index (~720 kB) and SyntaxHighlightWorker (~820 kB) load locally in Electron
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      onLog(level, log, handler) {
        // dynamic imports are intentional to break circular imports
        if (log.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return;
        handler(level, log);
      }
    }
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