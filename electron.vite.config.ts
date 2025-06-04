import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import packageJson from './package.json';

/**
 * Environment Variables Type Definitions for 2025 Type Safety
 */
interface TaskMasterEnv {
  readonly MAIN_VITE_API_URL?: string;
  readonly PRELOAD_VITE_DEBUG?: string;
  readonly RENDERER_VITE_SENTRY_DSN?: string;
  readonly VITE_APP_VERSION?: string;
  readonly NODE_ENV?: 'development' | 'production' | 'test';
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends TaskMasterEnv {}
  }
}

/**
 * electron-vite TypeScript Configuration for TaskMaster UI
 * 2025 Best Practices Implementation with Enhanced Type Safety
 * 
 * This unified configuration consolidates all Electron process builds:
 * - Main process (src/main/index.ts → dist/main/main.cjs)
 * - Preload script (src/preload/index.ts → dist/preload/preload.cjs)  
 * - Renderer process (src/renderer → dist/renderer)
 * 
 * Key 2025 Features:
 * - Full TypeScript support with strict type checking
 * - Conditional configuration based on mode and command
 * - Enhanced security with CSP and modern headers
 * - Intelligent code splitting and bundle optimization
 * - Development vs Production environment handling
 * - Path aliases for maintainable imports
 * - Performance monitoring and bundle analysis
 */
