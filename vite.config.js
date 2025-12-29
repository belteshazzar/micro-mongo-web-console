// vite.config.js
import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';

export default defineConfig({
  // Set base for GitHub Pages project site
  base: '/micro-mongo-web-console/',
  plugins: [
    commonjs(),
  ],
});
