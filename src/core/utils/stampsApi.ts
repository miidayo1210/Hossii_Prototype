import { supabase, isSupabaseConfigured } from '../supabase';

/**
 * ログイン済みユーザーのスタンプ数を Supabase から取得する
 * Supabase 未設定時は null を返す（localStorage のデータを使用すること）
 */
export async function fetchStampCount(userId: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('stamps')
    .select('count')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[stampsApi] fetchStampCount error:', error);
    return null;
  }

  return data?.count ?? 0;
}

/**
 * ログイン済みユーザーのスタンプ数を Supabase に保存する（UPSERT）
 * Supabase 未設定時は何もしない
 */
export async function upsertStampCount(userId: string, count: number): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('stamps').upsert(
    { user_id: userId, count, last_updated: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[stampsApi] upsertStampCount error:', error);
  }
}