export default defineConfig(({ command, mode }) => {
  const isDevelopment = mode === 'development';
  const isProduction = mode === 'production';
  const isServe = command === 'serve';
  const isBuild = command === 'build';

  // Base configuration shared across all processes
  const baseConfig = {
    build: {
      sourcemap: isDevelopment,
      minify: isProduction ? 'terser' as const : false,
      target: 'node18' as const,
    },
    define: {
      __DEV__: isDevelopment,
      __PROD__: isProduction,
      'process.env.NODE_ENV': JSON.stringify(mode),
    } as Record<string, any>,
  };

  return {
    /**
     * Main Process Configuration
     * Electron main process with Node.js environment targeting
     */
    main: {
      ...baseConfig,
      plugins: [externalizeDepsPlugin()],
      publicDir: 'resources',
      build: {
        ...baseConfig.build,
        lib: {
          entry: resolve(__dirname, 'src/main/index.ts'),
          formats: ['cjs'] as const,
          fileName: () => 'main.cjs',
        },
        outDir: 'dist/main',
        emptyOutDir: false,
        watch: isDevelopment ? {
          include: ['src/main/**/*'],
          exclude: ['node_modules/**', 'dist/**', 'out/**'],
          buildDelay: 100,
          clearScreen: false,
        } : undefined,
        rollupOptions: {
          external: [
            // Core Electron modules
            'electron',
            'electron-updater',
            
            // Node.js built-in modules  
            'path', 'os', 'fs', 'child_process', 'module', 'url', 
            'crypto', 'http', 'https', 'stream', 'util', 'events',
            
            // All package.json dependencies external for main process
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {}),
          ],
          output: {
            preserveModules: false,
            format: 'cjs' as const,
            exports: 'auto' as const,
          }
        },
        ssr: true,
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
          '@tests': resolve(__dirname, './tests'),
        },
      },
      define: {
        ...baseConfig.define,
        __dirname: `"${resolve(__dirname, 'dist', 'main')}"`,
        'import.meta.url': 'import.meta.url',
      },
    },

    /**
     * Preload Script Configuration  
     * Secure bridge between main and renderer with sandbox compatibility
     */
    preload: {
      ...baseConfig,
      plugins: [externalizeDepsPlugin()],
      publicDir: 'resources',
      build: {
        ...baseConfig.build,
        lib: {
          entry: resolve(__dirname, 'src/preload/index.ts'),
          formats: ['cjs'] as const,
          fileName: () => 'preload.cjs',
        },
        outDir: 'dist/preload',
        emptyOutDir: false,
        watch: isDevelopment ? {
          include: ['src/preload/**/*'],
          exclude: ['node_modules/**', 'dist/**', 'out/**'],
          buildDelay: 100,
          clearScreen: false,
        } : undefined,
        rollupOptions: {
          external: ['electron'],
          output: {
            format: 'cjs' as const,
            exports: 'auto' as const,
            inlineDynamicImports: true,
          }
        },
        ssr: true,
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
          '@tests': resolve(__dirname, './tests'),
        },
      },
    },

    /**
     * Renderer Process Configuration
     * React frontend with enhanced security, performance, and type safety
     */
    renderer: {
      ...baseConfig,
      plugins: [
        react({
          // 2025 React configuration optimizations - simplified for compatibility
        }),
        
        // Bundle analysis for 2025 performance monitoring
        ...(isBuild ? [
          visualizer({
            filename: 'dist/bundle-analysis.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap' as const,
          }),
        ] : []),
      ],
      root: resolve(__dirname, './src/renderer'),
      publicDir: resolve(__dirname, './src/renderer/public'),
      base: './',
      build: {
        ...baseConfig.build,
        rollupOptions: {
          input: {
            index: resolve(__dirname, './src/renderer/index.html')
          },
          output: {
            // 2025 Intelligent Code Splitting Strategy
            manualChunks: (id: string): string | void => {
              // Node modules chunking strategy
              if (id.includes('node_modules')) {
                // React ecosystem
                if (id.includes('react') || id.includes('react-dom')) {
                  return 'react-vendor';
                }
                // Material-UI ecosystem
                if (id.includes('@mui') || id.includes('@emotion')) {
                  return 'mui-vendor';
                }
                // Animation libraries
                if (id.includes('framer-motion')) {
                  return 'animation-vendor';
                }
                // Icon libraries
                if (id.includes('lucide-react')) {
                  return 'icons-vendor';
                }
                // State management
                if (id.includes('zustand') || id.includes('immer')) {
                  return 'state-vendor';
                }
                // Utilities
                if (id.includes('date-fns') || id.includes('clsx') || id.includes('class-variance-authority')) {
                  return 'utils-vendor';
                }
                // Other vendor libraries
                return 'vendor';
              }
              
              // Application code chunking
              if (id.includes('src/components/views/')) {
                return 'views';
              }
              if (id.includes('src/components/project/')) {
                return 'project';
              }
              if (id.includes('src/store/')) {
                return 'store';
              }
            },
            // 2025 Asset optimization
            chunkFileNames: isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js',
            entryFileNames: isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js',
            assetFileNames: isProduction ? 'assets/[name]-[hash].[ext]' : 'assets/[name].[ext]',
          }
        },
        outDir: 'dist/renderer',
        terserOptions: isProduction ? {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info'],
          },
          mangle: {
            safari10: true,
          },
        } : undefined,
        // 2025 Performance optimizations
        reportCompressedSize: false, // Faster builds in CI
        chunkSizeWarningLimit: 1000,
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, './src/renderer/src'),
          '@components': resolve(__dirname, './src/renderer/src/components'),
          '@lib': resolve(__dirname, './src/renderer/src/lib'),
          '@hooks': resolve(__dirname, './src/renderer/src/hooks'),
          '@types': resolve(__dirname, './src/renderer/src/types'),
          '@store': resolve(__dirname, './src/renderer/src/store'),
          '@utils': resolve(__dirname, './src/renderer/src/utils'),
          '@tests': resolve(__dirname, './tests'),
        },
      },
      server: isServe ? {
        port: 5173,
        strictPort: false,
        cors: true,
        headers: {
          // 2025 Enhanced Security Headers
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Vite dev needs unsafe-eval
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
            "connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests"
          ].join('; '),
          
          // Additional 2025 Security Headers
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Permissions-Policy': [
            'accelerometer=()',
            'camera=()',
            'geolocation=()',
            'gyroscope=()',
            'magnetometer=()',
            'microphone=()',
            'payment=()',
            'usb=()',
            'interest-cohort=()'
          ].join(', ')
        },
        // 2025 Development server optimizations
        hmr: {
          overlay: true,
          clientPort: 5173,
        },
        watch: {
          usePolling: false,
          interval: 100,
        },
      } : undefined,
      
      // Environment-specific optimizations
      optimizeDeps: isDevelopment ? {
        include: [
          'react',
          'react-dom',
          '@mui/material',
          '@emotion/react',
          '@emotion/styled',
          'framer-motion',
          'zustand',
        ],
        exclude: ['electron'],
      } : undefined,
    }
  };
});