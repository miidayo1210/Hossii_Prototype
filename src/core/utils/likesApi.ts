import { supabase, isSupabaseConfigured } from '../supabase';

/**
 * いいね数を1インクリメントする（匿名・何回でも可）
 * @returns 更新後の like_count
 */
export async function incrementLike(hossiiId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    console.warn('[likesApi] Supabase not configured');
    return 0;
  }

  const { data, error } = await supabase
    .rpc('increment_hossii_like', { p_hossii_id: hossiiId });

  if (error) {
    console.error('[likesApi] incrementLike error:', error);
    return 0;
  }

  return (data as number) ?? 0;
}

/**
 * いいねをトグルする（旧 API・廃止予定）
 * すでにいいねしていれば削除（unlike）、していなければ追加（like）
 * @returns 操作後のいいね状態（true = いいね済み）
 */
export async function toggleLike(
  hossiiId: string,
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('[likesApi] Supabase not configured');
    return false;
  }

  // 既存のいいねを確認
  const { data: existing } = await supabase
    .from('hossii_likes')
    .select('hossii_id')
    .eq('hossii_id', hossiiId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // いいね済み → 削除（unlike）
    const { error } = await supabase
      .from('hossii_likes')
      .delete()
      .eq('hossii_id', hossiiId)
      .eq('user_id', userId);

    if (error) {
      console.error('[likesApi] unlike error:', error);
      throw error;
    }
    return false;
  } else {
    // 未いいね → 追加（like）
    const { error } = await supabase
      .from('hossii_likes')
      .insert({ hossii_id: hossiiId, user_id: userId });

    if (error) {
      console.error('[likesApi] like error:', error);
      throw error;
    }
    return true;
  }
}

/**
 * 指定ユーザーがいいねしている hossii_id の一覧を返す
 */
export async function fetchLikedIds(
  userId: string,
  hossiiIds: string[]
): Promise<Set<string>> {
  if (!isSupabaseConfigured || hossiiIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('hossii_likes')
    .select('hossii_id')
    .eq('user_id', userId)
    .in('hossii_id', hossiiIds);

  if (error) {
    console.error('[likesApi] fetchLikedIds error:', error);
    return new Set();
  }

  return new Set((data ?? []).map((row: { hossii_id: string }) => row.hossii_id));
}
