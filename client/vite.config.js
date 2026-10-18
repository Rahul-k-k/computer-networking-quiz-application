import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The backend runs on :5000 by default (see server/.env). Override the proxy
// target with VITE_API_PROXY if your API lives elsewhere.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY || 'http://localhost:5000';
  return {
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
      },
    },
  };
});
