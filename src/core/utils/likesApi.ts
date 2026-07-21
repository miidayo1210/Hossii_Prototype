import { supabase, isSupabaseConfigured } from '../supabase';

export type LikeMutationResult = {
  likeCount: number;
  liked: boolean;
};

/**
 * いいね数を1インクリメントする（匿名・何回でも可）
 * @returns 更新後の like_count（失敗時は 0）
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

  return Math.max(0, (data as number) ?? 0);
}

/**
 * DB 上の確定 like_count を取得する
 */
export async function fetchHossiiLikeCount(hossiiId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    console.warn('[likesApi] Supabase not configured');
    return 0;
  }

  const { data, error } = await supabase
    .from('hossiis')
    .select('like_count')
    .eq('id', hossiiId)
    .maybeSingle();

  if (error) {
    console.error('[likesApi] fetchHossiiLikeCount error:', error);
    throw error;
  }

  return Math.max(0, (data?.like_count as number) ?? 0);
}

/**
 * いいねをトグルする（ログイン済みユーザー向け）
 * hossii_likes の insert/delete と DB trigger による like_count 更新後、確定値を返す
 */
export async function toggleLike(
  hossiiId: string,
  userId: string
): Promise<LikeMutationResult> {
  if (!isSupabaseConfigured) {
    console.warn('[likesApi] Supabase not configured');
    throw new Error('[likesApi] Supabase not configured');
  }

  const { data: existing } = await supabase
    .from('hossii_likes')
    .select('hossii_id')
    .eq('hossii_id', hossiiId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('hossii_likes')
      .delete()
      .eq('hossii_id', hossiiId)
      .eq('user_id', userId);

    if (error) {
      console.error('[likesApi] unlike error:', error);
      throw error;
    }

    const likeCount = await fetchHossiiLikeCount(hossiiId);
    return { liked: false, likeCount };
  }

  const { error } = await supabase
    .from('hossii_likes')
    .insert({ hossii_id: hossiiId, user_id: userId });

  if (error) {
    console.error('[likesApi] like error:', error);
    throw error;
  }

  const likeCount = await fetchHossiiLikeCount(hossiiId);
  return { liked: true, likeCount };
}

/**
 * ログイン状態に応じていいねをトグルまたはインクリメントする
 * - ログイン済み: hossii_likes トグル + trigger 更新後の確定 like_count
 * - ゲスト: increment_hossii_like RPC の返却値
 */
export async function mutateLike(
  hossiiId: string,
  userId?: string
): Promise<LikeMutationResult> {
  if (!isSupabaseConfigured) {
    throw new Error('[likesApi] Supabase not configured');
  }

  if (userId) {
    return toggleLike(hossiiId, userId);
  }

  const likeCount = await incrementLike(hossiiId);
  if (likeCount <= 0) {
    throw new Error('[likesApi] incrementLike failed');
  }

  return { likeCount, liked: true };
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
