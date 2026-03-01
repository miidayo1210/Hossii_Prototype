import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // /admin/login など SPA のパスルーティングを index.html にフォールバック
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error historyApiFallback は Vite の型定義に含まれないが実行時は有効
    historyApiFallback: true,
  },
  preview: {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error historyApiFallback は Vite の型定義に含まれないが実行時は有効
    historyApiFallback: true,
  },
})
