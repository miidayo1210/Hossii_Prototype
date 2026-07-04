import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Navigator LockManager の競合（複数タブ同時アクセス時のタイムアウト）を回避するため、
// ロック取得をスキップして直接実行するカスタムロックを設定する。
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn(),
  },
});

export const isSupabaseConfigured =
  typeof supabaseUrl === 'string' && supabaseUrl.startsWith('https://') &&
  typeof supabaseAnonKey === 'string' && supabaseAnonKey.length > 0;

/** DB 接続先の比較用（local dev と deploy が同じ Supabase か確認） */
export function getSupabaseProjectHost(): string | null {
  if (!isSupabaseConfigured) return null;
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return null;
  }
}
