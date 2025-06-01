import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'electron/preload.ts'),
      formats: ['cjs'],
      fileName: () => 'preload',
    },
    outDir: 'dist/electron',
    emptyOutDir: false, // Don't clean the directory
    rollupOptions: {
      external: [
        'electron'
      ],
      output: {
        format: 'cjs',
        exports: 'auto',
        inlineDynamicImports: true,
      }
    },
    minify: false, // Keep readable for debugging and security auditing
    sourcemap: true,
    // Target Node.js environment for preload scripts
    ssr: {
      noExternal: true,
      target: 'node',
    },
    target: 'node18',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});