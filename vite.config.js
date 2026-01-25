// vite.config.js
import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';

export default defineConfig({
  // Set base for GitHub Pages project site
  base: '/babymongo-web-console/',
  plugins: [
    commonjs(),
  ],
  server: {
    watch: {
      // Use a negated glob pattern to watch a specific package
      ignored: ['!**/node_modules/node-inspect-extracted/**'],
    },
  },
  optimizeDeps: {
    // Exclude the package from dependency pre-bundling
    exclude: ['node-inspect-extracted'],
  },});
