import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import packageJson from './package.json';

/**
 * electron-vite Configuration for TaskMaster UI
 * 2025 Best Practices Implementation
 * 
 * This configuration consolidates the previous separate Vite configs for:
 * - Main process (electron/main.ts → dist/electron/main.cjs)
 * - Preload script (electron/preload.ts → dist/electron/preload.cjs)  
 * - Renderer process (src/ → dist/renderer)
 * 
 * Features:
 * - TypeScript support across all processes
 * - Path aliases for clean imports
 * - Security-focused CSP and headers
 * - Source maps for debugging
 * - Dependency externalization for optimal builds
 * - React support with hot reloading
 */
export default defineConfig({
  /**
   * Main Process Configuration
   * Builds the Electron main process from TypeScript
   */
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/main.ts'),
        formats: ['cjs'],
        fileName: () => 'main.cjs',
      },
      outDir: 'dist/electron',
      emptyOutDir: false, // Don't clean the directory to preserve preload script
      rollupOptions: {
        external: [
          // Core Electron modules
          'electron',
          'electron-updater',
          
          // Node.js built-in modules  
          'path',
          'os',
          'fs',
          'child_process',
          'module',
          'url',
          'crypto',
          'http',
          'https',
          'stream',
          'util',
          
          // All package.json dependencies should be external for main process
          ...Object.keys(packageJson.dependencies || {}),
        ],
        output: {
          // Preserve import.meta.url for ES modules compatibility
          preserveModules: false,
        }
      },
      minify: false, // Keep readable for debugging and security auditing
      sourcemap: true,
      // Target Node.js environment
      ssr: true,
      target: 'node18',
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@lib': resolve(__dirname, './src/lib'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@types': resolve(__dirname, './src/types'),
        '@store': resolve(__dirname, './src/store'),
        '@utils': resolve(__dirname, './src/utils'),
      },
    },
    define: {
      // Define __dirname for use in main process
      __dirname: `"${resolve(__dirname, 'dist', 'electron')}"`,
      'import.meta.url': 'import.meta.url',
    },
  },

  /**
   * Preload Script Configuration  
   * Builds the secure bridge between main and renderer processes
   */
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts'),
        formats: ['cjs'],
        fileName: () => 'preload.cjs',
      },
      outDir: 'dist/electron',
      emptyOutDir: false, // Don't clean the directory to preserve main script
      rollupOptions: {
        external: [
          'electron', // Only electron needs to be external for preload
        ],
        output: {
          format: 'cjs',
          exports: 'auto',
          inlineDynamicImports: true,
        }
      },
      minify: false, // Keep readable for security auditing
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
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@lib': resolve(__dirname, './src/lib'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@types': resolve(__dirname, './src/types'),
        '@store': resolve(__dirname, './src/store'),
        '@utils': resolve(__dirname, './src/utils'),
      },
    },
  },

  /**
   * Renderer Process Configuration
   * Builds the React frontend with security and performance optimizations
   * Configured to work with existing project structure (index.html in root)
   */
  renderer: {
    plugins: [react()],
    root: resolve(__dirname, '.'), // Use current directory as root
    base: './', // Important for Electron - use relative paths
    build: {
      rollupOptions: {
        input: {
          // Use named input to specify the HTML entry point
          index: resolve(__dirname, 'index.html')
        },
        output: {
          // Prevent information leakage through build output
          manualChunks: undefined,
        }
      },
      outDir: 'dist/renderer',
      // Enable source maps for development, disable for production security
      sourcemap: process.env.NODE_ENV === 'development',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === 'production',
          drop_debugger: true
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@lib': resolve(__dirname, './src/lib'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@types': resolve(__dirname, './src/types'),
        '@store': resolve(__dirname, './src/store'),
        '@utils': resolve(__dirname, './src/utils'),
      },
    },
    server: {
      port: 5173, // Standard Vite dev server port
      strictPort: false, // Allow fallback ports if 5173 is taken
      headers: {
        // Content Security Policy - 2025 Security Best Practices
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Vite dev needs unsafe-eval
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Material-UI needs unsafe-inline, Google Fonts
          "img-src 'self' data: blob:",
          "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com", // Added Google Fonts
          "connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:*",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'"
        ].join('; '),
        
        // Additional Security Headers - 2025 Best Practices
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': [
          'accelerometer=()',
          'camera=()',
          'geolocation=()',
          'gyroscope=()',
          'magnetometer=()',
          'microphone=()',
          'payment=()',
          'usb=()'
        ].join(', ')
      }
    },
  }
});