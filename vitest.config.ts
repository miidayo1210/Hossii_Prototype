import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React コンポーネントの render テスト（*.test.tsx）で JSX を automatic runtime に固定する。
  // これがないと esbuild の classic runtime にフォールバックし「React is not defined」で落ちる。
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    env: {
      VITE_APP_ENV: '',
      VITE_EXPECTED_SUPABASE_REF: '',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
});
