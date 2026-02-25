import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Navigator LockManager の競合（複数タブ同時アクセス時のタイムアウト）を回避するため、
// ロック取得をスキップして直接実行するカスタムロックを設定する。
// 本番環境でも単一タブ運用を想定しているため、この設定を維持する。
const noOpLock: Parameters<typeof createClient>[2]['auth'] = {
  lock: async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn(),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: noOpLock,
});

export const isSupabaseConfigured =
  typeof supabaseUrl === 'string' && supabaseUrl.startsWith('https://') &&
  typeof supabaseAnonKey === 'string' && supabaseAnonKey.length > 0;
