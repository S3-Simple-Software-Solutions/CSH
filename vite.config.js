const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8088',
      '/admin/api': 'http://127.0.0.1:8088',
      '/admin/sign-in': 'http://127.0.0.1:8088',
      '/admin/logout': 'http://127.0.0.1:8088',
    },
  },
});
