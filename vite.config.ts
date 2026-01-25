import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This base URL allows the app to run in a subdirectory (repo name)
  base: '/Kinan-touch-AD-google/',
  build: {
    // Output to 'docs' folder instead of 'dist'
    // This allows using "Source: /docs" in GitHub Pages settings without a workflow
    outDir: 'docs',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true
  }
});