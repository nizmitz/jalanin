/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
