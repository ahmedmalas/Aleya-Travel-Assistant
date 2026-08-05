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
    // Mirror Vercel target so the architecture governor switch can default ON
    // for Preview/Draft builds only (never Production unless explicitly forced).
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(
      process.env.VERCEL_ENV ?? process.env.VITE_VERCEL_ENV ?? '',
    ),
    'import.meta.env.VITE_VERCEL_TARGET_ENV': JSON.stringify(
      process.env.VERCEL_TARGET_ENV ??
        process.env.VITE_VERCEL_TARGET_ENV ??
        process.env.VERCEL_ENV ??
        '',
    ),
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
