import { defineConfig } from 'vite';
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      '@wasm': path.resolve(__dirname, './omega_core/pkg/omega_core.js')
    }
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  }
});
