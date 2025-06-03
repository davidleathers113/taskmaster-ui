import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Important for Electron - use relative paths
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer/src"),
      "@components": path.resolve(__dirname, "./src/renderer/src/components"),
      "@lib": path.resolve(__dirname, "./src/renderer/src/lib"),
      "@hooks": path.resolve(__dirname, "./src/renderer/src/hooks"),
      "@types": path.resolve(__dirname, "./src/renderer/src/types"),
      "@store": path.resolve(__dirname, "./src/renderer/src/store"),
      "@utils": path.resolve(__dirname, "./src/renderer/src/utils"),
    },
  },
  server: {
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
      
      // Additional Security Headers
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
  build: {
    outDir: 'dist/renderer', // Output for Electron renderer process
    rollupOptions: {
      output: {
        // Prevent information leakage through build output
        manualChunks: undefined,
      }
    },
    // Enable source maps for production debugging while maintaining security
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})