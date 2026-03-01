import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // /admin/login など SPA のパスルーティングを index.html にフォールバック
    historyApiFallback: true,
  },
  preview: {
    historyApiFallback: true,
  },
})
