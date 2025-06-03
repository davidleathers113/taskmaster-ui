import { defineConfig } from 'vite';
import path from 'path';
import packageJson from './package.json';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'main.cjs',
    },
    outDir: 'dist/main',
    emptyOutDir: false, // Don't clean the directory
    rollupOptions: {
      external: [
        'electron',
        'electron-updater', 
        'electron-squirrel-startup',
        'path',
        'os',
        'fs', // Add fs as external
        'child_process', // Add child_process as external
        'module', // Add module as external
        'url', // Add url as external
        ...Object.keys(packageJson.dependencies || {}),
      ],
      output: {
        // Preserve import.meta.url
        preserveModules: false,
      }
    },
    minify: false, // Keep readable for debugging
    sourcemap: true,
    // Ensure Node.js target
    ssr: true,
    target: 'node18',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __dirname: '"' + path.resolve(__dirname, 'dist', 'electron') + '"',
    'import.meta.url': 'import.meta.url',
  },
});