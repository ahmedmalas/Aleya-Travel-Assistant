import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';

function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitShortSha()),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            return 'vendor';
          }
          if (id.includes('/src/deal-engine/')) return 'deal-engine';
          if (id.includes('/src/finalisation/')) return 'finalisation';
          if (id.includes('/src/features/conversation-core/')) return 'conversation-core';
        },
      },
    },
  },
});
