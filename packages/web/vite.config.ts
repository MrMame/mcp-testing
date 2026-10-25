import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Im Dev-Modus leitet Vite API- und WebSocket-Aufrufe an den Monitor-Server weiter.
const MONITOR = `http://127.0.0.1:${process.env.MONITOR_PORT ?? 3001}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': MONITOR,
      '/ws': { target: MONITOR.replace('http', 'ws'), ws: true },
    },
  },
});
